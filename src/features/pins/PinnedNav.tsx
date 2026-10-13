import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { ResolvedItem } from './saved-items';
import { usePins } from './use-saved-items';
import styles from './PinnedNav.module.css';

/** Where the focus goes once a removal re-renders the list. */
type FocusTarget = { key: string } | 'heading' | 'clear' | 'confirm' | undefined;

/** "Fijados esta sesión", under the categories of the sidebar (sdd/design/maqueta-ficha.html). */
export function PinnedNav() {
  const { pins, remove, clear } = usePins();
  const [confirming, setConfirming] = useState(false);
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const clearRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const focusTarget = useRef<FocusTarget>(undefined);

  // The button that had the focus is gone; move it somewhere close instead of losing it.
  useEffect(() => {
    const target = focusTarget.current;
    focusTarget.current = undefined;
    if (target === 'heading') headingRef.current?.focus();
    else if (target === 'clear') clearRef.current?.focus();
    else if (target === 'confirm') {
      // "No" first: the safe answer.
      confirmRef.current?.querySelector<HTMLButtonElement>('button:last-of-type')?.focus();
    } else if (target) {
      listRef.current
        ?.querySelector<HTMLButtonElement>(`[data-key="${CSS.escape(target.key)}"] button`)
        ?.focus();
    }
  }, [pins, confirming]);

  function removePin(pin: ResolvedItem, index: number) {
    const next = pins[index + 1] ?? pins[index - 1];
    focusTarget.current = next ? { key: next.key } : 'heading';
    remove(pin.item);
  }

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 ref={headingRef} id={headingId} tabIndex={-1} className={styles.heading}>
        Fijados esta sesión
      </h2>
      {pins.length === 0 ? (
        <p className={styles.empty}>Fija fichas con el botón Fijar o Ctrl+Enter</p>
      ) : (
        <>
          <ul ref={listRef} className={styles.list}>
            {pins.map((pin, index) => (
              <li key={pin.key} data-key={pin.key} className={styles.row}>
                <Link className={styles.link} to={pin.to}>
                  <span className={styles.title}>{pin.title}</span>
                  <span className={styles.tag}>{pin.tag}</span>
                </Link>
                <button
                  type="button"
                  className={styles.remove}
                  aria-label="Quitar de fijados"
                  title={`Quitar «${pin.title}» de fijados`}
                  onClick={() => removePin(pin, index)}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </li>
            ))}
          </ul>
          {confirming ? (
            <div
              ref={confirmRef}
              className={styles.confirm}
              role="group"
              aria-label="Limpiar fijados"
            >
              <span>¿Seguro?</span>
              <button
                type="button"
                className={styles.confirmButton}
                onClick={() => {
                  focusTarget.current = 'heading';
                  setConfirming(false);
                  clear();
                }}
              >
                Sí
              </button>
              <button
                type="button"
                className={styles.confirmButton}
                onClick={() => {
                  focusTarget.current = 'clear';
                  setConfirming(false);
                }}
              >
                No
              </button>
            </div>
          ) : (
            <button
              ref={clearRef}
              type="button"
              className={styles.clear}
              onClick={() => {
                focusTarget.current = 'confirm';
                setConfirming(true);
              }}
            >
              Limpiar
            </button>
          )}
        </>
      )}
    </section>
  );
}
