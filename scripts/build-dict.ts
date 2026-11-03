/**
 * Builds the bundled Italian→English dictionary from a kaikki.org Wiktionary dump.
 *
 *   curl -L -o data/kaikki-italian.jsonl.gz \
 *     https://kaikki.org/dictionary/Italian/kaikki.org-dictionary-Italian.jsonl.gz
 *   pnpm build:dict
 *
 * Output is gzipped NDJSON, one `[word, entry]` pair per line, which the
 * background script streams into IndexedDB on install.
 */
import { createReadStream, createWriteStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { createGunzip, createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { DictionaryBuilder, type KaikkiRecord } from '../lib/dictionary';

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('usage: tsx scripts/build-dict.ts <kaikki.jsonl[.gz]> <out.ndjson.gz>');
  process.exit(1);
}

const builder = new DictionaryBuilder();
const source = createReadStream(input);
const lines = createInterface({ input: input.endsWith('.gz') ? source.pipe(createGunzip()) : source, crlfDelay: Infinity });

let count = 0;
for await (const line of lines) {
  if (!line) continue;
  builder.add(JSON.parse(line) as KaikkiRecord);
  if (++count % 100_000 === 0) console.log(`  read ${count.toLocaleString()} records`);
}

let written = 0;
function* serialise() {
  for (const pair of builder.entries()) {
    written++;
    yield `${JSON.stringify(pair)}\n`;
  }
}
await pipeline(Readable.from(serialise()), createGzip({ level: 9 }), createWriteStream(output));
console.log(`Read ${count.toLocaleString()} records, wrote ${written.toLocaleString()} entries to ${output}`);
