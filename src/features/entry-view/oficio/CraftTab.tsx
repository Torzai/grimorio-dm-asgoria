import { useEffect, useId, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Link } from 'react-router';
import { queryTerms } from '@/content/highlight';
import { familyLabel, indexOficio, type CatalogComponent, type OficioMeta } from '@/content/oficio';
import { whatCanICraft } from '@/content/oficio-craft';
import { Highlighted } from '@/features/palette/Highlighted';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { matchComponents } from './oficio-filter';
import { componentParams, recipeParams, useParamLink } from './oficio-url';
import { ComponentChip } from './OficioParts';
import { levelAndDc, plural, timesText } from './master-detail';
import styles from './OficioView.module.css';

/** A row of the inventory: a component (its key) and how many units the DM has. */
interface InventoryRow {
  componente: string;
  cantidad: number;
}

const MAX_UNITS = 9999;
const NO_ROWS: InventoryRow[] = [];

/** Whatever is stored, as valid rows; anything else is dropped. */
function parseInventory(stored: unknown): InventoryRow[] {
  if (!Array.isArray(stored)) return NO_ROWS;
  return stored.flatMap((item: unknown) => {
    if (typeof item !== 'object' || item === null) return [];
    const { componente, cantidad } = item as Record<string, unknown>;
    return typeof componente === 'string' &&
      typeof cantidad === 'number' &&
      Number.isInteger(cantidad) &&
      cantidad >= 0
      ? [{ componente, cantidad: Math.min(cantidad, MAX_UNITS) }]
      : [];
  });
}

function clampUnits(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(MAX_UNITS, Math.floor(value))) : 0;
}

interface CraftTabProps {
  slug: string;
  meta: OficioMeta;
}

/**
 * ¿Qué puedo fabricar?: the DM's inventory (kept in this browser, one per oficio) and, recomputed
 * on every change, what can be made right away, by crafting intermediates first, or almost.
 */
export function CraftTab({ slug, meta }: CraftTabProps) {
  const index = indexOficio(meta);
  const link = useParamLink();
  const [rows, update] = useLocalStorage(`grimorio.inventario.${slug}.v1`, parseInventory);
  // A component no longer in the oficio (renamed in its file) is left out.
  const shown = rows.filter(({ componente }) => index.components.has(componente));
  const inventory = useMemo(
    () => new Map(rows.map(({ componente, cantidad }) => [componente, cantidad])),
    [rows],
  );
  const { ready, chained, almost } = useMemo(
    () => whatCanICraft(meta, inventory),
    [meta, inventory],
  );
  const empty = shown.every(({ cantidad }) => cantidad === 0);

  const pickerRef = useRef<HTMLInputElement>(null);
  const inputs = useRef(new Map<string, HTMLInputElement>());
  // The row just added: its quantity gets the focus as soon as it is on screen.
  const pendingFocusRef = useRef<string | undefined>(undefined);

  function setUnits(key: string, units: number) {
    const cantidad = clampUnits(units);
    update((previous) =>
      previous.map((row) => (row.componente === key ? { ...row, cantidad } : row)),
    );
  }

  function addComponent(key: string) {
    const input = inputs.current.get(key);
    if (input) {
      input.focus();
      input.select();
      return;
    }
    pendingFocusRef.current = key;
    update((previous) => [
      ...previous.filter((row) => row.componente !== key),
      { componente: key, cantidad: 1 },
    ]);
  }

  function removeComponent(key: string) {
    update((previous) => previous.filter((row) => row.componente !== key));
    pickerRef.current?.focus();
  }

  function clearInventory() {
    update(() => NO_ROWS);
    pickerRef.current?.focus();
  }

  const inventoryId = useId();
  const resultsId = useId();
  const nameOf = (id: string) => index.recipes.get(id)?.nombre ?? id;
  const summary = empty
    ? ''
    : `${ready.length} ya · ${chained.length} encadenando · ${almost.length} te falta poco`;

  return (
    <div className={styles.craft}>
      <section className={styles.inventory} aria-labelledby={inventoryId}>
        <div className={styles.inventoryHead}>
          <h2 id={inventoryId} className={styles.panelTitle}>
            Inventario
          </h2>
          {shown.length > 0 && (
            <button type="button" className={styles.clear} onClick={clearInventory}>
              Vaciar
            </button>
          )}
        </div>
        <ComponentPicker
          meta={meta}
          inputRef={pickerRef}
          inInventory={(key) => inventory.has(key)}
          onPick={addComponent}
        />
        {shown.length === 0 ? (
          <p className={styles.muted}>
            Busca lo que tienes, pulsa Enter para añadirlo y pon cuántas unidades hay.
          </p>
        ) : (
          <ul className={styles.inventoryRows}>
            {shown.map(({ componente: key, cantidad }) => {
              const nombre = index.components.get(key)?.nombre ?? key;
              return (
                <li key={key} className={styles.inventoryRow}>
                  <Link className={styles.inventoryName} to={link(componentParams(key))}>
                    {nombre}
                  </Link>
                  <div className={styles.stepper}>
                    <button
                      type="button"
                      className={styles.stepButton}
                      aria-label={`Una unidad menos de ${nombre}`}
                      onClick={() => setUnits(key, cantidad - 1)}
                    >
                      −
                    </button>
                    <input
                      ref={(element) => {
                        if (!element) {
                          inputs.current.delete(key);
                          return;
                        }
                        inputs.current.set(key, element);
                        if (pendingFocusRef.current === key) {
                          pendingFocusRef.current = undefined;
                          element.focus();
                          element.select();
                        }
                      }}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={MAX_UNITS}
                      step={1}
                      className={styles.quantityInput}
                      aria-label={`Unidades de ${nombre}`}
                      value={cantidad}
                      onFocus={(event) => event.target.select()}
                      onChange={(event) => setUnits(key, event.target.valueAsNumber)}
                      onKeyDown={(event) => {
                        // Back to the search, to add the next one.
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          pickerRef.current?.focus();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className={styles.stepButton}
                      aria-label={`Una unidad más de ${nombre}`}
                      onClick={() => setUnits(key, cantidad + 1)}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className={`${styles.stepButton} ${styles.removeButton}`}
                      aria-label={`Quitar ${nombre} del inventario`}
                      title="Quitar"
                      onClick={() => removeComponent(key)}
                    >
                      ×
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={styles.results} aria-labelledby={resultsId}>
        <h2 id={resultsId} className="visually-hidden">
          Qué puedes fabricar
        </h2>
        <p className="visually-hidden" aria-live="polite">
          {summary}
        </p>
        {empty && (
          <p className={styles.muted}>
            Con el inventario vacío no hay nada que calcular: añade componentes a la izquierda.
          </p>
        )}

        <ResultBlock
          title="Puedes hacer ya"
          count={ready.length}
          empty="Nada, solo con lo que tienes y sin fabricar antes nada intermedio."
        >
          {ready.map(({ recipe: id, veces }) => {
            const recipe = index.recipes.get(id);
            return (
              <li key={id} className={styles.result}>
                <div className={styles.resultHead}>
                  <Link className={styles.resultName} to={link(recipeParams(id))}>
                    {nameOf(id)}
                  </Link>
                  <span className={styles.pill}>{timesText(veces)}</span>
                </div>
                {recipe && <p className={styles.resultMeta}>{levelAndDc(recipe)}</p>}
              </li>
            );
          })}
        </ResultBlock>

        <ResultBlock
          title="Encadenando"
          count={chained.length}
          empty="Nada que salga fabricando antes lo intermedio con lo que tienes."
        >
          {chained.map(({ recipe: id, veces, steps }) => (
            <li key={id} className={styles.result}>
              <div className={styles.resultHead}>
                <Link className={styles.resultName} to={link(recipeParams(id))}>
                  {nameOf(id)}
                </Link>
                <span className={styles.pill}>{timesText(veces)}</span>
              </div>
              <ol className={styles.chain} aria-label={`Pasos para ${nameOf(id)}`}>
                {steps.map((step, position) => (
                  <li key={`${step.recipe}-${position}`}>
                    {position > 0 && (
                      <span className={styles.arrow} aria-hidden="true">
                        →
                      </span>
                    )}
                    <span className={styles.stepNumber}>{`${position + 1}.`}</span>
                    <Link to={link(recipeParams(step.recipe))}>{nameOf(step.recipe)}</Link>
                    <span className={styles.quantity}>{`×${step.veces}`}</span>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ResultBlock>

        <ResultBlock
          title="Te falta poco"
          count={almost.length}
          empty="Nada a lo que le falten uno o dos componentes."
        >
          {almost.map(({ recipe: id, missing }) => {
            const recipe = index.recipes.get(id);
            return (
              <li key={id} className={styles.result}>
                <div className={styles.resultHead}>
                  <Link className={styles.resultName} to={link(recipeParams(id))}>
                    {nameOf(id)}
                  </Link>
                  {recipe && !recipe.disponible && (
                    <span className={styles.badge}>No disponible</span>
                  )}
                </div>
                <div className={styles.missing}>
                  <span className={styles.missingLabel}>Falta</span>
                  <ul className={styles.components}>
                    {missing.map(({ key, nombre, cantidad }) => (
                      <li key={key}>
                        <ComponentChip
                          nombre={nombre}
                          cantidad={cantidad}
                          crafted={(index.components.get(key)?.producers.length ?? 0) > 0}
                          to={link(componentParams(key))}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            );
          })}
        </ResultBlock>
      </section>
    </div>
  );
}

function ResultBlock({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section className={styles.resultBlock} aria-labelledby={id}>
      <h3 id={id} className={styles.blockTitle}>
        {title}{' '}
        <span className={styles.blockCount}>{`· ${plural(count, 'receta', 'recetas')}`}</span>
      </h3>
      {count === 0 ? (
        <p className={styles.muted}>{empty}</p>
      ) : (
        <ul className={styles.resultList}>{children}</ul>
      )}
    </section>
  );
}

interface ComponentPickerProps {
  meta: OficioMeta;
  inputRef: RefObject<HTMLInputElement | null>;
  inInventory: (key: string) => boolean;
  onPick: (key: string) => void;
}

/**
 * A combobox over the catalog of components: type, move with the arrows, Enter adds the
 * highlighted one (or goes to it when it is already in the inventory), Escape closes.
 */
function ComponentPicker({ meta, inputRef, inInventory, onPick }: ComponentPickerProps) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputId = useId();
  const listId = useId();
  const terms = useMemo(() => queryTerms(text), [text]);
  const options = useMemo(() => matchComponents(meta, terms), [meta, terms]);
  const expanded = open && options.length > 0;
  const activeIndex = Math.min(active, options.length - 1);
  const activeOption: CatalogComponent | undefined = options[activeIndex];
  const optionId = (key: string) => `${listId}-${key}`;

  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (!expanded) return;
    listRef.current
      ?.querySelector<HTMLElement>('[aria-selected="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [expanded, activeIndex]);

  function pick(component: CatalogComponent) {
    setText('');
    setOpen(false);
    setActive(0);
    onPick(component.key);
  }

  function move(step: number) {
    if (options.length === 0) return;
    setOpen(true);
    setActive((activeIndex + step + options.length) % options.length);
  }

  return (
    <div className={styles.picker}>
      <label htmlFor={inputId} className={styles.pickerLabel}>
        Añadir componente
      </label>
      <div className={styles.search}>
        <svg
          className={styles.searchIcon}
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          strokeLinecap="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        <input
          id={inputId}
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={expanded && activeOption ? optionId(activeOption.key) : undefined}
          className={styles.searchInput}
          value={text}
          placeholder="Busca un componente…"
          autoComplete="off"
          onChange={(event) => {
            setText(event.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              move(1);
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              move(-1);
            } else if (event.key === 'Enter' && expanded && activeOption) {
              event.preventDefault();
              pick(activeOption);
            } else if (event.key === 'Escape' && (expanded || text)) {
              event.preventDefault();
              if (expanded) setOpen(false);
              else setText('');
            }
          }}
        />
      </div>
      <ul
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label="Componentes"
        className={styles.options}
        hidden={!expanded}
      >
        {options.map((component, position) => (
          <li
            key={component.key}
            id={optionId(component.key)}
            role="option"
            aria-selected={position === activeIndex}
            className={styles.option}
            // Keeps the focus in the input.
            onMouseDown={(event) => event.preventDefault()}
            onMouseMove={() => {
              if (position !== activeIndex) setActive(position);
            }}
            onClick={() => pick(component)}
          >
            <span>
              <Highlighted text={component.nombre} terms={terms} />
            </span>
            <span className={styles.optionMeta}>
              {inInventory(component.key) ? 'en el inventario' : familyLabel(component.familia)}
            </span>
          </li>
        ))}
      </ul>
      {open && terms.length > 0 && options.length === 0 && (
        <p className={styles.pickerEmpty}>Ningún componente de este oficio se llama así.</p>
      )}
    </div>
  );
}
