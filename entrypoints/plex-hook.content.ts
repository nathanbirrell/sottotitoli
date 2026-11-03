import { defineContentScript } from 'wxt/utils/define-content-script';
import { DEFAULT_LANGUAGE, isLanguage, LANGUAGES, type Language } from '@/lib/languages';
import { CONTENT_MSG_SOURCE, PAGE_MSG_SOURCE, type ContentMessage, type PageMessage, type PagePayload } from '@/lib/messages';
import { describeItem, parsePlaybackRequest, pickSubtitleStream, PLEX_MATCHES, type PlaybackInfo, type PlexMetadata } from '@/lib/plex';

/**
 * Runs in the page's own JS world so it can see Plex Web's network requests.
 * When playback starts it fetches the item's metadata from the media server
 * (with the token Plex Web is already using), downloads the subtitle stream in
 * the language being learned and posts its text to the isolated content script.
 * The isolated script tells it which language that is, since it can't read storage.
 */
export default defineContentScript({
  matches: PLEX_MATCHES,
  world: 'MAIN',
  runAt: 'document_start',
  main() {
    const nativeFetch = window.fetch.bind(window);
    let current: string | null = null;
    let currentInfo: PlaybackInfo | null = null;
    let language: Language = DEFAULT_LANGUAGE;

    const post = (msg: PagePayload) =>
      window.postMessage({ source: PAGE_MSG_SOURCE, ...msg } satisfies PageMessage, window.location.origin);

    async function load(info: PlaybackInfo, id: string) {
      const lang = language;
      // A newer playback or language change supersedes this load.
      const isCurrent = () => current === id && language === lang;
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (info.token) headers['X-Plex-Token'] = info.token;
      try {
        const res = await nativeFetch(`${info.origin}/library/metadata/${info.ratingKey}`, { headers });
        if (!res.ok) throw new Error(`metadata request failed (${res.status})`);
        const meta: PlexMetadata = (await res.json()).MediaContainer?.Metadata?.[0] ?? {};
        const { name } = LANGUAGES[lang];
        const stream = pickSubtitleStream(meta, lang);
        if (!stream) {
          if (isCurrent()) post({ type: 'status', message: `No ${name} text subtitles found for ${describeItem(meta)}` });
          return;
        }
        const subRes = await nativeFetch(`${info.origin}${stream.key ?? `/library/streams/${stream.id}`}`, { headers: { ...headers, Accept: '*/*' } });
        if (!subRes.ok) throw new Error(`subtitle download failed (${subRes.status})`);
        const text = await subRes.text();
        if (isCurrent()) {
          post({ type: 'subtitles', title: describeItem(meta), label: stream.extendedDisplayTitle ?? stream.displayTitle ?? name, text });
        }
      } catch (err) {
        if (isCurrent()) post({ type: 'status', message: `Couldn't load subtitles: ${(err as Error).message}` });
      }
    }

    function onRequest(url: string, headerToken: string | null) {
      const info = parsePlaybackRequest(url, headerToken);
      if (!info) return;
      const id = `${info.origin}|${info.ratingKey}`;
      if (info.burnSubtitles) {
        post({ type: 'status', message: "Plex is burning its subtitles into the video, so they can't be hidden. Set subtitles to None in Plex's player." });
      }
      if (info.state === 'stopped') {
        if (current === id) {
          current = null;
          currentInfo = null;
          post({ type: 'clear' });
        }
        return;
      }
      if (id === current) return;
      current = id;
      currentInfo = info;
      void load(info, id);
    }

    // The language setting arrives once the isolated script has read storage, and again on change.
    window.addEventListener('message', (e: MessageEvent<ContentMessage>) => {
      if (e.source !== window || e.data?.source !== CONTENT_MSG_SOURCE || e.data.type !== 'language') return;
      if (!isLanguage(e.data.language) || e.data.language === language) return;
      language = e.data.language;
      if (current && currentInfo) {
        post({ type: 'clear' });
        void load(currentInfo, current);
      }
    });

    window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
      try {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
        onRequest(url, headers.get('X-Plex-Token'));
      } catch {
        // never break the page's own requests
      }
      return nativeFetch(input, init);
    };

    const xhrInfo = new WeakMap<XMLHttpRequest, { url: string; token: string | null }>();
    const { open, setRequestHeader, send } = XMLHttpRequest.prototype;
    XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
      xhrInfo.set(this, { url: String(url), token: null });
      return (open as (...a: unknown[]) => void).call(this, method, url, ...rest);
    } as typeof open;
    XMLHttpRequest.prototype.setRequestHeader = function (this: XMLHttpRequest, name: string, value: string) {
      const info = xhrInfo.get(this);
      if (info && name.toLowerCase() === 'x-plex-token') info.token = value;
      return setRequestHeader.call(this, name, value);
    };
    XMLHttpRequest.prototype.send = function (this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
      const info = xhrInfo.get(this);
      try {
        if (info) onRequest(info.url, info.token);
      } catch {
        // ignore
      }
      return send.call(this, body);
    };
  },
});
