import { useId } from 'react';
import type { LabeledBlock } from '@/content/post-structure';
import { MarkdownBody } from './EntryBody';
import styles from './ThematicBlocks.module.css';

interface BlockIndexProps {
  blocks: readonly { id: string; label: string }[];
  /** The heading of the index, e.g. 'Índice'. */
  title: string;
}

/** The index of a text's thematic blocks: one link to the anchor of each. */
export function BlockIndex({ blocks, title }: BlockIndexProps) {
  const headingId = useId();
  return (
    <nav className={styles.index} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.indexTitle}>
        {title}
      </h2>
      <ol className={styles.indexList}>
        {blocks.map(({ id, label }) => (
          <li key={id}>
            <a className={styles.indexLink} href={`#${id}`}>
              {label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

interface BlockSectionsProps {
  blocks: readonly LabeledBlock[];
  /** Normalized search terms to wrap in <mark>. */
  terms?: readonly string[];
}

/** Each block under its anchor, so the index and a search result can lead to it. */
export function BlockSections({ blocks, terms }: BlockSectionsProps) {
  return (
    <div className={styles.blocks}>
      {blocks.map((block) => (
        <section key={block.id} id={block.id} className={styles.block} aria-label={block.label}>
          <MarkdownBody markdown={block.markdown} highlight={terms} />
        </section>
      ))}
    </div>
  );
}
