import type { Language } from './languages';

/**
 * One dictionary record, keyed by lowercase word.
 * `s`: senses grouped by part of speech, e.g. [["verb", ["to speak", "to talk"]]].
 * `f`: the lemmas this word is an inflection of, with a description,
 *      e.g. [["parlare", "first-person singular imperfect indicative of parlare"]].
 */
export interface DictEntry {
  s?: [pos: string, glosses: string[]][];
  f?: [lemma: string, description: string][];
}

export interface LookupResult {
  query: string;
  /** The key that matched, or null when nothing did. */
  matched: string | null;
  entry: DictEntry | null;
  /** Entries for the lemmas in `entry.f`. */
  lemmas: { word: string; entry: DictEntry }[];
  /** Set while the dictionary is still being imported. */
  loading?: boolean;
}

/** Bump when the bundled dictionary format or contents change, to force a re-import. */
export const DICT_VERSION = 1;

const MAX_GLOSSES_PER_POS = 6;
const MAX_FORMS = 4;
const MAX_GLOSS_LENGTH = 200;
const SKIP_POS = new Set(['character', 'symbol', 'romanization']);

interface KaikkiSense {
  glosses?: string[];
  tags?: string[];
  form_of?: { word: string }[];
  alt_of?: { word: string }[];
}

interface KaikkiForm {
  form?: string;
  tags?: string[];
}

export interface KaikkiRecord {
  word?: string;
  pos?: string;
  lang_code?: string;
  senses?: KaikkiSense[];
  forms?: KaikkiForm[];
}

interface Building {
  senses: Map<string, string[]>;
  forms: Map<string, string>;
  /** Forms taken from lemma inflection tables; only used if no form-of entry exists. */
  tableForms: Map<string, string>;
}

/** Accumulates Wiktionary (kaikki.org) records into compact dictionary entries. */
export class DictionaryBuilder {
  private words = new Map<string, Building>();

  constructor(private lang: Language = 'it') {}

  private get(word: string): Building {
    const key = word.toLowerCase();
    let b = this.words.get(key);
    if (!b) {
      b = { senses: new Map(), forms: new Map(), tableForms: new Map() };
      this.words.set(key, b);
    }
    return b;
  }

  add(rec: KaikkiRecord): void {
    if (rec.lang_code !== this.lang || !rec.word || !rec.pos || SKIP_POS.has(rec.pos)) return;
    const word = rec.word;

    for (const sense of rec.senses ?? []) {
      const gloss = sense.glosses?.at(-1)?.trim();
      if (!gloss || sense.tags?.includes('no-gloss')) continue;
      const targets = [...(sense.form_of ?? []), ...(sense.alt_of ?? [])];
      if (targets.length) {
        const forms = this.get(word).forms;
        for (const t of targets) {
          // Spanish clitic forms point at e.g. "dar combined with indirect object me and direct object lo".
          const lemma = t.word?.replace(/ combined with .*$/, '');
          if (lemma && lemma.toLowerCase() !== word.toLowerCase() && !forms.has(lemma)) {
            forms.set(lemma, truncate(gloss));
          }
        }
        continue;
      }
      const senses = this.get(word).senses;
      const list = senses.get(rec.pos) ?? [];
      if (list.length < MAX_GLOSSES_PER_POS && !list.includes(gloss)) list.push(truncate(gloss));
      senses.set(rec.pos, list);
    }

    for (const form of rec.forms ?? []) {
      const text = form.form?.trim();
      const tags = form.tags ?? [];
      if (!text || text.includes(' ') || text.toLowerCase() === word.toLowerCase()) continue;
      if (tags.some((t) => ['table-tags', 'inflection-template', 'romanization', 'class'].includes(t))) continue;
      const tableForms = this.get(text).tableForms;
      if (!tableForms.has(word)) tableForms.set(word, `${tags.join(' ')} of ${word}`.trim());
    }
  }

  *entries(): Generator<[string, DictEntry]> {
    for (const [key, b] of this.words) {
      const entry: DictEntry = {};
      if (b.senses.size) entry.s = [...b.senses].filter(([, g]) => g.length > 0);
      const forms = [...b.forms];
      for (const [lemma, desc] of b.tableForms) {
        if (!b.forms.has(lemma)) forms.push([lemma, desc]);
      }
      if (forms.length) entry.f = forms.slice(0, MAX_FORMS);
      if (entry.s?.length || entry.f?.length) yield [key, entry];
    }
  }
}

function truncate(s: string): string {
  return s.length > MAX_GLOSS_LENGTH ? `${s.slice(0, MAX_GLOSS_LENGTH - 1)}…` : s;
}
