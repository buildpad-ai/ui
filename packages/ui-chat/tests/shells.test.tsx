import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AiChatButton } from '../src/AiChatButton';
import { AiChatContextChip } from '../src/AiChatContextChip';
import { AiChatPanel } from '../src/AiChatPanel';
import { AiChatProvider, useAiChat } from '../src/AiChatProvider';
import { AiChatWidget } from '../src/AiChatWidget';
import { useChocolateFactoryConfig } from '../src/useChocolateFactoryConfig';
import { renderWithMantine, scriptedBackend } from './helpers';

const originalMatchMedia = window.matchMedia;

function wideScreen(matches: boolean) {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  window.sessionStorage.clear();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  document.documentElement.style.removeProperty('--bp-ai-chat-offset');
});

describe('AiChatProvider + AiChatButton + AiChatPanel', () => {
  it('opens and docks the panel from the button, and closes it from the panel', async () => {
    wideScreen(true);
    const { backend } = scriptedBackend();
    renderWithMantine(
      <AiChatProvider>
        <AiChatButton />
        <AiChatPanel backend={backend} title="Help" />
      </AiChatProvider>
    );
    const panel = document.querySelector('.bp-ai-chat-panel')!;
    expect(panel).toHaveAttribute('aria-hidden', 'true');

    await userEvent.click(screen.getAllByRole('button', { name: 'Ask AI' })[0]);
    expect(panel).toHaveAttribute('data-opened');
    expect(panel).toHaveAttribute('data-docked');
    expect(document.documentElement.style.getPropertyValue('--bp-ai-chat-offset')).toBe('420px');
    expect(window.sessionStorage.getItem('buildpad.ai-chat.opened')).toBe('1');

    await userEvent.click(screen.getByRole('button', { name: 'Close assistant' }));
    expect(panel).not.toHaveAttribute('data-opened');
    expect(document.documentElement.style.getPropertyValue('--bp-ai-chat-offset')).toBe('');
  });

  it('overlays instead of docking on a narrow screen, and follows explicit props', () => {
    wideScreen(false);
    const { backend } = scriptedBackend();
    renderWithMantine(<AiChatPanel backend={backend} opened onClose={() => {}} width={360} />);
    const panel = document.querySelector('.bp-ai-chat-panel')!;
    expect(panel).toHaveAttribute('data-opened');
    expect(panel).not.toHaveAttribute('data-docked');
    expect(document.documentElement.style.getPropertyValue('--bp-ai-chat-offset')).toBe('');
  });

  it('remembers the open state per tab and toggles with the shortcut', async () => {
    window.sessionStorage.setItem('buildpad.ai-chat.opened', '1');
    let chat: ReturnType<typeof useAiChat> = null;
    function Probe() {
      chat = useAiChat();
      return null;
    }
    renderWithMantine(
      <AiChatProvider>
        <Probe />
      </AiChatProvider>
    );
    await waitFor(() => expect(chat?.opened).toBe(true));
    expect(chat!.hotkey).toBe('mod+I');
    fireEvent.keyDown(document.documentElement, { key: 'i', code: 'KeyI', ctrlKey: true });
    await waitFor(() => expect(chat?.opened).toBe(false));
    act(() => chat!.toggle());
    expect(chat!.opened).toBe(true);
  });

  it('renders no button outside a provider', () => {
    renderWithMantine(<AiChatButton />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('AiChatWidget', () => {
  it('opens and closes from its launcher, on its own state', async () => {
    const { backend } = scriptedBackend();
    const onOpenChange = vi.fn();
    renderWithMantine(<AiChatWidget backend={backend} position="bottom-left" launcherLabel="Chat with us" onOpenChange={onOpenChange} />);
    const windowEl = document.querySelector('.bp-ai-chat-window')!;
    expect(windowEl).not.toHaveAttribute('data-opened');
    expect(document.querySelector('.bp-ai-chat-widget')).toHaveAttribute('data-position', 'bottom-left');

    await userEvent.click(screen.getByRole('button', { name: 'Chat with us' }));
    expect(windowEl).toHaveAttribute('data-opened');
    expect(onOpenChange).toHaveBeenLastCalledWith(true);

    await userEvent.click(screen.getAllByRole('button', { name: 'Close assistant' })[0]);
    expect(windowEl).not.toHaveAttribute('data-opened');
  });

  it('shares the provider state with a button', async () => {
    const { backend } = scriptedBackend();
    renderWithMantine(
      <AiChatProvider>
        <AiChatButton label="Help" />
        <AiChatWidget backend={backend} />
      </AiChatProvider>
    );
    await userEvent.click(screen.getAllByRole('button', { name: 'Help' })[0]);
    expect(document.querySelector('.bp-ai-chat-window')).toHaveAttribute('data-opened');
    await userEvent.click(screen.getByRole('button', { name: 'Close assistant', expanded: true }));
    expect(document.querySelector('.bp-ai-chat-window')).not.toHaveAttribute('data-opened');
  });

  it('follows a controlled opened prop', async () => {
    const { backend } = scriptedBackend();
    const onOpenChange = vi.fn();
    renderWithMantine(<AiChatWidget backend={backend} opened={false} onOpenChange={onOpenChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open assistant' }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(document.querySelector('.bp-ai-chat-window')).not.toHaveAttribute('data-opened');
  });
});

describe('AiChatContextChip', () => {
  it('shows what is shared and offers to stop sharing', async () => {
    const onRemove = vi.fn();
    renderWithMantine(<AiChatContextChip label="Settings › Members" title="/settings/members" onRemove={onRemove} removeLabel="Stop sharing" />);
    expect(screen.getByText('Settings › Members')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Stop sharing' }));
    expect(onRemove).toHaveBeenCalled();
  });
});

describe('useChocolateFactoryConfig', () => {
  function Show({ url }: { url?: string }) {
    const config = useChocolateFactoryConfig(url);
    return <span>{config ? `${config.baseUrl} ${config.agentId}` : 'none'}</span>;
  }

  it('reads the config route', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ baseUrl: 'https://cf', agentId: 'a1', apiKey: 'k' }))));
    renderWithMantine(<Show />);
    expect(await screen.findByText('https://cf a1')).toBeInTheDocument();
  });

  it('stays null when the chat is not configured', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);
    renderWithMantine(<Show url="/api/help/config" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/help/config'));
    expect(screen.getByText('none')).toBeInTheDocument();
  });
});
