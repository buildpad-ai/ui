import React, { useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Stack, Text, Title } from '@mantine/core';
import { CommentsKit, type CommentsKitProps } from './CommentsKit';
import { mockAdapter, type MockOptions } from './_mockAdapter';
import { makeToken } from './core/mentions';
import type { Comment } from './core/types';

/**
 * Comments for a record. The stories run against an in-memory adapter that behaves like the
 * server side of the add-comments skill (author and thread root stamped on the way in), so
 * everything you do here — reply to a reply, react, edit, delete — really changes the list.
 */
const meta: Meta<typeof CommentsKit> = {
  title: 'Comments/CommentsKit',
  component: CommentsKit,
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof CommentsKit>;

const ME = { id: '99999999-9999-4999-8999-999999999999', name: 'Mira Santoso' };
const ANA = { id: '11111111-1111-4111-8111-111111111111', name: 'Ana Putri' };
const BUDI = { id: '33333333-3333-4333-8333-333333333333', name: 'Budi Hartono' };
const CITRA = { id: '44444444-4444-4444-8444-444444444444', name: 'Citra Dewi' };

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const comment = (
  id: string,
  parent: string | null,
  by: { id: string; name: string },
  body: string,
  minutes: number,
  extra: Partial<Comment> = {}
): Comment => ({ id, parent, root: null, author: by, body, photos: null, createdAt: ago(minutes), ...extra });

const chip = (emoji: string, names: string[]) => ({ emoji, count: names.length, mine: names.includes(ME.name), names });

/** A thread four levels deep, one short thread, and a list. */
const seed = (): Comment[] => [
  comment('c1', null, ANA, 'The **invoice export** still drops the last row when a filter is on. Can someone look at it before Friday?', 190, {
    reactions: [chip('👀', [BUDI.name, CITRA.name]), chip('👍', [ME.name])],
  }),
  comment('c2', 'c1', BUDI, `${makeToken(ME.name, ME.id)} reproduced. It only happens when the filter matches more than 500 rows.`, 150),
  comment('c3', 'c2', ME, 'That matches the page size. I think the export asks for one page too few.', 95, {
    reactions: [chip('🎉', [ANA.name])],
  }),
  comment('c4', 'c3', CITRA, 'Agreed. I can take it:\n- fix the off-by-one\n- add a test with 501 rows\n- check the CSV and the PDF', 40),
  comment('c5', 'c4', ANA, `Thanks ${makeToken(CITRA.name, CITRA.id)} ++please also check the Excel export++ 🙏`, 12),
  comment('c6', null, BUDI, 'Separate thing: can we show the total on the *last* page only?', 55, {
    reactions: [chip('👎', [CITRA.name]), chip('🚀', [ANA.name, ME.name, BUDI.name, CITRA.name])],
  }),
];

function Kit(props: { adapter?: Partial<MockOptions>; kit?: Partial<CommentsKitProps> }) {
  const adapter = useMemo(
    () =>
      mockAdapter({
        me: ME,
        people: [ANA, BUDI, CITRA],
        comments: seed(),
        link: (id) => `https://app.example/tickets/42?comment=${id}`,
        ...props.adapter,
      }),
    // The adapter is the story's data: build it once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  return (
    <Stack maw={720} gap="sm">
      <Title order={4}>INV-1042 · Export drops the last row</Title>
      <Text size="sm" c="dimmed">
        Discussion on this ticket
      </Text>
      <CommentsKit adapter={adapter} meId={ME.id} meName={ME.name} {...props.kit} />
    </Stack>
  );
}

/** What the module gives you with `itemsAdapter` and no extras: comments are immutable, reactions work. */
export const Thread: Story = { render: () => <Kit /> };

/** An adapter that also offers edit, delete and resolve: the buttons appear (edit only on your own comments). */
export const WithEditDeleteResolve: Story = {
  render: () => <Kit adapter={{ edit: true, remove: true, resolve: true }} kit={{ canModerate: true }} />,
};

/** A viewer who may read but not comment: the list and the chips, nothing to click. */
export const ReadOnly: Story = { render: () => <Kit kit={{ canComment: false }} /> };

/** An adapter without `react`: the chips stay, read-only. */
export const NoReactions: Story = { render: () => <Kit adapter={{ react: false }} /> };

export const Empty: Story = { render: () => <Kit adapter={{ comments: [] }} /> };

/** Every call takes a moment, so you can see that posting and reacting never blank the list. */
export const SlowServer: Story = { render: () => <Kit adapter={{ latency: 900, edit: true }} /> };

/** Saving and reacting fail: the text stays in the box, the chips roll back, a message says so. */
export const WhenCallsFail: Story = { render: () => <Kit adapter={{ failOn: ['add', 'react'] }} /> };

/** A link to one comment (`?comment=`) scrolls to it and highlights it; `newIds` marks comments the viewer has not seen. */
export const LinkedAndNew: Story = { render: () => <Kit kit={{ focusId: 'c4', newIds: ['c5', 'c6'] }} /> };

/** Type @ and a name: people are searched after a short pause, arrow keys move, Enter or Tab chooses, Esc closes the list. Mentions of you stand out. */
export const Mentions: Story = { render: () => <Kit adapter={{ latency: 250 }} /> };

/** No people search on the adapter: @ is just text. */
export const NoMentions: Story = { render: () => <Kit adapter={{ mentions: false }} /> };

/** Pictures: use the picture button or paste a screenshot (Ctrl+V) into the box. Thumbnails open a viewer. */
export const Pictures: Story = { render: () => <Kit adapter={{ latency: 400, comments: withPictures() }} /> };

/** No upload on the adapter: no picture button, and pasting a picture does nothing. */
export const NoPictures: Story = { render: () => <Kit adapter={{ images: false }} /> };

/** Uploads fail: the message says so and the text stays in the box. */
export const WhenUploadFails: Story = { render: () => <Kit adapter={{ failOn: ['upload'] }} /> };

function withPictures(): Comment[] {
  const base = seed();
  base[0] = { ...base[0], photos: ['file-a', 'file-b', 'file-c'] };
  base[2] = { ...base[2], photos: ['file-d'] };
  return base;
}
