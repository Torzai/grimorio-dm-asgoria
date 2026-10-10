import { memo, useMemo, type ComponentProps } from 'react';
import Markdown, { type Components, type ExtraProps, type Options } from 'react-markdown';
import { Link } from 'react-router';
import remarkGfm from 'remark-gfm';
import { remarkWikilinks } from '@/content/remark-wikilinks';
import type { Entry } from '@/content/types';
import { useContent } from '@/content/use-content';
import styles from './EntryBody.module.css';

const BROKEN_LINK_TITLE = 'Enlace roto: no existe ninguna ficha con ese nombre';

/** The marks remark-wikilinks puts on the nodes it creates. */
interface WikilinkMarks {
  'data-wikilink'?: string;
  'data-broken'?: string;
}

type AnchorProps = ComponentProps<'a'> & ExtraProps & WikilinkMarks;
type SpanProps = ComponentProps<'span'> & ExtraProps & WikilinkMarks;

// '//host' is another site, not a path of this one.
const isSitePath = (href: string) => href.startsWith('/') && !href.startsWith('//');
const isExternal = (href: string) => /^(https?:)?\/\//i.test(href);

function MarkdownLink({ href, title, children, 'data-wikilink': wikilink }: AnchorProps) {
  if (href && (wikilink || isSitePath(href))) {
    return (
      <Link to={href} title={title}>
        {children}
      </Link>
    );
  }
  if (href && isExternal(href)) {
    return (
      <a href={href} title={title} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }
  return (
    <a href={href} title={title}>
      {children}
    </a>
  );
}

/** A wikilink that resolves to nothing: shown differently and not clickable. */
function MarkdownSpan({ children, 'data-broken': broken }: SpanProps) {
  if (!broken) return <span>{children}</span>;
  return (
    <span className={styles.broken} title={BROKEN_LINK_TITLE}>
      {children}
    </span>
  );
}

/** Only the page title is an h1, so the one in the Markdown becomes an h2. */
function MarkdownH1({ children }: ComponentProps<'h1'> & ExtraProps) {
  return <h2>{children}</h2>;
}

function MarkdownTable({ children }: ComponentProps<'table'> & ExtraProps) {
  return (
    <div className={styles.tableScroll}>
      <table>{children}</table>
    </div>
  );
}

/** Images are resolved in T10; until then a placeholder, so no request is made. */
function MarkdownImage({ alt }: ComponentProps<'img'> & ExtraProps) {
  return <span className={styles.image}>{alt ? `Imagen: ${alt}` : 'Imagen'}</span>;
}

const components: Components = {
  a: MarkdownLink,
  span: MarkdownSpan,
  h1: MarkdownH1,
  table: MarkdownTable,
  img: MarkdownImage,
};

interface EntryBodyProps {
  entry: Entry;
}

/**
 * The Markdown of an entry: GFM and [[wikilinks]]. No raw HTML is rendered.
 * Memoized, so it renders again only when the entry (or the content) changes, not on every
 * change of the URL's filters.
 */
export const EntryBody = memo(function EntryBody({ entry }: EntryBodyProps) {
  const { links } = useContent();
  const remarkPlugins = useMemo<Options['remarkPlugins']>(
    () => [remarkGfm, [remarkWikilinks, links.resolve]],
    [links.resolve],
  );

  if (!entry.body.trim()) {
    return <p className={styles.empty}>Esta ficha todavía no tiene texto.</p>;
  }
  return (
    <div className={styles.body}>
      <Markdown remarkPlugins={remarkPlugins} components={components}>
        {entry.body}
      </Markdown>
    </div>
  );
});
