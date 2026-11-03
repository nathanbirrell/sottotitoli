/** The languages Sottotitoli can teach, by ISO 639-1 code (also kaikki.org's `lang_code`). */
export type Language = 'it' | 'es';

export interface LanguageInfo {
  /** English name, for UI text: "No Spanish text subtitles found". */
  name: string;
  /** The bundled dictionary, built by scripts/build-dict.ts. */
  dictPath: string;
  /** WordReference's dictionary slug, e.g. https://www.wordreference.com/iten/ */
  wordReference: string;
  /** Plex language codes and tags (ISO 639-1 and -2) for this language. */
  plexCodes: string[];
  /** Fallback match on Plex's language name, e.g. "Italiano" or "Spanish (Latin America)". */
  plexName: RegExp;
}

export const LANGUAGES: Record<Language, LanguageInfo> = {
  it: {
    name: 'Italian',
    dictPath: '/dict/it-en.ndjson.gz',
    wordReference: 'iten',
    plexCodes: ['it', 'ita'],
    plexName: /\bital/i,
  },
  es: {
    name: 'Spanish',
    dictPath: '/dict/es-en.ndjson.gz',
    wordReference: 'esen',
    plexCodes: ['es', 'spa'],
    plexName: /\b(span|espa[nñ]ol|castellano)/i,
  },
};

export const DEFAULT_LANGUAGE: Language = 'it';

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && Object.hasOwn(LANGUAGES, value);
}
