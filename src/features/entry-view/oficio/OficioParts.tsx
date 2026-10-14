import { useId, type ReactNode } from 'react';
import { Link, type To } from 'react-router';
import { Highlighted } from '@/features/palette/Highlighted';
import styles from './OficioView.module.css';

/* Pieces shared by the tabs of an oficio. */

interface MasterDetailProps {
  /** Something is open: on narrow screens only the detail shows then, with a way back. */
  selected: boolean;
  master: ReactNode;
  detail: ReactNode;
  back: { to: To; label: string };
}

/** The list on the left, sticky and scrolling on its own; the open item on the right. */
export function MasterDetail({ selected, master, detail, back }: MasterDetailProps) {
  return (
    <div className={styles.masterDetail} data-selected={selected ? '' : undefined}>
      <div className={styles.master}>{master}</div>
      <div className={styles.detail}>
        {selected && (
          <Link className={styles.back} to={back.to}>
            <span aria-hidden="true">←</span> {back.label}
          </Link>
        )}
        {detail}
      </div>
    </div>
  );
}

interface SearchBoxProps {
  label: string;
  value: string;
  placeholder: string;
  /** '12 de 58', read out when it changes; empty while nothing filters. */
  status: string;
  onChange: (value: string) => void;
}

export function SearchBox({ label, value, placeholder, status, onChange }: SearchBoxProps) {
  const id = useId();
  const statusId = useId();
  return (
    <div className={styles.search}>
      <svg
        className={styles.searchIcon}
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        strokeLinecap="round"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-4-4" />
      </svg>
      <label htmlFor={id} className="visually-hidden">
        {label}
      </label>
      <input
        id={id}
        type="search"
        className={styles.searchInput}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        aria-describedby={statusId}
        onChange={(event) => onChange(event.target.value)}
      />
      <span id={statusId} className={styles.count} aria-live="polite">
        {status}
      </span>
    </div>
  );
}

export interface ChipOption {
  value: string;
  label: string;
  count?: number;
}

interface ChipGroupProps {
  label: string;
  options: readonly ChipOption[];
  selected: string | undefined;
  /** The value pressed, or undefined when the pressed chip is pressed again. */
  onSelect: (value: string | undefined) => void;
}

/** A row of toggle chips under a small label: one value at most. */
export function ChipGroup({ label, options, selected, onSelect }: ChipGroupProps) {
  return (
    <div className={styles.chipRow} role="group" aria-label={label}>
      <span className={styles.chipLabel} aria-hidden="true">
        {label}
      </span>
      {options.map(({ value, label: text, count }) => (
        <button
          key={value}
          type="button"
          className={styles.chip}
          aria-pressed={selected === value}
          onClick={() => onSelect(selected === value ? undefined : value)}
        >
          {text}
          {count !== undefined && <span className={styles.chipCount}>{count}</span>}
        </button>
      ))}
    </div>
  );
}

/** A group of rows of a list, under its name and count. */
export function ListSection({
  title,
  count,
  children,
}: {
  title: string;
  count: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section className={styles.listSection} aria-labelledby={id}>
      <h3 id={id} className={styles.listHeading}>
        {title} <span className={styles.listCount}>{count}</span>
      </h3>
      <ul className={styles.rows}>{children}</ul>
    </section>
  );
}

/** A titled part of the open item. */
export function DetailSection({
  title,
  note,
  children,
}: {
  title: string;
  /** A line under the title. */
  note?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section className={styles.detailSection} aria-labelledby={id}>
      <h3 id={id} className={styles.sectionTitle}>
        {title}
      </h3>
      {note && <p className={styles.sectionNote}>{note}</p>}
      {children}
    </section>
  );
}

/** What the detail shows while nothing is open. */
export function DetailEmpty({ title, lead }: { title: string; lead: string }) {
  return (
    <div className={styles.detailEmpty}>
      <p className={styles.detailEmptyTitle}>{title}</p>
      <p className={styles.detailEmptyLead}>{lead}</p>
    </div>
  );
}

interface ComponentChipProps {
  nombre: string;
  cantidad?: number;
  cargado?: boolean;
  /** Some recipe of the oficio makes it: gold, with a hammer. */
  crafted?: boolean;
  /** Its page in the component library. */
  to: To;
  terms?: readonly string[];
}

/** 'Nombre ×N', a link to the component in the library. */
export function ComponentChip({
  nombre,
  cantidad,
  cargado,
  crafted,
  to,
  terms,
}: ComponentChipProps) {
  return (
    <Link
      className={crafted ? `${styles.component} ${styles.crafted}` : styles.component}
      to={to}
      title={crafted ? 'Se fabrica · ver el componente' : 'Ver el componente'}
    >
      {crafted && <HammerIcon />}
      <span>
        {terms ? <Highlighted text={nombre} terms={terms} /> : nombre}
        {/* A no-break space keeps the quantity with its name. */}
        {cantidad !== undefined && <span className={styles.quantity}>&nbsp;×{cantidad}</span>}
      </span>
      {cargado && <span className={styles.charged}>cargado</span>}
      {crafted && <span className="visually-hidden"> (se fabrica)</span>}
    </Link>
  );
}

export function HammerIcon() {
  return (
    <svg
      className={styles.craftIcon}
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 12l-8.4 8.4a2.1 2.1 0 0 1-3-3L12 9" />
      <path d="M17.6 15L22 10.6" />
      <path d="M20.9 11.7l-1.3-1.3a2 2 0 0 1-.6-1.4V7.8l-2.3-2.3A6 6 0 0 0 12.5 3.8H9.6l.9.8a6.2 6.2 0 0 1 2.1 4.6V10l2 2h1.2a2 2 0 0 1 1.4.6l1.3 1.3" />
    </svg>
  );
}
