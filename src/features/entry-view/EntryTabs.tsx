import { useRef, type KeyboardEvent } from 'react';
import styles from './EntryTabs.module.css';

export interface EntryTab<T extends string> {
  id: T;
  label: string;
  count?: number;
  tabId: string;
  panelId: string;
}

interface EntryTabsProps<T extends string> {
  tabs: readonly EntryTab<T>[];
  selected: T;
  onSelect: (id: T) => void;
  /** What the tabs are, for screen readers. */
  label?: string;
}

/** ARIA tabs of an entry's view: one tab stop, arrows (and Home/End) move and select. */
export function EntryTabs<T extends string>({
  tabs,
  selected,
  onSelect,
  label = 'Secciones de la ficha',
}: EntryTabsProps<T>) {
  const refs = useRef(new Map<T, HTMLButtonElement>());

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const index = tabs.findIndex((tab) => tab.id === selected);
    const last = tabs.length - 1;
    const next =
      event.key === 'ArrowRight'
        ? (index + 1) % tabs.length
        : event.key === 'ArrowLeft'
          ? (index - 1 + tabs.length) % tabs.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : undefined;
    if (next === undefined) return;
    event.preventDefault();
    onSelect(tabs[next].id);
    refs.current.get(tabs[next].id)?.focus();
  }

  return (
    <div role="tablist" aria-label={label} className={styles.tabs}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          ref={(element) => {
            if (element) refs.current.set(tab.id, element);
            else refs.current.delete(tab.id);
          }}
          type="button"
          role="tab"
          id={tab.tabId}
          aria-selected={tab.id === selected}
          aria-controls={tab.id === selected ? tab.panelId : undefined}
          tabIndex={tab.id === selected ? 0 : -1}
          className={styles.tab}
          onClick={() => onSelect(tab.id)}
          onKeyDown={handleKeyDown}
        >
          {tab.label}
          {tab.count !== undefined && <span className={styles.tabCount}> {tab.count}</span>}
        </button>
      ))}
    </div>
  );
}
