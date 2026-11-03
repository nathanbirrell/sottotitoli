export interface Cue {
  start: number;
  end: number;
  text: string;
}

export type SubtitleFormat = 'srt' | 'vtt' | 'ass';

export function detectFormat(text: string): SubtitleFormat {
  if (/^﻿?\s*WEBVTT/.test(text)) return 'vtt';
  if (/^\[Script Info\]|^Dialogue:/m.test(text)) return 'ass';
  return 'srt';
}

export function parseSubtitles(text: string, format = detectFormat(text)): Cue[] {
  const cues = format === 'ass' ? parseAss(text) : parseSrtOrVtt(text);
  return cues.filter((c) => c.text && c.end > c.start).sort((a, b) => a.start - b.start);
}

/** Parses `01:02:03,456`, `02:03.456` or ASS-style `1:02:03.45` into seconds. */
export function parseTimestamp(ts: string): number {
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?$/.exec(ts.trim());
  if (!m) return NaN;
  const [, h = '0', min = '0', s = '0', frac = '0'] = m;
  return +h * 3600 + +min * 60 + +s + +frac / 10 ** frac.length;
}

const ARROW = /^\s*(\S+)\s+-->\s+(\S+)/;

function parseSrtOrVtt(text: string): Cue[] {
  const blocks = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split(/\n{2,}/);
  const cues: Cue[] = [];
  for (const block of blocks) {
    const lines = block.split('\n');
    const i = lines.findIndex((l) => ARROW.test(l));
    if (i === -1) continue;
    const [, from = '', to = ''] = ARROW.exec(lines[i]!)!;
    cues.push({
      start: parseTimestamp(from),
      end: parseTimestamp(to),
      text: cleanText(lines.slice(i + 1).join('\n')),
    });
  }
  return cues;
}

function parseAss(text: string): Cue[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  let fields = ['layer', 'start', 'end', 'style', 'name', 'marginl', 'marginr', 'marginv', 'effect', 'text'];
  let inEvents = false;
  const cues: Cue[] = [];
  for (const line of lines) {
    if (/^\[.*\]$/.test(line.trim())) {
      inEvents = line.trim().toLowerCase() === '[events]';
      continue;
    }
    if (!inEvents) continue;
    if (line.startsWith('Format:')) {
      fields = line.slice(7).split(',').map((f) => f.trim().toLowerCase());
    } else if (line.startsWith('Dialogue:')) {
      const parts = line.slice(9).split(',');
      // Text is the last field and may itself contain commas.
      const values = [...parts.slice(0, fields.length - 1), parts.slice(fields.length - 1).join(',')];
      const get = (name: string) => values[fields.indexOf(name)] ?? '';
      cues.push({
        start: parseTimestamp(get('start')),
        end: parseTimestamp(get('end')),
        text: cleanText(get('text').replace(/\\[Nn]/g, '\n').replace(/\\h/g, ' ')),
      });
    }
  }
  return cues;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', nbsp: ' ', quot: '"', apos: "'" };

export function cleanText(text: string): string {
  return text
    .replace(/\{[^}]*\}/g, '') // ASS override tags
    .replace(/<[^>]*>/g, '') // HTML-ish tags (<i>, <font>, VTT <c.x>)
    .replace(/&(\w+);/g, (m, name: string) => ENTITIES[name] ?? m)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');
}

/** Returns the text of every cue active at `time`, joined by newlines. */
export function activeText(cues: Cue[], time: number): string {
  // Binary search for the last cue starting at or before `time`.
  let lo = 0;
  let hi = cues.length - 1;
  let idx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cues[mid]!.start <= time) {
      idx = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  const active: string[] = [];
  // Overlapping cues are rare and short-lived, so a small look-back is enough.
  for (let i = idx; i >= 0 && i > idx - 8; i--) {
    const cue = cues[i]!;
    if (cue.end > time) active.unshift(cue.text);
  }
  return active.join('\n');
}
