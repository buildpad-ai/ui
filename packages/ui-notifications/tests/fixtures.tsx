import React from 'react';
import { render } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { NotificationsProvider, type NotificationsProviderProps } from '../src/NotificationsProvider';
import type { Notification } from '../src/core/types';

export const ME = '11111111-1111-4111-8111-111111111111';

let seq = 0;
export function note(extra: Partial<Notification> = {}): Notification {
  seq += 1;
  return {
    id: `n${seq}`,
    recipient: ME,
    type: 'comment',
    title: `Note ${seq}`,
    message: null,
    link: null,
    read_at: null,
    created_at: new Date(Date.UTC(2026, 10, 1, 0, 0, 0) + seq * 60_000).toISOString(),
    ...extra,
  };
}

export function renderWithProvider(ui: React.ReactElement, props: Omit<NotificationsProviderProps, 'children' | 'meId'> & { meId?: string }) {
  const { meId = ME, ...rest } = props;
  const wrap = (node: React.ReactElement, id = meId) => (
    <MantineProvider env="test">
      <NotificationsProvider meId={id} pollMs={0} {...rest}>
        {node}
      </NotificationsProvider>
    </MantineProvider>
  );
  const utils = render(wrap(ui));
  return { ...utils, rerenderAs: (id: string, node = ui) => utils.rerender(wrap(node, id)) };
}

export const deferred = <T,>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};
