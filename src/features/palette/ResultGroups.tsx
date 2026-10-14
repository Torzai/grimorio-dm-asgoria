import { useId, useMemo } from 'react';
import { Link } from 'react-router';
import { PJ_ESTADO_LABELS } from '@/content/type-labels';
import type { FrontmatterOf } from '@/content/types';
import { useContent } from '@/content/use-content';
import { Highlighted } from './Highlighted';
import {
  resultTag,
  resultTarget,
  searchPageTarget,
  type ResultGroup,
  type ResultOption,
} from './palette-results';
import styles from './ResultGroups.module.css';

type Estado = FrontmatterOf<'pj'>['estado'];

/** In the palette the list is a listbox driven from the input (combobox pattern). */
export interface ListboxBehavior {
  id: string;
  label: string;
  selectedKey: string | undefined;
  optionId: (key: string) => string;
  onPick: (option: ResultOption) => void;
  onHover: (key: string) => void;
}

interface ResultGroupsProps {
  groups: readonly ResultGroup[];
  /** The query: the target of history entries and of "Ver N más". */
  query: string;
  /** Normalized words of the query, highlighted in the titles. */
  terms: readonly string[];
  /** Set in the palette; without it every row is a link (/buscar). */
  listbox?: ListboxBehavior;
}

/** Results grouped by kind, as in sdd/design/maqueta-palette.html. */
export function ResultGroups({ groups, query, terms, listbox }: ResultGroupsProps) {
  const baseId = useId();
  const { entries } = useContent();
  const estados = useMemo(() => {
    const bySlug = new Map<string, Estado>();
    for (const entry of entries) {
      if (entry.data.type === 'pj') bySlug.set(entry.slug, entry.data.estado);
    }
    return bySlug;
  }, [entries]);

  const content = (option: ResultOption) =>
    'result' in option ? (
      <>
        <span className={styles.title}>
          {option.kind === 'pj' && <EstadoDot estado={estados.get(option.result.slug)} />}
          <span className={styles.titleText}>
            <Highlighted text={option.result.title} terms={terms} />
          </span>
        </span>
        <span className={styles.tag}>{resultTag(option.result)}</span>
      </>
    ) : (
      <>
        <span className={styles.more}>{`Ver ${option.more} más`}</span>
        <span className={styles.tag}>/buscar</span>
      </>
    );

  const target = (option: ResultOption) =>
    'result' in option ? resultTarget(option.result, query) : searchPageTarget(query, option.kind);

  if (listbox) {
    return (
      <div role="listbox" id={listbox.id} aria-label={listbox.label} className={styles.list}>
        {groups.map((group) => {
          const headingId = `${baseId}-${group.key}`;
          return (
            <div key={group.key} role="group" aria-labelledby={headingId} className={styles.group}>
              <span id={headingId} className={styles.heading}>
                {group.label}
              </span>
              {group.options.map((option) => {
                const selected = option.key === listbox.selectedKey;
                return (
                  <div
                    key={option.key}
                    id={listbox.optionId(option.key)}
                    role="option"
                    aria-selected={selected}
                    className={styles.row}
                    // Keeps the focus in the input.
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseMove={() => {
                      if (!selected) listbox.onHover(option.key);
                    }}
                    onClick={() => listbox.onPick(option)}
                  >
                    {content(option)}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {groups.map((group) => {
        const headingId = `${baseId}-${group.key}`;
        return (
          <section key={group.key} aria-labelledby={headingId} className={styles.group}>
            <h2 id={headingId} className={styles.heading}>
              {group.label}
            </h2>
            <ul className={styles.links}>
              {group.options.map((option) => (
                <li key={option.key}>
                  <Link className={styles.row} to={target(option)}>
                    {content(option)}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function EstadoDot({ estado }: { estado: Estado | undefined }) {
  if (!estado) return null;
  return (
    <>
      <span className={styles.dot} data-estado={estado} aria-hidden="true" />
      <span className="visually-hidden">{`${PJ_ESTADO_LABELS[estado]}: `}</span>
    </>
  );
}
