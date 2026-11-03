import { describe, expect, it } from 'vitest';
import { activeText, detectFormat, parseSubtitles, parseTimestamp } from '@/lib/subtitles';

const SRT = `﻿1
00:03:25,480 --> 00:03:27,480
<font color="#FFFF00">Girolamo.</font>

2
00:03:38,560 --> 00:03:45,800
<i>Che brutto aspetto hai!</i>
Andiamo a farci una bevuta.
`;

const VTT = `WEBVTT

NOTE a comment

1
00:00:01.000 --> 00:00:02.500 align:center line:90%
<c.yellow>Ciao</c> &amp; buongiorno

00:00:03.000 --> 00:00:04.000
Come stai?
`;

const ASS = `[Script Info]
Title: test

[V4+ Styles]
Format: Name, Fontname

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.50,0:00:03.00,Default,,0,0,0,,{\\i1}Allora,\\Nandiamo.
`;

describe('parseTimestamp', () => {
  it('handles srt, vtt and ass styles', () => {
    expect(parseTimestamp('00:03:25,480')).toBeCloseTo(205.48);
    expect(parseTimestamp('02:03.5')).toBeCloseTo(123.5);
    expect(parseTimestamp('1:00:01.25')).toBeCloseTo(3601.25);
    expect(parseTimestamp('nope')).toBeNaN();
  });
});

describe('parseSubtitles', () => {
  it('parses SRT and strips tags', () => {
    expect(detectFormat(SRT)).toBe('srt');
    expect(parseSubtitles(SRT)).toEqual([
      { start: 205.48, end: 207.48, text: 'Girolamo.' },
      { start: 218.56, end: 225.8, text: 'Che brutto aspetto hai!\nAndiamo a farci una bevuta.' },
    ]);
  });

  it('parses VTT with settings, entities and id-less cues', () => {
    expect(detectFormat(VTT)).toBe('vtt');
    expect(parseSubtitles(VTT)).toEqual([
      { start: 1, end: 2.5, text: 'Ciao & buongiorno' },
      { start: 3, end: 4, text: 'Come stai?' },
    ]);
  });

  it('parses ASS dialogue with commas and line breaks in the text', () => {
    expect(detectFormat(ASS)).toBe('ass');
    expect(parseSubtitles(ASS)).toEqual([{ start: 1.5, end: 3, text: 'Allora,\nandiamo.' }]);
  });
});

describe('activeText', () => {
  const cues = [
    { start: 1, end: 3, text: 'uno' },
    { start: 2, end: 4, text: 'due' },
    { start: 10, end: 12, text: 'tre' },
  ];
  it('returns the cues active at a time, including overlaps', () => {
    expect(activeText(cues, 0.5)).toBe('');
    expect(activeText(cues, 1.5)).toBe('uno');
    expect(activeText(cues, 2.5)).toBe('uno\ndue');
    expect(activeText(cues, 5)).toBe('');
    expect(activeText(cues, 11)).toBe('tre');
  });
});
