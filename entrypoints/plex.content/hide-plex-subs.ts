const HIDDEN_ATTR = 'data-sottotitoli-hidden';
const SUBTITLE_CLASS = /subtitle|caption|libjass/i;
// Anything inside these is a menu or control (e.g. the subtitle picker), never the rendered text.
const CONTROLS = 'button, a, input, select, label, [role="menu"], [role="menuitem"], [role="listbox"], [role="option"], [role="dialog"], [role="button"]';

let styleInjected = false;
// Only restore tracks we hid; Plex may keep other tracks hidden on purpose.
const tracksWeHid = new WeakSet<TextTrack>();

function injectStyle() {
  if (styleInjected) return;
  const style = document.createElement('style');
  style.textContent = `[${HIDDEN_ATTR}] { visibility: hidden !important; }`;
  (document.head ?? document.documentElement).append(style);
  styleInjected = true;
}

function overlaps(a: DOMRect, b: DOMRect): boolean {
  return a.width > 0 && a.height > 0 && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/**
 * Hides whatever Plex Web uses to draw its own subtitles over `video`:
 * native text tracks, and DOM elements with a subtitle-ish class name that sit
 * over the video and aren't part of a menu. Returns how many DOM elements are hidden.
 */
export function hidePlexSubtitles(video: HTMLVideoElement, host: Element): number {
  for (const track of video.textTracks) {
    if (track.mode === 'showing') {
      track.mode = 'hidden';
      tracksWeHid.add(track);
    }
  }

  injectStyle();
  const videoRect = video.getBoundingClientRect();
  let hidden = 0;
  for (const el of document.querySelectorAll<HTMLElement>('[class]')) {
    if (el.hasAttribute(HIDDEN_ATTR)) {
      hidden++;
      continue;
    }
    const className = typeof el.className === 'string' ? el.className : el.getAttribute('class') ?? '';
    if (!SUBTITLE_CLASS.test(className)) continue;
    if (el === host || host.contains(el) || el.closest(CONTROLS) || el.querySelector(CONTROLS)) continue;
    if (!overlaps(el.getBoundingClientRect(), videoRect)) continue;
    el.setAttribute(HIDDEN_ATTR, '');
    hidden++;
  }
  return hidden;
}

export function showPlexSubtitles(video: HTMLVideoElement | null): void {
  for (const el of document.querySelectorAll(`[${HIDDEN_ATTR}]`)) el.removeAttribute(HIDDEN_ATTR);
  for (const track of video?.textTracks ?? []) {
    if (tracksWeHid.has(track) && track.mode === 'hidden') track.mode = 'showing';
    tracksWeHid.delete(track);
  }
}
