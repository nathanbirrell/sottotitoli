import { LANGUAGES, type Language } from './languages';

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
 * most inflected forms, so this only handles what it misses: in Italian, elision
 * (dell' → dello/della) and enclitic pronouns (parlarti → parlare); in Spanish,
 * enclitic pronouns (dármelo → dar, diciéndote → diciendo).
 */
export function lookupCandidates(raw: string, lang: Language = 'it'): string[] {
  const word = raw.replace(/’/g, "'").trim();
  const lower = word.toLowerCase();
  const out = lang === 'es' ? [lower, ...spanishCandidates(lower)] : [lower, ...italianCandidates(lower)];
  return [...new Set(out)].filter((w) => w.length > 0);
}

function italianCandidates(lower: string): string[] {
  const out: string[] = [];

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

  return out;
}

// Spanish attaches up to two pronouns to infinitives, gerunds and affirmative imperatives.
const ES_CLITICS = ['nos', 'los', 'las', 'les', 'me', 'te', 'se', 'os', 'lo', 'la', 'le'];
const ACUTE: Record<string, string> = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' };

function spanishCandidates(lower: string): string[] {
  const out: string[] = [];
  let rest = lower;
  for (let i = 0; i < 2; i++) {
    const clitic = ES_CLITICS.find((c) => rest.endsWith(c) && rest.length >= c.length + 2);
    if (!clitic) break;
    rest = rest.slice(0, -clitic.length);
    // The stress accent added to keep stress in place goes away with the pronouns: dámelo → da.
    const plain = rest.replace(/[áéíóú]/g, (c) => ACUTE[c]!);
    out.push(rest, plain);
    // First-person plural imperatives drop -s before nos: vámonos → vamos.
    if (clitic === 'nos' && plain.endsWith('mo')) out.push(`${plain}s`);
    // Vosotros imperatives drop -d before os: sentaos → sentad.
    if (clitic === 'os' && /[aei]$/.test(plain)) out.push(`${plain}d`);
  }
  // Absolute superlatives are rarely listed: rojísimas → rojo, grandísimo → grande.
  const superlative = /^(.{2,})ísim[oa]s?$/.exec(lower);
  if (superlative) {
    const stem = superlative[1]!;
    out.push(`${stem}o`, `${stem}a`, `${stem}e`, stem);
  }
  return out;
}

export function wordReferenceUrl(word: string, lang: Language = 'it'): string {
  return `https://www.wordreference.com/${LANGUAGES[lang].wordReference}/${encodeURIComponent(word.toLowerCase())}`;
}
