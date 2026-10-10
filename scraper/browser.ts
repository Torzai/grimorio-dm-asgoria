import { chromium, devices, type Browser, type BrowserContext } from '@playwright/test';
import { USER_AGENT_TAG } from './config';

interface ForumBrowser {
  browser: Browser;
  context: BrowserContext;
}

/**
 * Chromium with the importer's user agent. Login and crawl share it, so the session is always
 * used from the same browser it was created in. Pass `storageState` to reuse a saved session.
 */
export async function openForumBrowser(options: {
  headless: boolean;
  storageState?: string;
}): Promise<ForumBrowser> {
  const browser = await chromium.launch({ headless: options.headless });
  const context = await browser.newContext({
    userAgent: `${devices['Desktop Chrome'].userAgent} ${USER_AGENT_TAG}`,
    storageState: options.storageState,
    // A visible window keeps its own size instead of a fixed 1280×720 page.
    viewport: options.headless ? undefined : null,
  });
  return { browser, context };
}
