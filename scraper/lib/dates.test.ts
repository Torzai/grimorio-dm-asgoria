// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isoDay, localDay, parseForumDate, spanishDay } from './dates';

describe('parseForumDate', () => {
  it('reads day/month/year and a 12-hour clock', () => {
    expect(parseForumDate('16/12/2022, 3:27 am')).toBe('2022-12-16T03:27');
    expect(parseForumDate('05/02/2023, 11:17 pm')).toBe('2023-02-05T23:17');
  });

  it('turns 12:xx am into 00:xx and keeps 12:xx pm at noon', () => {
    expect(parseForumDate('30/11/2022, 12:32 am')).toBe('2022-11-30T00:32');
    expect(parseForumDate('10/03/2021, 12:45 pm')).toBe('2021-03-10T12:45');
  });

  it('finds the date inside the date line of a post', () => {
    expect(parseForumDate('#2· 6/1/2023, 7:49 PM')).toBe('2023-01-06T19:49');
  });

  it('returns undefined when there is no valid date', () => {
    expect(parseForumDate('hace 2 horas')).toBeUndefined();
    expect(parseForumDate('30/11/2022, 13:32 pm')).toBeUndefined();
    expect(parseForumDate('31/13/2022, 1:00 am')).toBeUndefined();
  });
});

describe('date formats', () => {
  it('gives the day in ISO and in Spanish order', () => {
    expect(isoDay('2022-11-30T00:32')).toBe('2022-11-30');
    expect(spanishDay('2022-11-30T00:32')).toBe('30/11/2022');
  });

  it('gives the local date of a Date', () => {
    expect(localDay(new Date(2026, 9, 5, 23, 59))).toBe('2026-10-05');
  });
});
