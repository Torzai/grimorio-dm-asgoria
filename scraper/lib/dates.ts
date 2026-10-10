import { POST_DATE_PATTERN } from '../config';

/**
 * Finds a forum date in `text` and returns it as local ISO 'YYYY-MM-DDTHH:mm':
 * '#2· 30/11/2022, 12:32 am' → '2022-11-30T00:32'. Undefined when there is none.
 */
export function parseForumDate(text: string): string | undefined {
  const match = POST_DATE_PATTERN.exec(text);
  if (!match) return undefined;

  const [, day, month, year, hour, minute, meridiem] = match;
  const hour12 = Number(hour);
  if (hour12 < 1 || hour12 > 12 || Number(minute) > 59) return undefined;
  if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > 31) {
    return undefined;
  }

  // 12 am is midnight and 12 pm is noon.
  const hour24 = (hour12 % 12) + (meridiem.toLowerCase() === 'p' ? 12 : 0);
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour24)}:${minute}`;
}

/** '2022-11-30T00:32' → '2022-11-30' */
export function isoDay(dateTime: string): string {
  return dateTime.slice(0, 10);
}

/** '2022-11-30T00:32' → '30/11/2022' */
export function spanishDay(dateTime: string): string {
  const [year, month, day] = isoDay(dateTime).split('-');
  return `${day}/${month}/${year}`;
}

/** Local date as 'YYYY-MM-DD'. */
export function localDay(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function pad(value: string | number): string {
  return String(value).padStart(2, '0');
}
