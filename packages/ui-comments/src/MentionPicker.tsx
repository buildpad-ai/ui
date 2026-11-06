'use client';

import { interpolate, type CommentsTranslations } from '@buildpad/utils';
import type { Person } from './core/types';

export interface MentionPickerProps {
  id: string;
  people: readonly Person[];
  active: number;
  query: string;
  /** True until the first answer for this query arrived and nothing is shown yet. */
  searching: boolean;
  /** Where to float the list, relative to the composer. */
  style: React.CSSProperties;
  strings: CommentsTranslations;
  onChoose: (person: Person) => void;
  onHover: (index: number) => void;
}

/** The people matching what was typed after `@`. Mouse down is prevented so the textarea keeps focus. */
export function MentionPicker({ id, people, active, query, searching, style, strings, onChoose, onHover }: MentionPickerProps) {
  return (
    <div className="bp-cm-mentions" style={style}>
      {people.length === 0 ? (
        <div className="bp-cm-mention-note" role="status">
          {searching ? strings.mentions.searching : interpolate(strings.mentions.none, { query })}
        </div>
      ) : (
        <ul id={id} role="listbox" aria-label={strings.mentions.listLabel}>
          {people.map((person, index) => (
            <li
              key={person.id}
              id={`${id}-${index}`}
              role="option"
              aria-selected={index === active}
              className="bp-cm-mention-opt"
              data-active={index === active || undefined}
              onMouseDown={(event) => {
                event.preventDefault();
                onChoose(person);
              }}
              onMouseEnter={() => onHover(index)}
            >
              <span className="bp-cm-mention-name">{person.name}</span>
              {person.email && <span className="bp-cm-mention-email">{person.email}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
