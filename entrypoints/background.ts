import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { DICT_VERSION, type DictEntry, type LookupResult } from '@/lib/dictionary';
import { clearEntries, getEntries, getMeta, putEntries, setMeta, type DictMeta } from '@/lib/dict-db';
import { LANGUAGES, type Language } from '@/lib/languages';
import { lookupCandidates } from '@/lib/lemma';
import { DEFAULT_SETTINGS, type DictStatus, type RuntimeMessage, type Settings } from '@/lib/messages';

const BATCH_SIZE = 5000;

let importing: Promise<void> | undefined;
let importingLanguage: Language | undefined;
/** Bumped to abandon an import in progress, e.g. when the language changes mid-import. */
let generation = 0;
let imported = 0;
let importError: string | undefined;

async function currentLanguage(): Promise<Language> {
  const stored = await browser.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(stored.settings as Partial<Settings> | undefined) }.language;
}

function isComplete(meta: DictMeta | undefined, lang: Language): boolean {
  return !!meta?.complete && meta.version === DICT_VERSION && (meta.language ?? 'it') === lang;
}

async function isReady(lang: Language): Promise<boolean> {
  return isComplete(await getMeta(), lang);
}

/**
 * Streams the bundled gzipped NDJSON dictionary for `lang` into IndexedDB, once per
 * DICT_VERSION. Only one language is stored at a time; switching replaces it.
 */
function ensureDictionary(lang: Language): Promise<void> {
  if (importing && importingLanguage === lang) return importing;
  const gen = ++generation;
  importingLanguage = lang;
  importing = (async () => {
    if (await isReady(lang)) return;
    imported = 0;
    importError = undefined;
    await setMeta({ version: DICT_VERSION, language: lang, count: 0, complete: false });
    await clearEntries();

    const res = await fetch(browser.runtime.getURL(LANGUAGES[lang].dictPath as '/'));
    const reader = res
      .body!.pipeThrough(new DecompressionStream('gzip'))
      .pipeThrough(new TextDecoderStream())
      .getReader();

    let buffered = '';
    let batch: [string, DictEntry][] = [];
    for (;;) {
      const { value, done } = await reader.read();
      if (gen !== generation) {
        void reader.cancel();
        return;
      }
      buffered += value ?? '';
      const lines = buffered.split('\n');
      buffered = done ? '' : lines.pop()!;
      for (const line of lines) {
        if (line) batch.push(JSON.parse(line));
      }
      if (batch.length >= BATCH_SIZE || (done && batch.length)) {
        await putEntries(batch);
        if (gen !== generation) return;
        imported += batch.length;
        // Any extension API call resets Chrome's 30s service-worker idle timer.
        void browser.runtime.getPlatformInfo();
        batch = [];
      }
      if (done) break;
    }
    if (gen !== generation) return;
    await setMeta({ version: DICT_VERSION, language: lang, count: imported, complete: true });
    console.info(`[sottotitoli] ${LANGUAGES[lang].name} dictionary ready: ${imported} entries`);
  })().catch((err) => {
    if (gen !== generation) return;
    importError = String(err);
    importing = undefined; // allow a retry on the next lookup
    console.error('[sottotitoli] dictionary import failed', err);
  });
  return importing;
}

async function lookup(word: string): Promise<LookupResult> {
  const lang = await currentLanguage();
  if (!(await isReady(lang))) {
    void ensureDictionary(lang);
    return { query: word, matched: null, entry: null, lemmas: [], loading: true };
  }
  const candidates = lookupCandidates(word, lang);
  const found = await getEntries(candidates);
  const i = found.findIndex(Boolean);
  if (i === -1) return { query: word, matched: null, entry: null, lemmas: [] };

  const entry = found[i]!;
  const lemmaWords = [...new Set((entry.f ?? []).map(([lemma]) => lemma))];
  const lemmaEntries = await getEntries(lemmaWords.map((w) => w.toLowerCase()));
  const lemmas = lemmaWords.flatMap((w, j) => (lemmaEntries[j]?.s ? [{ word: w, entry: lemmaEntries[j]! }] : []));
  return { query: word, matched: candidates[i] ?? null, entry, lemmas };
}

async function status(): Promise<DictStatus> {
  const lang = await currentLanguage();
  const meta = await getMeta();
  const ready = isComplete(meta, lang);
  return { ready, importing: !ready && !!importing, count: ready ? meta!.count : imported, error: importError };
}

export default defineBackground(() => {
  const ensureCurrent = () => void currentLanguage().then(ensureDictionary);
  browser.runtime.onInstalled.addListener(ensureCurrent);
  browser.runtime.onStartup.addListener(ensureCurrent);
  browser.storage.onChanged.addListener((changes, area) => {
    const lang = (changes.settings?.newValue as Partial<Settings> | undefined)?.language;
    if (area === 'local' && lang && lang !== (changes.settings?.oldValue as Partial<Settings> | undefined)?.language) {
      void ensureDictionary(lang);
    }
  });

  browser.runtime.onMessage.addListener((msg: RuntimeMessage, _sender, sendResponse) => {
    if (msg?.type === 'lookup') {
      lookup(msg.word).then(sendResponse, (err) => sendResponse({ query: msg.word, matched: null, entry: null, lemmas: [], error: String(err) }));
      return true;
    }
    if (msg?.type === 'dict-status') {
      status().then(sendResponse);
      return true;
    }
  });
});
