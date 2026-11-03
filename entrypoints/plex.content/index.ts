import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import type { LookupResult } from '@/lib/dictionary';
import { DEFAULT_SETTINGS, PAGE_MSG_SOURCE, type PageMessage, type RuntimeMessage, type Settings } from '@/lib/messages';
import { PLEX_MATCHES } from '@/lib/plex';
import { parseSubtitles } from '@/lib/subtitles';
import { hidePlexSubtitles, showPlexSubtitles } from './hide-plex-subs';
import { Overlay } from './overlay';

const SUBTITLE_FILE = /\.(srt|vtt|ass|ssa)$/i;

export default defineContentScript({
  matches: PLEX_MATCHES,
  async main(ctx) {
    const stored = await browser.storage.local.get('settings');
    let settings: Settings = { ...DEFAULT_SETTINGS, ...(stored.settings as Partial<Settings> | undefined) };

    const lookup = (word: string) =>
      browser.runtime.sendMessage({ type: 'lookup', word } satisfies RuntimeMessage) as Promise<LookupResult>;
    const overlay = new Overlay(settings, lookup);

    browser.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.settings) {
        settings = { ...DEFAULT_SETTINGS, ...(changes.settings.newValue as Partial<Settings>) };
        overlay.updateSettings(settings);
      }
    });

    function load(text: string, label: string) {
      const cues = parseSubtitles(text);
      overlay.setCues(cues);
      overlay.showToast(cues.length ? `Sottotitoli: ${label} (${cues.length} lines)` : `Sottotitoli: no cues found in ${label}`);
    }

    // Subtitles found by the MAIN-world hook (plex-hook.content.ts).
    ctx.addEventListener(window, 'message', (e: MessageEvent<PageMessage>) => {
      if (e.source !== window || e.data?.source !== PAGE_MSG_SOURCE) return;
      const msg = e.data;
      if (msg.type === 'subtitles') load(msg.text, `${msg.title} · ${msg.label}`);
      else if (msg.type === 'status') overlay.showToast(msg.message, 6000);
      else if (msg.type === 'clear') overlay.clear();
    });

    // Fallback: drop a subtitle file anywhere on the page.
    ctx.addEventListener(document, 'dragover', (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
    }, { capture: true });
    ctx.addEventListener(document, 'drop', async (e: DragEvent) => {
      const file = [...(e.dataTransfer?.files ?? [])].find((f) => SUBTITLE_FILE.test(f.name));
      if (!file) return;
      e.preventDefault();
      e.stopPropagation();
      load(await file.text(), file.name);
    }, { capture: true });

    // Plex Web is a single-page app: keep following the largest <video> on the page,
    // and keep Plex's own subtitles hidden while ours are showing.
    let hidingPlexSubs = false;
    ctx.setInterval(() => {
      const videos = [...document.querySelectorAll('video')].filter((v) => v.offsetWidth > 0);
      const video = videos.sort((a, b) => b.offsetWidth * b.offsetHeight - a.offsetWidth * a.offsetHeight)[0];
      if (video) overlay.attach(video);

      const shouldHide = !!video && settings.enabled && settings.hidePlexSubtitles && overlay.hasSubtitles;
      if (shouldHide) hidePlexSubtitles(video, overlay.element);
      else if (hidingPlexSubs) showPlexSubtitles(video ?? null);
      hidingPlexSubs = shouldHide;
    }, 400);
  },
});
