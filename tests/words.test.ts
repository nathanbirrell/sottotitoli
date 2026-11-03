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
});
