import { fileURLToPath } from 'node:url';
import type { FrontmatterOf } from '../src/content/types';

// Everything the importer knows about the forum lives here, so a change in its URLs or HTML
// is fixed in one place. Asgoria's forum runs on WordPress + Asgaros Forum.

// ---------------------------------------------------------------------------------------------
// Site and session
// ---------------------------------------------------------------------------------------------

/** Site root; the WordPress session cookies are scoped to it. */
export const SITE_URL = 'https://asgoria.com.ar/';

/** Thread used by the spike; the login script also reads it to check that the session works. */
export const SPIKE_THREAD_URL = 'https://asgoria.com.ar/foro/topic/einar-eriksson-fernando10100';

/** Standard WordPress login; `redirect_to` sends the browser to the thread once logged in. */
export const LOGIN_URL = `${SITE_URL}wp-login.php?redirect_to=${encodeURIComponent(SPIKE_THREAD_URL)}`;

/** Path of the login screen, which is where the forum sends visitors without a session. */
export const LOGIN_PATH = '/wp-login.php';

/** Asgaros shows this notice (untranslated) instead of the thread when there is no access. */
export const ACCESS_DENIED_TEXT = 'Sorry, you cannot access this area';

/** Name prefix of the cookie WordPress sets after login. Only the name is checked, never the value. */
export const LOGGED_IN_COOKIE_PREFIX = 'wordpress_logged_in_';

/** How long the login window waits for the human. */
export const LOGIN_TIMEOUT_MS = 5 * 60_000;

/** Pause between local checks (cookies) while waiting for the login. */
export const LOGIN_POLL_MS = 1_000;

/** Minimum gap between requests to the thread while checking a fresh session. */
export const LOGIN_RECHECK_MS = 5_000;

/** Appended to Chromium's user agent so the forum admins can tell the importer apart in their logs. */
export const USER_AGENT_TAG = 'GrimorioDM-importer/0.1';

/** Saved session (cookies). Gitignored: never print it, read it or commit it. */
export const AUTH_FILE = fileURLToPath(new URL('./auth.json', import.meta.url));

// ---------------------------------------------------------------------------------------------
// Crawl
// ---------------------------------------------------------------------------------------------

/**
 * Only threads of this forum can be crawled: https://asgoria.com.ar/foro/topic/<slug>. Slugs
 * keep the underscores of account names ("…-murder_zombie").
 */
export const THREAD_URL_PATTERN = /^https:\/\/asgoria\.com\.ar\/foro\/topic\/([a-z0-9_-]+)\/?$/;

/** Kinds of thread the importer knows; each one has its own folder in raw/ and in _inbox/. */
export const THREAD_KINDS = ['pj', 'cronica'] as const;

/** Pause between two requests to the forum. */
export const REQUEST_DELAY_MS = 1_500;

/** Safety cap on the pages of one thread (Einar's has 10). */
export const MAX_PAGES = 50;

/** Everything downloaded goes here: raw/<kind>/<thread-slug>/page-NN.html. Gitignored. */
export const RAW_DIR = fileURLToPath(new URL('./raw/', import.meta.url));

/** Drafts for the DMs to review. The app and `validate` skip every folder starting with '_'. */
export const INBOX_DIR = fileURLToPath(new URL('../content/_inbox/', import.meta.url));

// ---------------------------------------------------------------------------------------------
// PJ subforums: both are treated as one list
// ---------------------------------------------------------------------------------------------

/**
 * The PJ authorization threads live in these two subforums; `id` is stored in _index.json and
 * `sexo` is what a PJ gets when its form leaves the field empty.
 */
export const PJ_SUBFORUMS = [
  { id: 'personajes', url: 'https://asgoria.com.ar/foro/forum/personajes', sexo: 'Masculino' },
  {
    id: 'personajes-femeninos',
    url: 'https://asgoria.com.ar/foro/forum/personajes-femeninos',
    sexo: 'Femenino',
  },
] as const;

/** Safety cap on the pages of one subforum listing. */
export const MAX_LISTING_PAGES = 100;

// ---------------------------------------------------------------------------------------------
// Subforum listing (Asgaros Forum)
// ---------------------------------------------------------------------------------------------
//
// <div id="af-wrapper">
//   <div class="pages"><strong>Página 1 de 4</strong><a href="…?part=2">Siguiente <i class="fa-step-forward"></i></a></div>
//   <div class="content-element topic topic-normal">
//     <div class="topic-name"><a href="https://asgoria.com.ar/foro/topic/<slug>">Nombre ( Cuenta )</a>…</div>
//     <div class="topic-stats"><span class="topic-stats-posts">12 Respuestas</span>…</div>
//     <div class="topic-poster"><div class="forum-poster-summary"><a href="…#postid-9254">hace 4 semanas</a><br><small>…autor…</small></div></div>
//   </div>
// </div>
//
// Pagination reuses SELECTORS.pageCounter and SELECTORS.nextPageIcon.

export const LISTING_SELECTORS = {
  /** One row per thread (sticky ones included; convert-all excludes the ones of no PJ). */
  topic: '#af-wrapper .topic',
  /** Link to the thread, with its title as text. */
  topicLink: '.topic-name a[href*="/foro/topic/"]',
  /** "12 Respuestas"; the number is found with REPLIES_PATTERN. */
  replies: '.topic-stats',
  /**
   * Date of the last post: relative ("hace 4 semanas"), so it is kept as text in `lastPostAgo`.
   * If the forum ever shows an absolute date, POST_DATE_PATTERN turns it into `lastPostAt`.
   */
  lastPostDate: '.topic-poster .forum-poster-summary > a',
} as const;

/** "12 Respuestas", "1 respuesta", "12 Replies". */
export const REPLIES_PATTERN = /(\d[\d.,]*)\s*(?:respuestas?|replies|reply)/i;

/** Discovery output: one list with the threads of both subforums. */
export const PJ_INDEX_FILE = fileURLToPath(new URL('./raw/pj/_index.json', import.meta.url));

/** One line per thread crawled by `scrape:pjs`. */
export const PJ_CRAWL_LOG = fileURLToPath(new URL('./raw/pj/_crawl.log', import.meta.url));

/** Report of the last `scrape:convert-all`. */
export const PJ_CONVERT_REPORT = fileURLToPath(
  new URL('./raw/pj/_convert-report.txt', import.meta.url),
);

/** Where `scrape:convert-all` writes the PJ entries (real entries, not drafts). */
export const PJ_CONTENT_DIR = fileURLToPath(new URL('../content/pj/', import.meta.url));

// ---------------------------------------------------------------------------------------------
// Thread page (Asgaros Forum)
// ---------------------------------------------------------------------------------------------
//
// <div id="af-wrapper">
//   <h1 class="main-title">Einar Eriksson ( Fernando10100 )</h1>
//   <div class="pages"><strong>Página 1 de 10</strong><a href="…?part=2">Siguiente <i class="fa-step-forward"></i></a>…</div>
//   <div id="postid-193" class="post-element">
//     <div class="post-author-block-name"><a class="profile-link">She Wolf</a><span class="mention-nice-name">@she-wolf</span></div>
//     <div class="post-wrapper">
//       <div class="forum-post-header"><div class="forum-post-date"><a href="…">#5</a>· 26/12/2022, 2:01 am</div></div>
//       <div class="post-message">
//         <div id="post-quote-container-193" style="display: none">…the whole post again…</div>
//         …content…
//       </div>
//       <div class="post-footer">
//         <div class="post-reactions">…</div>
//         <div class="post-meta"><span class="post-edit-date">Last edited on 26/12/2022, 2:08 am by <a>She Wolf</a></span></div>
//       </div>
//       <div class="post-reactions-summary">…</div>
//       <div class="signature">…</div>
//     </div>
//   </div>
// </div>

export const SELECTORS = {
  /** Canonical URL of the thread (page 1), in <head>. */
  canonical: 'link[rel="canonical"]',
  /** Thread title. */
  title: '#af-wrapper .main-title',
  /** "Página 1 de 10", above and below the posts. */
  pageCounter: '#af-wrapper .pages strong',
  /** Icon inside the "Siguiente" link; the link is its closest <a>. Absent on the last page. */
  nextPageIcon: '#af-wrapper .pages a .fa-step-forward',
  /**
   * One element per post. Posts are direct children of the wrapper; the selectors below start
   * at the post (:scope) and follow its own frame, so a post pasted inside another one is never
   * mistaken for the real thing.
   */
  post: '#af-wrapper > .post-element',
  /** "#5" link at the start of the date line. */
  postNumber: ':scope > .post-wrapper > .forum-post-header .forum-post-date a',
  /** Date line, "#5· 26/12/2022, 2:01 am"; the date is found with POST_DATE_PATTERN. */
  postDate: ':scope > .post-wrapper > .forum-post-header .forum-post-date',
  /** Visible author name (a link to the forum profile). */
  authorName: ':scope > .forum-post-header-container .post-author-block-name .profile-link',
  /** "@she-wolf", next to the name. */
  authorHandle: ':scope > .forum-post-header-container .post-author-block-name .mention-nice-name',
  /** Forum groups of the author ("Staff", "DM"), as tags under the name. */
  authorGroups: ':scope > .forum-post-header-container .post-author-block-group .af-usergroup-tag',
  /** "Last edited on 26/12/2022, 2:08 am by She Wolf". Only on edited posts. */
  editNote: ':scope > .post-wrapper > .post-footer .post-meta .post-edit-date',
  /**
   * Post content. Footer (reactions, "Last edited…") and signature (div.signature, e.g. She
   * Wolf's "One look in her lusting eyes…") are siblings of it, so they stay out.
   */
  body: ':scope > .post-wrapper > .post-message',
  /**
   * Removed from the content. Asgaros repeats every post inside a hidden quote container (for
   * the "Cita" button); signature and reactions are listed too in case a theme moves them in.
   */
  bodyNoise: [
    '[id^="post-quote-container-"]',
    '.signature',
    '.post-reactions',
    '.post-reactions-summary',
  ],
} as const;

/** "30/11/2022, 12:32 am": day/month/year and a 12-hour clock. */
export const POST_DATE_PATTERN =
  /(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2})\s*([ap])\.?\s?m\b/i;

/** "#5" */
export const POST_NUMBER_PATTERN = /#(\d+)/;

/** "Last edited on 26/12/2022, 2:08 am by She Wolf" */
export const EDIT_NOTE_PATTERN = /Last edited on\s+(.+?)\s+by\s+(.+)$/i;

/** "Página 1 de 10" */
export const PAGE_COUNTER_PATTERN = /P[aá]gina\s+(\d+)\s+de\s+(\d+)/i;

// ---------------------------------------------------------------------------------------------
// Post content cleanup (lib/clean-post.ts)
// ---------------------------------------------------------------------------------------------
//
// Bodies are mostly TinyMCE paragraphs, but DMs also paste whole forum posts and Discord
// messages into them, and the markup of both comes along.

export const CLEANUP = {
  /**
   * Forum interface that turns up inside a body when a post is pasted into another: reactions
   * ("Click for thumbs up"), "Cita" and report buttons ("Click to report post"), "Last edited…"
   * notes, author boxes, signatures and the hidden copy used for quoting.
   */
  forumChrome: [
    '[id^="post-quote-container-"]',
    '.forum-post-header-container',
    '.post-author',
    '.forum-post-header',
    '.forum-post-menu',
    '.forum-editor-quote-button',
    '.report-link',
    '.post-footer',
    '.post-reactions',
    '.post-reactions-summary',
    '.post-meta',
    '.signature',
    '.screen-reader-text',
  ],
  /** Content of a forum post pasted into another one… */
  pastedPostBody: '.post-message',
  /** …the whole pasted post, when its frame came along… */
  pastedPost: '.post-element',
  /** …and its author, found inside that frame. */
  pastedPostAuthor: '.post-author-block-name .profile-link',
  /** "Cita de Li Zakien en 24/10/2023, 5:52 pm", first child of an Asgaros quote <blockquote>. */
  quoteTitle: '.quotetitle',
  /** Author link inside the quote title. */
  quoteAuthor: '.profile-link',
  /**
   * Messages pasted from Discord. Their classes end in a hash that changes between Discord
   * versions (message-2CShn3, message_d5deea), so only the prefix is matched.
   */
  discordPaste: [
    '[class*="scrollerInner"]',
    '[class*="messageListItem"]',
    '[class*="message-"]',
    '[class*="message_"]',
    '[class*="cozyMessage"]',
    '[class*="contents-"]',
    '[class*="contents_"]',
    '[class*="markup-"]',
    '[class*="markup_"]',
    '[class*="messageContent"]',
    '[class*="buttonContainer"]',
  ],
  /**
   * Removed from Discord pastes: times ("[1:20 AM]"), "(edited)" marks and icons. Buttons,
   * popovers and emoji boxes are not removed but unwrapped, because a broken paste can leave
   * message text inside them (Einar's #121 and #125); the empty ones produce nothing.
   */
  discordChrome: [
    '[class*="timestamp"]',
    '[class*="TimeStamp"]',
    '[class*="edited-"]',
    '[class*="edited_"]',
    'svg',
    'img[class*="emoji"]',
  ],
} as const;

/** "(editado)" or "(edited)" closing a line: Discord's edit mark, copied along with the text. */
export const DISCORD_EDIT_MARK = /[ \t]*\((?:editado|edited)\)(?=[ \t]*$)/gim;

/** Quote title without a profile link: "Cita de <autor> en …" or "Quote from <autor> on …". */
export const QUOTE_TITLE_PATTERN = /^(?:Cita de|Quote from)\s+(.+?)\s+(?:en|on)\s+\d/i;

/**
 * Links to Discord are dropped: message links point to a private server and attachment links
 * expire within hours (the screenshot in Einar's #146 expired in April 2025). An image hosted
 * there becomes IMAGE_UNAVAILABLE.
 */
export const DISCORD_HOST_PATTERN =
  /(^|\.)(discord\.com|discord\.gg|discordapp\.com|discordapp\.net)$/i;

/** Text of the link that replaces an image (images are linked, never embedded or downloaded). */
export const IMAGE_LABEL = 'Imagen';

export const IMAGE_UNAVAILABLE = '(imagen no disponible: enlace caducado)';

// ---------------------------------------------------------------------------------------------
// Personal data: a safety net on top of dropping the form's email and Discord answers
// ---------------------------------------------------------------------------------------------

export const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

export const EMAIL_PLACEHOLDER = '[email eliminado]';

/** Old-style Discord tags, "nombre#1234". */
export const DISCORD_TAG_PATTERN = /[^\s#@:()[\]<>"'`]{2,32}#\d{4}\b/g;

export const DISCORD_TAG_PLACEHOLDER = '[usuario eliminado]';

// ---------------------------------------------------------------------------------------------
// Character sheet: post #1 of a PJ thread
// ---------------------------------------------------------------------------------------------
//
// The authorization form is one <table> per field, preceded by a "*** AUTORIZACIÓN DE
// PERSONAJE ***" paragraph that is ignored:
//
// <table><tbody>
//   <tr><td><strong>Raza del Personaje</strong></td></tr>
//   <tr><td>Humano</td></tr>
// </tbody></table>
//
// Labels are written here as the form shows them; they are compared ignoring case, accents,
// "(opcional)" and a trailing colon, so a reworded or reordered form still matches.
//
// Variants found in the forum:
// - The form pasted from the confirmation email (Elae, Avvar and 18 more): the field tables
//   are nested inside the email's layout tables, sometimes under a header image.
// - Fields wrapped in a <div> (Korhran, Sir William): only some tables are direct children.
// - Label and answer in one cell (Soirfrir's deity): <td><strong>Deidad Predilecta</strong>
//   <p>Aegir.</p></td>.
// - "Nombre: …" / "Raza: …" written as text, one label per line, with no tables at all.

export const SHEET_SELECTORS = {
  /** One field of the form: any table with no table inside, however deep the layout puts it. */
  field: 'table',
  /** The label: first row of the field. */
  label: 'tr:first-child',
  /** The answer: cells of the remaining rows. */
  value: 'tr:not(:first-child) > td',
  /** In a one-row field, the label written in bold before the answer, in the same cell. */
  inlineLabel: ':scope > strong:first-child, :scope > b:first-child',
} as const;

/**
 * "Raza: Humano" in a form written as text: a short label, a colon and the answer. Lines that
 * follow without a label of their own belong to the same answer.
 */
export const SHEET_TEXT_LABEL = /^\s*([^:\n]{2,40}?)\s*:\s*(.*)$/;

/** Short answers that go to the frontmatter. The short labels are for forms written as text. */
export const SHEET_FIELDS = {
  title: ['Nombre y apellido del personaje', 'Nombre del personaje', 'Nombre'],
  cuenta_nwn: ['Cuenta de Neverwinter Nights', 'Cuenta de NWN', 'Cuenta'],
  sexo: ['Sexo del Personaje', 'Sexo'],
  raza: ['Raza del Personaje', 'Raza'],
  alineamiento: ['Alineamiento del Personaje', 'Alineamiento'],
  deidad: ['Deidad Predilecta', 'Deidad'],
} as const;

/** Class answers, in this order, collected into `clases`; each with the labels it may have. */
export const SHEET_CLASS_LABELS = [
  ['Clase Principal', 'Clase'],
  ['Clase Secundaria'],
  ['Clase Terciaria'],
] as const;

/** Class answers that mean "none" (compared normalized and without trailing dots). */
export const NO_CLASS_ANSWER = /^(no se|ningun[oa]?|nada|n\/a|-+)?$/;

/** Long answers that become sections of the body, in this order and with these headings. */
export const SHEET_SECTIONS = [
  { heading: 'Descripción Física', labels: ['Descripción Física', 'Descripción', 'Apariencia'] },
  { heading: 'Origen', labels: ['Origen', 'Historia', 'Trasfondo'] },
  { heading: 'Objetivos', labels: ['Objetivos'] },
  { heading: 'Otras Notas', labels: ['Otras Notas'] },
] as const;

/**
 * Personal data of the player (email, Discord, forum user). These answers are dropped: they
 * stay in scraper/raw/ and never reach a draft. Matched against the normalized label.
 */
export const SHEET_DISCARDED_LABEL = /correo|e-?mail|discord|foro|usuario/;

/** Post #1 is an authorization form when at least this many known labels have an answer. */
export const MIN_FORM_LABELS = 3;

// ---------------------------------------------------------------------------------------------
// Threads of the PJ subforums: none is lost
// ---------------------------------------------------------------------------------------------
//
// Every thread of _index.json is downloaded whole and ends in one group of the report: imported
// with its form, imported as 'ficha-libre' (post #1 has no form that can be read), excluded
// (clearly no PJ) or failed.

/** Tag of a PJ whose post #1 has no form: its whole text goes under FREE_SHEET_HEADING. */
export const FREE_SHEET_TAG = 'ficha-libre';

export const FREE_SHEET_HEADING = 'Trasfondo';

/** Forum groups (af-usergroup-tag) whose members are staff. */
export const STAFF_GROUPS = ['Staff', 'DM'];

/**
 * Words of a thread title that announce rules, templates or notices, compared normalized.
 * A thread is excluded only when its title does not follow "Nombre ( Cuenta )" and either its
 * post #1 is by staff or its title has one of these words.
 */
export const NOTICE_TITLE_PATTERN =
  /\b(normas?|reglas?|reglamento|plantillas?|formulario|avisos?|anuncios?|importante|leer|lee esto|leeme|fijado|como (crear|pedir|solicitar))\b/;

/** "Einar Eriksson ( Fernando10100 )": name and account, when the form lacks them. */
export const THREAD_TITLE_PATTERN = /^(.*?)\s*\(\s*([^()]*?)\s*\)\s*$/;

/** `cuenta_nwn` when neither the form nor the thread title give it (the field is required). */
export const UNKNOWN_ACCOUNT = 'desconocida';

/** Answers to "Sexo del Personaje", compared normalized; anything else is kept as written. */
export const SEXO_PATTERNS = [
  { value: 'Masculino', pattern: /^(masc|hombre|varon|macho|m\.?$)/ },
  { value: 'Femenino', pattern: /^(fem|mujer|hembra|f\.?$)/ },
] as const;

/** A new PJ is 'activo' when the newest post of its thread is younger than this. */
export const ACTIVE_DAYS = 180;

// ---------------------------------------------------------------------------------------------
// Tracked topics: single threads kept up to date by `scrape:topics`
// ---------------------------------------------------------------------------------------------

/** A value of lore's `categoria`. */
export type LoreCategory = FrontmatterOf<'lore'>['categoria'];

/** Region of a post that `split` could not place: it goes to the topic's general entry. */
export const GENERAL_REGION = 'general';

export interface TopicRegion {
  /** Slug of the region's zona; its entry is content/cronica/situacion-<slug>.md. */
  slug: string;
  /** Its name as the thread writes it ('Dhu Nun'): title of the entry and of a created zona. */
  title: string;
  /** Places, NPCs and factions that place a post in the region ('Hadka', 'Vinter'). */
  keywords?: readonly string[];
}

export interface TopicSplit {
  /**
   * The regions the thread talks about. A bold line that is only a region's name ('**Karak**',
   * '**En Karak:**') starts that region's part of a post; a post without such lines goes,
   * whole, to the region whose name and keywords it mentions most.
   */
  regions: readonly TopicRegion[];
}

interface TopicBase {
  /** https://asgoria.com.ar/foro/topic/<slug> */
  url: string;
  /** Name of the entry file, content/<type>/<slug>.md; by default the thread's slug. */
  slug?: string;
  /** Slug of the zona the topic is about; a minimal zona entry is created when it is missing. */
  zona?: string;
  /** Title of that zona entry when it has to be created; by default the slug, capitalized. */
  zonaTitle?: string;
  /**
   * Title of the entry when it is created; by default the thread title. Kept on reimport. With
   * `split`, the title of the general entry, the one for posts without a region.
   */
  title?: string;
}

/** A thread on a region or a plot: content/cronica/<slug>.md, its post #1 the '## Situación'. */
export interface CronicaTopic extends TopicBase {
  type: 'cronica';
  /** A thread on several regions: one entry per region (content/README.md). */
  split?: TopicSplit;
  /**
   * Region of a post by its number, decided by a DM: a region slug of `split` or
   * GENERAL_REGION. It wins over what `split` deduces, on every reimport.
   */
  assign?: Readonly<Record<number, string>>;
}

/** A thread of lore: content/lore/<slug>.md, its post #1 the '## Contenido'. */
export interface LoreTopic extends TopicBase {
  type: 'lore';
  /** Its `categoria` when the entry is created; kept on reimport. */
  categoria: LoreCategory;
}

/**
 * A tracked topic becomes an entry of its `type`, written to content/<type>/<slug>.md. The types
 * are the app's THREAD_TYPES: post #1 under the type's main heading, the replies as annexes.
 */
export type TrackedTopic = CronicaTopic | LoreTopic;

/** Threads that describe a region, a plot or a piece of lore. Add one and run `npm run scrape:topics`. */
export const TRACKED_TOPICS: readonly TrackedTopic[] = [
  {
    url: 'https://asgoria.com.ar/foro/topic/topico-situacion-actual-gadelica',
    type: 'cronica',
    slug: 'situacion-gadelica',
    zona: 'gadelica',
    zonaTitle: 'Gadélica',
    title: 'Situación actual de Gadélica',
  },
  {
    url: 'https://asgoria.com.ar/foro/topic/situacion-otras-regiones',
    type: 'cronica',
    title: 'Situación general de otras regiones',
    split: {
      regions: [
        { slug: 'arvandor', title: 'Arvandor' },
        { slug: 'dhu-nun', title: 'Dhu Nun' },
        { slug: 'karak', title: 'Karak' },
        { slug: 'loren', title: 'Loren' },
        { slug: 'monteverde', title: 'Monteverde' },
        // The Mrag are the people of Mraganur, not another region.
        { slug: 'mraganur', title: 'Mraganur', keywords: ['Mrag', 'Hadka', 'Vinter', 'Grimbor'] },
      ],
    },
    // Decided by the DMs on 2026-10-13: the doubtful posts go to Mraganur, except the druid
    // circle of Loren (#4) and the role tips for the Arboleda (#5).
    assign: { 2: 'mraganur', 4: 'loren', 5: 'loren', 6: 'mraganur' },
  },
  {
    url: 'https://asgoria.com.ar/foro/topic/sobre-el-cosmos-informacion-para-dms',
    type: 'lore',
    categoria: 'cosmologia',
    slug: 'cosmos',
    title: 'El cosmos de Asgoria',
  },
];

/** The content folder: real entries, which `scrape:topics` writes to content/<type>/. */
export const CONTENT_DIR = fileURLToPath(new URL('../content/', import.meta.url));
