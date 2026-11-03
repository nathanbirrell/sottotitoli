import type { LookupResult } from './dictionary';
import { DEFAULT_LANGUAGE, type Language } from './languages';

/** Messages from content scripts / popup to the background script. */
export type RuntimeMessage = { type: 'lookup'; word: string } | { type: 'dict-status' };

export interface DictStatus {
  ready: boolean;
  importing: boolean;
  count: number;
  error?: string;
}

export type LookupResponse = LookupResult;

/** Messages posted from the MAIN-world Plex hook to the isolated content script. */
export const PAGE_MSG_SOURCE = 'sottotitoli-plex-hook';

export type PagePayload =
  | { type: 'subtitles'; title: string; label: string; text: string }
  | { type: 'status'; message: string }
  | { type: 'clear' };

export type PageMessage = PagePayload & { source: typeof PAGE_MSG_SOURCE };

/** Messages posted from the isolated content script to the MAIN-world Plex hook. */
export const CONTENT_MSG_SOURCE = 'sottotitoli-content';

export type ContentMessage = { type: 'language'; language: Language; source: typeof CONTENT_MSG_SOURCE };

export interface Settings {
  /** The language being learned: picks the subtitle track, dictionary and WordReference links. */
  language: Language;
  enabled: boolean;
  pauseOnHover: boolean;
  hidePlexSubtitles: boolean;
  fontSize: number;
}

export const DEFAULT_SETTINGS: Settings = { language: DEFAULT_LANGUAGE, enabled: true, pauseOnHover: true, hidePlexSubtitles: true, fontSize: 30 };
