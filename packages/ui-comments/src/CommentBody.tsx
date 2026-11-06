'use client';

import { Fragment } from 'react';
import { blocks, inline } from './core/richtext';

/**
 * A comment's text as React nodes: paragraphs, bullet lists, bold, italic and underline. It never
 * sees HTML — anything that is not one of those marks stays plain text, so a comment cannot
 * inject markup.
 */
export function CommentBody({ body }: { body: string }) {
  return (
    <div className="bp-cm-body">
      {blocks(body).map((block, index) =>
        block.type === 'ul' ? (
          <ul key={index}>
            {block.items.map((item, i) => (
              <li key={i}>
                <Runs line={item} />
              </li>
            ))}
          </ul>
        ) : (
          <p key={index}>
            <Runs line={block.text} />
          </p>
        )
      )}
    </div>
  );
}

function Runs({ line }: { line: string }) {
  return (
    <>
      {inline(line).map((run, index) => {
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
