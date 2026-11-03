import { describe, expect, it } from 'vitest';
import { DictionaryBuilder } from '@/lib/dictionary';
import { lookupCandidates, wordReferenceUrl } from '@/lib/lemma';
import { tokenize } from '@/lib/tokenize';

describe('tokenize', () => {
  it('splits words, keeping elided apostrophes with the word', () => {
    const words = tokenize("Dell'uomo? C'è un po' di caffè, l’amico!")
      .filter((t) => t.word)
      .map((t) => t.text);
    expect(words).toEqual(["Dell'", 'uomo', "C'", 'è', 'un', "po'", 'di', 'caffè', 'l’', 'amico']);
  });

  it('round-trips the original text', () => {
    const line = '- Sì, andiamo!\n- Perché no?';
    expect(tokenize(line).map((t) => t.text).join('')).toBe(line);
  });
});

describe('lookupCandidates', () => {
  it('lowercases first', () => {
    expect(lookupCandidates('Parlavo')[0]).toBe('parlavo');
  });

  it('expands elisions', () => {
    expect(lookupCandidates('Dell’')).toEqual(["dell'", 'dell', 'dello', 'della', 'delle', 'delli']);
  });

  it('strips enclitic pronouns back to the infinitive', () => {
    expect(lookupCandidates('parlarti')).toContain('parlare');
    expect(lookupCandidates('andarsene')).toContain('andare');
    expect(lookupCandidates('dicendolo')).toContain('dicendo');
  });

  it('builds WordReference links', () => {
    expect(wordReferenceUrl('Perché')).toBe('https://www.wordreference.com/iten/perch%C3%A9');
    expect(wordReferenceUrl('Mañana', 'es')).toBe('https://www.wordreference.com/esen/ma%C3%B1ana');
  });
});

describe('lookupCandidates (Spanish)', () => {
  it('lowercases first and does not expand Italian elisions', () => {
    expect(lookupCandidates('Hablaba', 'es')).toEqual(['hablaba']);
  });

  it('strips one or two enclitic pronouns and the accent they add', () => {
    expect(lookupCandidates('levantarse', 'es')).toContain('levantar');
    expect(lookupCandidates('dármelo', 'es')).toContain('dar');
    expect(lookupCandidates('diciéndote', 'es')).toContain('diciendo');
    expect(lookupCandidates('cómpraselas', 'es')).toContain('compra');
  });

  it('restores the -s and -d that imperatives drop before nos and os', () => {
    expect(lookupCandidates('vámonos', 'es')).toContain('vamos');
    expect(lookupCandidates('sentaos', 'es')).toContain('sentad');
  });

  it('reduces absolute superlatives to the adjective', () => {
    expect(lookupCandidates('rojísimas', 'es')).toContain('rojo');
    expect(lookupCandidates('grandísimo', 'es')).toContain('grande');
  });
});

describe('DictionaryBuilder', () => {
  it('merges senses by part of speech and records form-of links', () => {
    const b = new DictionaryBuilder();
    b.add({ word: 'parlare', pos: 'verb', lang_code: 'it', senses: [{ glosses: ['to talk, to speak'] }], forms: [{ form: 'parlo', tags: ['first-person', 'singular', 'present'] }, { form: 'ho parlato', tags: ['perfect'] }] });
    b.add({ word: 'parlare', pos: 'noun', lang_code: 'it', senses: [{ glosses: ['speech', 'dialect'] }] });
    b.add({ word: 'parlavo', pos: 'verb', lang_code: 'it', senses: [{ glosses: ['first-person singular imperfect indicative of parlare'], tags: ['form-of'], form_of: [{ word: 'parlare' }] }] });
    b.add({ word: 'speak', pos: 'verb', lang_code: 'en', senses: [{ glosses: ['ignored'] }] });

    const entries = Object.fromEntries(b.entries());
    expect(entries.parlare).toEqual({ s: [['verb', ['to talk, to speak']], ['noun', ['dialect']]] });
    expect(entries.parlavo).toEqual({ f: [['parlare', 'first-person singular imperfect indicative of parlare']] });
    expect(entries.parlo).toEqual({ f: [['parlare', 'first-person singular present of parlare']] });
    expect(entries['ho parlato']).toBeUndefined();
    expect(entries.speak).toBeUndefined();
  });

  it('builds Spanish entries and cleans up clitic form-of targets', () => {
    const b = new DictionaryBuilder('es');
    b.add({ word: 'dar', pos: 'verb', lang_code: 'es', senses: [{ glosses: ['to give'] }] });
    b.add({ word: 'dármelo', pos: 'verb', lang_code: 'es', senses: [{ glosses: ['infinitive of dar combined with me and lo'], form_of: [{ word: 'dar combined with indirect object me and direct object lo' }] }] });
    b.add({ word: 'parlare', pos: 'verb', lang_code: 'it', senses: [{ glosses: ['to talk'] }] });

    const entries = Object.fromEntries(b.entries());
    expect(entries.dar).toEqual({ s: [['verb', ['to give']]] });
    expect(entries['dármelo']).toEqual({ f: [['dar', 'infinitive of dar combined with me and lo']] });
    expect(entries.parlare).toBeUndefined();
  });
});
