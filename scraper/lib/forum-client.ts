import { existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import type { APIRequestContext, Browser } from '@playwright/test';
import { openForumBrowser } from '../browser';
import { AUTH_FILE, REQUEST_DELAY_MS } from '../config';
import { isLoggedOutPage } from './session';

/** Expected stop: printed without a stack trace. */
export class CrawlStop extends Error {}

export const SESSION_EXPIRED = 'Sesión caducada: ejecuta npm run scrape:login';

export interface ForumResponse {
  url: string;
  status: number;
  html: string;
}

/**
 * One request at a time with the saved session, at least REQUEST_DELAY_MS apart. The browser is
 * opened on the first request, so a run that finds everything on disk never touches the forum.
 */
export class ForumClient {
  private browser?: Browser;
  private request?: APIRequestContext;
  private lastRequestAt = 0;

  /** GET `url`; stops with SESSION_EXPIRED when the forum answers with the login or no-access page. */
  async get(url: string): Promise<ForumResponse> {
    if (!this.request) {
      if (!existsSync(AUTH_FILE)) {
        throw new CrawlStop('No hay sesión guardada: ejecuta npm run scrape:login');
      }
      // The context's request API sends the session cookies and the importer's user agent:
      // one request per page, without images, styles or scripts.
      const opened = await openForumBrowser({ headless: true, storageState: AUTH_FILE });
      this.browser = opened.browser;
      this.request = opened.context.request;
    }
    await sleep(Math.max(0, this.lastRequestAt + REQUEST_DELAY_MS - Date.now()));
    const response = await this.request.get(url);
    this.lastRequestAt = Date.now();
    const html = await response.text();
    if (isLoggedOutPage(response.url(), html)) throw new CrawlStop(SESSION_EXPIRED);
    return { url: response.url(), status: response.status(), html };
  }

  async close(): Promise<void> {
    await this.browser?.close();
  }
}
