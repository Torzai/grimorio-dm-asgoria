import { setTimeout as sleep } from 'node:timers/promises';
import { openForumBrowser } from './browser';
import {
  AUTH_FILE,
  LOGGED_IN_COOKIE_PREFIX,
  LOGIN_POLL_MS,
  LOGIN_RECHECK_MS,
  LOGIN_TIMEOUT_MS,
  LOGIN_URL,
  SITE_URL,
  SPIKE_THREAD_URL,
} from './config';
import { isLoggedOutPage } from './lib/session';

// npm run scrape:login
// Opens a visible Chromium on the forum's login page. The human types their credentials there;
// this script never sees, fills or stores the password. Once the session can read the thread,
// its cookies are saved to scraper/auth.json (gitignored) for the crawler.

const { browser, context } = await openForumBrowser({ headless: false });
const page = await context.newPage();
await page.goto(LOGIN_URL);

console.log('Inicia sesión en la ventana de Chromium que se ha abierto. Tienes 5 minutos.');

/** Local check, no request: WordPress has set its session cookie (only the name is looked at). */
async function hasSessionCookie(): Promise<boolean> {
  const cookies = await context.cookies(SITE_URL);
  return cookies.some((cookie) => cookie.name.startsWith(LOGGED_IN_COOKIE_PREFIX));
}

/** One request with the context's cookies: the thread shows content instead of the notice. */
async function canReadThread(): Promise<boolean> {
  const response = await context.request.get(SPIKE_THREAD_URL);
  return response.ok() && !isLoggedOutPage(response.url(), await response.text());
}

type Outcome = 'saved' | 'closed' | 'timeout';

async function waitForSession(): Promise<Outcome> {
  const deadline = Date.now() + LOGIN_TIMEOUT_MS;
  let lastCheck = 0;
  let warnedNoAccess = false;

  while (Date.now() < deadline) {
    if (!browser.isConnected()) return 'closed';
    try {
      if (Date.now() - lastCheck >= LOGIN_RECHECK_MS && (await hasSessionCookie())) {
        lastCheck = Date.now();
        if (await canReadThread()) {
          await context.storageState({ path: AUTH_FILE });
          return 'saved';
        }
        if (!warnedNoAccess) {
          warnedNoAccess = true;
          console.warn(
            'Has iniciado sesión, pero el hilo sigue sin mostrarse. ¿Es la cuenta correcta? ' +
              'Puedes cerrar sesión y entrar con otra en la misma ventana.',
          );
        }
      }
    } catch (error) {
      // Closing the window mid-check makes Playwright throw; anything else is a real error.
      if (!browser.isConnected()) return 'closed';
      throw error;
    }
    await sleep(LOGIN_POLL_MS);
  }
  return 'timeout';
}

const outcome = await waitForSession();

if (outcome === 'saved') {
  console.log('✔ Sesión guardada en scraper/auth.json (ignorado por git; no lo compartas).');
} else if (outcome === 'closed') {
  console.error('✖ Se cerró la ventana antes de terminar. Vuelve a ejecutar npm run scrape:login.');
  process.exitCode = 1;
} else {
  console.error(
    '✖ Han pasado 5 minutos sin detectar la sesión. Vuelve a ejecutar npm run scrape:login.',
  );
  process.exitCode = 1;
}

if (browser.isConnected()) await browser.close();
