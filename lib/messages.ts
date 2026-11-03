import type { LookupResult } from './dictionary';

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

export interface Settings {
  enabled: boolean;
  pauseOnHover: boolean;
  hidePlexSubtitles: boolean;
  fontSize: number;
}

export const DEFAULT_SETTINGS: Settings = { enabled: true, pauseOnHover: true, hidePlexSubtitles: true, fontSize: 30 };
