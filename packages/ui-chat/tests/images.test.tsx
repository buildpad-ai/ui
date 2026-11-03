import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { defaultTranslations } from '@buildpad/utils';
import { AnswerImage, SentImage } from '../src/AiChatImage';
import { renderWithMantine } from './helpers';

const t = defaultTranslations.chat;

describe('SentImage', () => {
  it('opens full size, and becomes a placeholder once the image is gone', async () => {
    renderWithMantine(<SentImage src="https://storage.example.com/a.png" name="a.png" t={t} />);
    await userEvent.click(screen.getByRole('button', { name: 'Enlarge a.png' }));
    expect(await screen.findByRole('link', { name: /Open in new tab/ })).toHaveAttribute('href', 'https://storage.example.com/a.png');

    fireEvent.error(screen.getAllByRole('img', { name: 'a.png' })[0]);
    expect(screen.getByText('Image no longer available')).toBeInTheDocument();
  });

  it('shows the placeholder for an image kept without its data', () => {
    renderWithMantine(<SentImage src="" t={t} />);
    expect(screen.getByText('Image no longer available')).toBeInTheDocument();
    expect(screen.getByTitle('Attached image')).toBeInTheDocument();
  });
});

describe('AnswerImage', () => {
  it('shows an image from an allowed host with its caption, full size on click', async () => {
    renderWithMantine(<AnswerImage src="https://docs.example.com/members.png" alt="The Members page" hosts={['docs.example.com']} t={t} />);
    expect(screen.getByText('The Members page')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Enlarge The Members page' }));
    expect(await screen.findByRole('link', { name: /Open in new tab/ })).toHaveAttribute('href', 'https://docs.example.com/members.png');
  });

  it('drops a broken image, and never fetches one from another host', () => {
    const { unmount } = renderWithMantine(<AnswerImage src="https://docs.example.com/gone.png" alt="" hosts={['docs.example.com']} t={t} />);
    fireEvent.error(document.querySelector('img')!);
    expect(document.querySelector('img')).toBeNull();
    unmount();

    renderWithMantine(<AnswerImage src="https://evil.example.com/x.png" alt="" hosts={['docs.example.com']} t={t} />);
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByText('Image')).toBeInTheDocument();
  });
});
