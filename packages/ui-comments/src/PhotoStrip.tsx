'use client';

import { useEffect, useState } from 'react';
import { ActionIcon, Modal, VisuallyHidden } from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconX } from '@tabler/icons-react';
import { interpolate, type CommentsTranslations } from '@buildpad/utils';

export interface PhotoStripProps {
  /** File ids, in the order they were attached. */
  photos: readonly string[];
  /** Where to load a picture from. */
  url: (fileId: string, size: 'thumb' | 'full') => string;
  strings: CommentsTranslations;
  /** In the comment box: each thumbnail gets a remove button. */
  onRemove?: (fileId: string) => void;
  /** Grey placeholders for pictures still uploading. */
  pending?: number;
}

/** Thumbnails that open a viewer; in the comment box they can be removed, and uploads show a placeholder. */
export function PhotoStrip({ photos, url, strings, onRemove, pending = 0 }: PhotoStripProps) {
  const [open, setOpen] = useState<number | null>(null);
  const total = photos.length;

  // Left and right arrows page through the pictures while the viewer is open.
  useEffect(() => {
    if (open === null) return;
    const move = (event: KeyboardEvent) => {
      if (total < 2 || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
      event.preventDefault();
      setOpen((index) => (index === null ? index : (index + (event.key === 'ArrowRight' ? 1 : -1) + total) % total));
    };
    window.addEventListener('keydown', move);
    return () => window.removeEventListener('keydown', move);
  }, [open, total]);

  if (total === 0 && pending === 0) return null;

  return (
    <>
      <div className="bp-cm-photos">
        {photos.map((id, index) => (
          <div key={id} className="bp-cm-photo">
            <button
              type="button"
              className="bp-cm-photo-open"
              aria-label={interpolate(strings.images.open, { n: index + 1, total })}
              onClick={() => setOpen(index)}
            >
              <img src={url(id, 'thumb')} alt={interpolate(strings.images.alt, { n: index + 1 })} loading="lazy" />
            </button>
            {onRemove && (
              <ActionIcon
                // 24px: it sits on top of the thumbnail's own button, so the target-size exception for
                // well-spaced small targets cannot apply.
                size={24}
                radius="xl"
                variant="filled"
                color="dark"
                className="bp-cm-photo-remove"
                aria-label={interpolate(strings.images.remove, { n: index + 1 })}
                onClick={() => onRemove(id)}
              >
                <IconX size={12} />
              </ActionIcon>
            )}
          </div>
        ))}
        {Array.from({ length: pending }, (_, index) => (
          <div key={`pending-${index}`} className="bp-cm-photo bp-cm-photo--wait" role="img" aria-label={strings.images.uploading} />
        ))}
      </div>

      <Modal
        opened={open !== null}
        onClose={() => setOpen(null)}
        size="auto"
        centered
        withCloseButton={false}
        padding={0}
        // The dialog's accessible name: Mantine labels the dialog by its title.
        title={<VisuallyHidden>{strings.images.viewerLabel}</VisuallyHidden>}
        classNames={{ content: 'bp-cm-viewer', header: 'bp-cm-viewer-header', body: 'bp-cm-viewer-body' }}
      >
        {open !== null && photos[open] && (
          <div className="bp-cm-viewer-frame">
            <img src={url(photos[open], 'full')} alt={interpolate(strings.images.alt, { n: open + 1 })} />
            {/* Paging keeps focus on Previous/Next, so say which picture is showing now. */}
            <VisuallyHidden aria-live="polite" aria-atomic="true">
              {interpolate(strings.images.alt, { n: open + 1 })}
            </VisuallyHidden>
            <ActionIcon
              variant="filled"
              color="dark"
              radius="xl"
              className="bp-cm-viewer-close"
              aria-label={strings.images.close}
              onClick={() => setOpen(null)}
            >
              <IconX size={16} />
            </ActionIcon>
            {total > 1 && (
              <>
                <ActionIcon
                  variant="filled"
                  color="dark"
                  radius="xl"
                  className="bp-cm-viewer-prev"
                  aria-label={strings.images.previous}
                  onClick={() => setOpen((open + total - 1) % total)}
                >
                  <IconChevronLeft size={18} />
                </ActionIcon>
                <ActionIcon
                  variant="filled"
                  color="dark"
                  radius="xl"
                  className="bp-cm-viewer-next"
                  aria-label={strings.images.next}
                  onClick={() => setOpen((open + 1) % total)}
                >
                  <IconChevronRight size={18} />
                </ActionIcon>
              </>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
