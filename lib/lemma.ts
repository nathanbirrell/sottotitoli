// Enclitic pronoun clusters, longest first so `glielo` wins over `lo`.
const CLITICS = [
  'gliela', 'gliele', 'glieli', 'glielo', 'gliene',
  'mela', 'mele', 'meli', 'melo', 'mene',
  'tela', 'tele', 'teli', 'telo', 'tene',
  'sela', 'sele', 'seli', 'selo', 'sene',
  'cela', 'cele', 'celi', 'celo', 'cene',
  'vela', 'vele', 'veli', 'velo', 'vene',
  'gli', 'lo', 'la', 'li', 'le', 'ne', 'mi', 'ti', 'si', 'ci', 'vi',
];

/**
 * Keys to try in the dictionary, most specific first. Wiktionary already lists
 * most inflected forms, so this only handles what it misses: elision
 * (dell' → dello/della) and enclitic pronouns (parlarti → parlare).
 */
export function lookupCandidates(raw: string): string[] {
  const word = raw.replace(/’/g, "'").trim();
  const lower = word.toLowerCase();
  const out = [lower];

  if (lower.endsWith("'")) {
    const stem = lower.slice(0, -1);
    out.push(stem, `${stem}o`, `${stem}a`, `${stem}e`, `${stem}i`);
  }

  for (const clitic of CLITICS) {
    if (!lower.endsWith(clitic) || lower.length < clitic.length + 3) continue;
    const base = lower.slice(0, -clitic.length);
    out.push(base);
    // Infinitives drop their final -e before clitics: parlar-ti, andar-sene.
    if (/[aei]r$/.test(base)) out.push(`${base}e`);
    // ...and -rre verbs keep a single r: porr-lo → porre.
    if (base.endsWith('rr')) out.push(`${base}e`);
    break;
  }

  return [...new Set(out)].filter((w) => w.length > 0);
}

export function wordReferenceUrl(word: string): string {
  return `https://www.wordreference.com/iten/${encodeURIComponent(word.toLowerCase())}`;
}
