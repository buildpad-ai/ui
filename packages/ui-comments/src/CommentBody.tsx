'use client';

import { Fragment } from 'react';
import { segments } from './core/mentions';
import { blocks, inline } from './core/richtext';

export interface CommentBodyProps {
  body: string;
  /** The viewer's id: a mention of them stands out. */
  meId?: string;
}

/**
 * A comment's text as React nodes: paragraphs, bullet lists, bold, italic, underline and mention
 * chips. It never sees HTML — anything that is not one of those stays plain text, so a comment
 * cannot inject markup.
 */
export function CommentBody({ body, meId }: CommentBodyProps) {
  return (
    <div className="bp-cm-body">
      {blocks(body).map((block, index) =>
        block.type === 'ul' ? (
          <ul key={index}>
            {block.items.map((item, i) => (
              <li key={i}>
                <Line line={item} meId={meId} />
              </li>
            ))}
          </ul>
        ) : (
          <p key={index}>
            <Line line={block.text} meId={meId} />
          </p>
        )
      )}
    </div>
  );
}

/** A line cut into text and mentions; the marks (bold…) are read inside each text part. */
function Line({ line, meId }: { line: string; meId?: string }) {
  const me = meId?.toLowerCase();
  return (
    <>
      {segments(line).map((part, index) =>
        part.type === 'mention' ? (
          <span key={index} className="bp-cm-mention" data-me={part.id === me || undefined} data-user-id={part.id}>
            @{part.name}
          </span>
        ) : (
          <Runs key={index} text={part.text} />
        )
      )}
    </>
  );
}

function Runs({ text }: { text: string }) {
  return (
    <>
      {inline(text).map((run, index) => {
        switch (run.kind) {
          case 'bold':
            return <strong key={index}>{run.text}</strong>;
          case 'italic':
            return <em key={index}>{run.text}</em>;
          case 'underline':
            return <u key={index}>{run.text}</u>;
          default:
            return <Fragment key={index}>{run.text}</Fragment>;
        }
      })}
    </>
  );
}
