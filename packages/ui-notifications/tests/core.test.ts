import { describe, expect, it } from 'vitest';
import { timeAgo, dayGroupLabel, dayKey } from '../src/core/time';
import { buildFilter, findTab, resolveTabs, BUILTIN_TABS } from '../src/core/filters';
import { appendPage, cursorOf, requestLimit, PAGE_SIZE, OVERLAP } from '../src/core/paging';
import { mergePoll } from '../src/core/merge';
import { defaultResolveLink, isAppRelativeLink } from '../src/shared';
import { typeStyle, DEFAULT_TYPE_STYLES } from '../src/core/typeStyles';
import { mentionsToPlainText } from '../src/core/mentions';
import { isUnread } from '../src/core/types';
import { IconBell } from '@tabler/icons-react';
import { note, ME } from './fixtures';

describe('timeAgo', () => {
  const now = new Date(2026, 10, 17, 12, 0, 0);
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
  it('handles each boundary', () => {
    expect(timeAgo(ago(0), now)).toBe('just now');
    expect(timeAgo(ago(59_999), now)).toBe('just now');
    expect(timeAgo(ago(60_000), now)).toBe('1m');
    expect(timeAgo(ago(3_599_999), now)).toBe('59m');
    expect(timeAgo(ago(3_600_000), now)).toBe('1h');
    expect(timeAgo(ago(86_399_999), now)).toBe('23h');
    expect(timeAgo(ago(86_400_000), now)).toBe('1d');
    expect(timeAgo(ago(6 * 86_400_000), now)).toBe('6d');
    const old = ago(7 * 86_400_000);
    expect(timeAgo(old, now, undefined, 'en-US')).toBe(new Date(old).toLocaleDateString('en-US'));
  });
  it('counts days by local calendar day, matching dayGroupLabel', () => {
    // Nov 15 23:00 seen Nov 17 12:00 is 37h old but two calendar days back.
    const twoBack = new Date(2026, 10, 15, 23, 0).toISOString();
    expect(dayGroupLabel(twoBack, now, undefined, 'en-US')).toBe('Nov 15, 2026');
    expect(timeAgo(twoBack, now)).toBe('2d');
    // Nov 16 00:30 (35.5h) is Yesterday -> 1d.
    expect(timeAgo(new Date(2026, 10, 16, 0, 30).toISOString(), now)).toBe('1d');
    // Under 24h but across midnight stays in hours.
    const late = new Date(2026, 10, 18, 1, 0);
    expect(timeAgo(new Date(2026, 10, 17, 23, 0).toISOString(), late)).toBe('2h');
  });
  it('is empty for a bad date and treats the future as just now', () => {
    expect(timeAgo('nope', now)).toBe('');
    expect(timeAgo(new Date(now.getTime() + 5000).toISOString(), now)).toBe('just now');
  });
});

describe('dayGroupLabel', () => {
  const now = new Date(2026, 10, 17, 0, 30);
  it('uses local days', () => {
    expect(dayGroupLabel(new Date(2026, 10, 17, 0, 0).toISOString(), now)).toBe('Today');
    expect(dayGroupLabel(new Date(2026, 10, 16, 23, 59).toISOString(), now)).toBe('Yesterday');
    expect(dayGroupLabel(new Date(2026, 10, 15, 12).toISOString(), now)).toBe('Nov 15, 2026');
    expect(dayKey(new Date(2026, 10, 15, 1).toISOString())).toBe(dayKey(new Date(2026, 10, 15, 23).toISOString()));
  });
});

describe('filters', () => {
  const tabs = resolveTabs([{ key: 'mentions', clause: { type: { _eq: 'mention' } } }]);
  it('always includes the recipient, for every tab', () => {
    for (const t of tabs) {
      const f = buildFilter(ME, [t.clause]) as { _and: unknown[] };
      expect(f._and[0]).toEqual({ recipient: { _eq: ME } });
    }
    expect(buildFilter(ME, [findTab(tabs, 'all').clause])).toEqual({ _and: [{ recipient: { _eq: ME } }] });
    expect(buildFilter(ME, [findTab(tabs, 'unread').clause])).toEqual({ _and: [{ recipient: { _eq: ME } }, { read_at: { _null: true } }] });
    expect(buildFilter(ME, [findTab(tabs, 'mentions').clause, {}, null])).toEqual({
      _and: [{ recipient: { _eq: ME } }, { type: { _eq: 'mention' } }],
    });
  });
  it('resolves tabs: built-ins first, overrides by key, unknown key falls back', () => {
    expect(BUILTIN_TABS.map((t) => t.key)).toEqual(['all', 'unread']);
    expect(tabs.map((t) => t.key)).toEqual(['all', 'unread', 'mentions']);
    expect(resolveTabs([{ key: 'unread', label: 'New' }])[1].label).toBe('New');
    expect(findTab(tabs, 'zzz').key).toBe('all');
    expect(findTab(tabs, null).key).toBe('all');
  });
});

describe('paging', () => {
  it('asks for page + 1 + overlap', () => {
    expect(requestLimit()).toBe(PAGE_SIZE + 1 + OVERLAP);
    expect(cursorOf([])).toBeUndefined();
  });
  it('never duplicates rows that share the cursor timestamp', () => {
    const t = '2026-11-01T00:00:00.000Z';
    const rows = Array.from({ length: 6 }, (_, i) => note({ id: `d${i}`, created_at: t }));
    const first = appendPage([], rows.slice(0, 4), 4, 3);
    expect(first.items.map((n) => n.id)).toEqual(['d0', 'd1', 'd2']);
    expect(first.hasMore).toBe(true);
    // the next request (created_at <= t) returns all six again
    const second = appendPage(first.items, rows, 10, 3);
    expect(second.items.map((n) => n.id)).toEqual(['d0', 'd1', 'd2', 'd3', 'd4', 'd5']);
    // it brought fresh rows, so one more request is made; that one has nothing new and ends paging
    expect(second.hasMore).toBe(true);
    expect(new Set(second.items.map((n) => n.id)).size).toBe(6);
    const third = appendPage(second.items, rows, 10, 3);
    expect(third.items).toHaveLength(6);
    expect(third.hasMore).toBe(false);
  });
  it('a short page with fresh rows keeps paging (a server read filter may have dropped rows)', () => {
    const rows = Array.from({ length: 3 }, (_, i) => note({ id: `s${i}`, created_at: `2026-11-0${5 - i}T00:00:00.000Z` }));
    // asked for 41, got 3: before, that ended paging although the hidden rows' older siblings remain
    expect(appendPage([], rows, 41, 30).hasMore).toBe(true);
    expect(appendPage(rows, [], 41, 30).hasMore).toBe(false);
  });
  it('stall guard: a full page of rows already loaded (one shared created_at) ends paging', () => {
    const t = '2026-11-01T00:00:00.000Z';
    const rows = Array.from({ length: 4 }, (_, i) => note({ id: `z${i}`, created_at: t }));
    expect(appendPage(rows, rows, 4, 3).hasMore).toBe(false);
  });
});

describe('mergePoll', () => {
  it('returns the poll when nothing is loaded', () => {
    const p = [note()];
    expect(mergePoll([], p)).toBe(p);
  });
  it('refreshes read state, prepends new, keeps older rows pushed off the first page', () => {
    const old = note({ id: 'old' });
    const mid = note({ id: 'mid' });
    const top = note({ id: 'top' });
    const current = [top, mid, old];
    const fresh = note({ id: 'fresh' });
    const merged = mergePoll(current, [fresh, { ...top, read_at: '2026-11-02T00:00:00Z' }]);
    expect(merged.map((n) => n.id)).toEqual(['fresh', 'top', 'mid', 'old']);
    expect(merged[1].read_at).toBe('2026-11-02T00:00:00Z');
  });
  it('moves a loaded row whose polled copy is newer (a merged row) to the top, keeping the list sorted', () => {
    const a = note({ id: 'a', created_at: '2026-11-05T00:00:00.000Z' });
    const b = note({ id: 'b', created_at: '2026-11-04T00:00:00.000Z' });
    const c = note({ id: 'c', created_at: '2026-11-03T00:00:00.000Z' });
    const bumped = { ...c, created_at: '2026-11-06T00:00:00.000Z', title: '2 new replies' };
    const merged = mergePoll([a, b, c], [bumped, a, b]);
    expect(merged.map((n) => n.id)).toEqual(['c', 'a', 'b']);
    expect(cursorOf(merged)).toBe(b.created_at);
    const days = merged.map((n) => n.created_at.slice(0, 10));
    expect(new Set(days).size).toBe(days.length);
  });
  it('does not prepend unknown rows older than the newest loaded (they belong further down)', () => {
    const a = note({ id: 'a' });
    const older = { ...note({ id: 'x' }), created_at: '2000-01-01T00:00:00Z' };
    expect(mergePoll([a], [a, older]).map((n) => n.id)).toEqual(['a']);
  });
});

describe('typeStyle', () => {
  it('has defaults, overrides, labels and a gray bell fallback', () => {
    expect(Object.keys(DEFAULT_TYPE_STYLES)).toEqual(['info', 'mention', 'comment', 'reply', 'assigned', 'status', 'system']);
    expect(typeStyle('mention').color).toBe('violet');
    expect(typeStyle('mention', {}, { mention: 'Sebutan' }).label).toBe('Sebutan');
    expect(typeStyle('mention', { mention: { color: 'pink' } }).color).toBe('pink');
    const other = typeStyle('invoice_overdue_now');
    expect(other).toMatchObject({ label: 'invoice overdue now', color: 'gray', icon: IconBell });
  });
});

describe('mentions and unread', () => {
  it('renders mention tokens as plain text', () => {
    expect(mentionsToPlainText('hi @[Ana Lim](user:123e4567-e89b-12d3-a456-426614174000) and @[Ops](team:ops)!')).toBe('hi @Ana Lim and @Ops!');
    expect(mentionsToPlainText(null)).toBe('');
    expect(mentionsToPlainText('plain @x')).toBe('plain @x');
  });
  it('isUnread', () => {
    expect(isUnread({ read_at: null })).toBe(true);
    expect(isUnread({ read_at: 'x' })).toBe(false);
  });
});

describe('isAppRelativeLink / defaultResolveLink', () => {
  it('allows only app-relative paths', () => {
    expect(isAppRelativeLink('/tickets/T1?comment=C1')).toBe(true);
    for (const bad of ['javascript:alert(1)', 'https://evil.example', '//evil.example', '/\\evil.example', '/a\\b', '/a\nb', 'tickets/1', '', null, 5]) {
      expect(isAppRelativeLink(bad), String(bad)).toBe(false);
    }
    expect(defaultResolveLink(note({ link: '//evil.example' }))).toBeNull();
    expect(defaultResolveLink(note({ link: '/ok' }))).toBe('/ok');
  });
});
