import { LANGUAGES, type Language } from './languages';

/** Where Plex Web runs: the hosted app, a server's own /web, or a local server. */
export const PLEX_MATCHES = ['*://app.plex.tv/*', '*://*.plex.direct/*', 'http://localhost/*', 'http://127.0.0.1/*'];

export interface PlaybackInfo {
  /** The Plex Media Server origin, e.g. https://10-0-0-5.abc123.plex.direct:32400 */
  origin: string;
  ratingKey: string;
  token: string | null;
  /** From timeline reports: playing | paused | buffering | stopped */
  state?: string;
  /** The transcode asks the server to burn subtitles into the picture. */
  burnSubtitles?: boolean;
}

/**
 * Recognises the requests Plex Web sends to the media server while playing:
 * the playback decision (`/video/:/transcode/universal/decision?path=/library/metadata/123`)
 * and the periodic timeline report (`/:/timeline?ratingKey=123&state=playing`).
 */
export function parsePlaybackRequest(url: string, headerToken: string | null = null, base?: string): PlaybackInfo | null {
  let u: URL;
  try {
    u = new URL(url, base ?? globalThis.location?.href);
  } catch {
    return null;
  }
  let ratingKey: string | null = null;
  let state: string | undefined;
  let burnSubtitles: boolean | undefined;
  if (u.pathname.endsWith('/:/timeline')) {
    ratingKey = u.searchParams.get('ratingKey');
    state = u.searchParams.get('state') ?? undefined;
  } else if (/\/video\/:\/transcode\/universal\/(decision|start)/.test(u.pathname)) {
    ratingKey = /\/library\/metadata\/(\d+)/.exec(u.searchParams.get('path') ?? '')?.[1] ?? null;
    burnSubtitles = u.searchParams.get('subtitles') === 'burn';
  }
  if (!ratingKey || !/^\d+$/.test(ratingKey)) return null;
  return { origin: u.origin, ratingKey, token: u.searchParams.get('X-Plex-Token') ?? headerToken, state, burnSubtitles };
}

export interface PlexStream {
  id: number;
  streamType: number;
  key?: string;
  codec?: string;
  language?: string;
  languageCode?: string;
  languageTag?: string;
  selected?: boolean;
  forced?: boolean;
  displayTitle?: string;
  extendedDisplayTitle?: string;
}

export interface PlexMetadata {
  title?: string;
  grandparentTitle?: string;
  parentIndex?: number;
  index?: number;
  Media?: { Part?: { Stream?: PlexStream[] }[] }[];
}

const SUBTITLE_STREAM = 3;
// Bitmap subtitle formats can't be turned into text.
const IMAGE_CODECS = new Set(['pgs', 'hdmv_pgs_subtitle', 'vobsub', 'dvd_subtitle', 'dvdsub', 'dvb_subtitle']);

export function isInLanguage(s: PlexStream, lang: Language): boolean {
  const { plexCodes, plexName } = LANGUAGES[lang];
  const code = (s.languageTag || s.languageCode || '').toLowerCase();
  return plexCodes.includes(code) || code.startsWith(`${lang}-`) || plexName.test(s.language ?? '');
}

/** Picks the best text subtitle stream in `lang`: selected, then non-forced, then sidecar files. */
export function pickSubtitleStream(meta: PlexMetadata, lang: Language): PlexStream | null {
  const streams = (meta.Media ?? [])
    .flatMap((m) => m.Part ?? [])
    .flatMap((p) => p.Stream ?? [])
    .filter((s) => s.streamType === SUBTITLE_STREAM && isInLanguage(s, lang) && !IMAGE_CODECS.has((s.codec ?? '').toLowerCase()));
  const score = (s: PlexStream) => (s.selected ? 4 : 0) + (s.forced ? 0 : 2) + (s.key ? 1 : 0);
  return streams.sort((a, b) => score(b) - score(a))[0] ?? null;
}

export function describeItem(meta: PlexMetadata): string {
  if (meta.grandparentTitle) {
    const se = meta.parentIndex != null && meta.index != null ? ` S${meta.parentIndex}E${meta.index}` : '';
    return `${meta.grandparentTitle}${se}`;
  }
  return meta.title ?? 'this item';
}
