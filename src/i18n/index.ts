import type { Lang } from '../types';
import { fr } from './fr';
import { rw } from './rw';

/**
 * Translations are keyed by the English text itself, so English needs no
 * dictionary and a missing translation simply shows English.
 * Placeholders look like {name}.
 */
const dictionaries: Record<Lang, Record<string, string>> = { en: {}, fr, rw };

let current: Lang = 'en';

export function setLang(l: Lang) {
  current = l;
  if (typeof document !== 'undefined') document.documentElement.lang = l;
}
export function getLang(): Lang {
  return current;
}

export function t(text: string, vars?: Record<string, string | number>): string {
  let s = dictionaries[current][text] ?? text;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** Picks the singular or plural text by count; both are translation keys. */
export function tn(n: number, one: string, many: string, vars?: Record<string, string | number>): string {
  return t(n === 1 ? one : many, { n, ...vars });
}

/** Marks a string for translation where it is defined; translate it later with t(). */
export const tk = (text: string) => text;

export const LANGS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'rw', label: 'Kinyarwanda' },
  { id: 'fr', label: 'Français' },
];

const MONTHS_RW = ['Mutarama', 'Gashyantare', 'Werurwe', 'Mata', 'Gicurasi', 'Kamena', 'Nyakanga', 'Kanama', 'Nzeri', 'Ukwakira', 'Ugushyingo', 'Ukuboza'];

export function monthName(monthIndex: number, short = false): string {
  if (current === 'rw') {
    const n = MONTHS_RW[monthIndex];
    return short ? n.slice(0, 3) : n;
  }
  return new Date(2000, monthIndex, 1).toLocaleDateString(current === 'fr' ? 'fr-FR' : 'en-GB', { month: short ? 'short' : 'long' });
}

export function numberLocale(): string {
  return 'en-US';
}
