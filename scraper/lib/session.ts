import { ACCESS_DENIED_TEXT, LOGIN_PATH } from '../config';

/** True when the forum answered with the login screen or the "no access" notice instead of content. */
export function isLoggedOutPage(url: string, html: string): boolean {
  return new URL(url).pathname === LOGIN_PATH || html.includes(ACCESS_DENIED_TEXT);
}
