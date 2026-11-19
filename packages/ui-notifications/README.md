# @buildpad/ui-notifications

One notification bell and inbox for every Buildpad app: a bell with an unread badge and the latest
notifications, a `/notifications` page with tabs, day groups and a detail pane to reply and act, all
behind a small adapter. The DaaS side (collection, `notifications` service, hooks, daily digest) is in
[`schema/`](./schema/README.md).

Full guide: the Notifications recipe in the docs app (`apps/docs/content/notifications.mdx`).

## Install

```bash
buildpad add notifications        # copies the source into components/ui/notifications
# or
pnpm add @buildpad/ui-notifications
```

Peer dependencies: `react`, `react-dom`, `@mantine/core` 8, `@mantine/hooks` 8, `@tabler/icons-react`,
`@buildpad/services` and `@buildpad/utils`.

## Quick start

**1. The provider**, once, under the provider that knows the signed-in user:

```tsx
'use client';
import { useMemo } from 'react';
import { NotificationsProvider, notificationsItemsAdapter } from '@buildpad/ui-notifications';

export function AppNotifications({ user, children }: { user: { id: string }; children: React.ReactNode }) {
  const adapter = useMemo(() => notificationsItemsAdapter({ meId: user.id }), [user.id]);
  return (
    <NotificationsProvider adapter={adapter} meId={user.id}>
      {children}
    </NotificationsProvider>
  );
}
```

The adapter asks only for the fields the shipped read permission grants
(`READABLE_NOTIFICATION_FIELDS`); keep the two in step if you change the permission. The provider
polls every 30 s and on focus / visibility, coalescing wake events and overlapping refetches into
one request.

**2. The bell** in the header:

```tsx
'use client';
import { useRouter } from 'next/navigation';
import { NotificationBell } from '@buildpad/ui-notifications';

export function HeaderBell() {
  const router = useRouter();
  return <NotificationBell href="/notifications" onNavigate={(href) => router.push(href)} />;
}
```

**3. The inbox page**, with the filter and selection in the URL (`?filter=unread&id=...`):

```tsx
// app/notifications/page.tsx
'use client';
import { Suspense } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { NotificationsInbox, nextUrlState } from '@buildpad/ui-notifications';

function Inbox() {
  const router = useRouter();
  const urlState = nextUrlState(useSearchParams(), router, usePathname());
  return (
    <NotificationsInbox
      urlState={urlState}
      onNavigate={(href) => router.push(href)}
      tabs={[{ key: 'mentions', label: 'Mentions', clause: { type: { _eq: 'mention' } } }]}
    />
  );
}

export default function NotificationsPage() {
  return (
    <Suspense>
      <Inbox />
    </Suspense>
  );
}
```

Without `urlState` the inbox keeps its state in memory (`useLocalUrlState`).

A notification's `link` is followed only when it is app-relative (one leading `/`, not `//` or
`/\`; see `isAppRelativeLink`); otherwise clicking it opens the inbox. A custom `resolveLink` is
yours to check.

## Slots and styles

The detail pane takes three render props: `renderPreview` (a preview of the source record),
`renderActions` (approve, assign, ...) and `renderReply` (a reply box). For example, the
`@buildpad/ui-comments` `Composer` bound to the record:

```tsx
import { Composer, useCommentsStrings } from '@buildpad/ui-comments';

const strings = useCommentsStrings();
<NotificationsInbox
  renderReply={(n) =>
    n.source_collection === 'tickets' ? (
      <Composer
        strings={strings}
        placeholder={`Reply to ${n.actor_name ?? 'them'}…`}
        submitLabel="Reply"
        onSubmit={(body) => postTicketComment(n.source_id!, body)}
      />
    ) : null
  }
/>;
```

`typeStyles` changes the label, Mantine color and icon per `type`
(`{ approval: { label: 'Approval', color: 'grape', icon: IconChecklist } }`); the built-ins are
`info`, `mention`, `comment`, `reply`, `assigned`, `status` and `system`.

Strings come from the `notifications` namespace of `@buildpad/utils` (English and Bahasa Indonesia);
override them with `BuildpadI18nProvider` or each component's `translations` prop.

## Storybook

```bash
pnpm storybook:notifications   # port 6017
```
