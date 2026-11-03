import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { DICT_PATH, DICT_VERSION, type DictEntry, type LookupResult } from '@/lib/dictionary';
import { clearEntries, getEntries, getMeta, putEntries, setMeta } from '@/lib/dict-db';
import { lookupCandidates } from '@/lib/lemma';
import type { DictStatus, RuntimeMessage } from '@/lib/messages';

const BATCH_SIZE = 5000;

let importing: Promise<void> | undefined;
let imported = 0;
let importError: string | undefined;

async function isReady(): Promise<boolean> {
  const meta = await getMeta();
  return !!meta?.complete && meta.version === DICT_VERSION;
}

/** Streams the bundled gzipped NDJSON dictionary into IndexedDB, once per DICT_VERSION. */
function ensureDictionary(): Promise<void> {
  importing ??= (async () => {
    if (await isReady()) return;
    imported = 0;
    importError = undefined;
    await setMeta({ version: DICT_VERSION, count: 0, complete: false });
    await clearEntries();

    const res = await fetch(browser.runtime.getURL(DICT_PATH as '/'));
    const reader = res
      .body!.pipeThrough(new DecompressionStream('gzip'))
      .pipeThrough(new TextDecoderStream())
      .getReader();

    let buffered = '';
    let batch: [string, DictEntry][] = [];
    for (;;) {
      const { value, done } = await reader.read();
      buffered += value ?? '';
      const lines = buffered.split('\n');
      buffered = done ? '' : lines.pop()!;
      for (const line of lines) {
        if (line) batch.push(JSON.parse(line));
      }
      if (batch.length >= BATCH_SIZE || (done && batch.length)) {
        await putEntries(batch);
        imported += batch.length;
        // Any extension API call resets Chrome's 30s service-worker idle timer.
        void browser.runtime.getPlatformInfo();
        batch = [];
      }
      if (done) break;
    }
    await setMeta({ version: DICT_VERSION, count: imported, complete: true });
    console.info(`[sottotitoli] dictionary ready: ${imported} entries`);
  })().catch((err) => {
    importError = String(err);
    importing = undefined; // allow a retry on the next lookup
    console.error('[sottotitoli] dictionary import failed', err);
  });
  return importing;
}

async function lookup(word: string): Promise<LookupResult> {
  if (!(await isReady())) {
    void ensureDictionary();
    return { query: word, matched: null, entry: null, lemmas: [], loading: true };
  }
  const candidates = lookupCandidates(word);
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
  const meta = await getMeta();
  const ready = !!meta?.complete && meta.version === DICT_VERSION;
  return { ready, importing: !ready && !!importing, count: ready ? meta!.count : imported, error: importError };
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => void ensureDictionary());
  browser.runtime.onStartup.addListener(() => void ensureDictionary());

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
