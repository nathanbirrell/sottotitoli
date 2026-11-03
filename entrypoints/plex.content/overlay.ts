import type { DictEntry, LookupResult } from '@/lib/dictionary';
import type { Language } from '@/lib/languages';
import { wordReferenceUrl } from '@/lib/lemma';
import type { Settings } from '@/lib/messages';
import { activeText, type Cue } from '@/lib/subtitles';
import { tokenize } from '@/lib/tokenize';
import css from './style.css?inline';

type Lookup = (word: string) => Promise<LookupResult>;

/**
 * Draws the current cue as clickable words on top of a <video>, inside a
 * shadow root so Plex's styles can't leak in. Pauses on hover (optional) and
 * while the word popup is open, resuming only if it was the one that paused.
 */
export class Overlay {
  private host = document.createElement('div');
  private root = this.host.attachShadow({ mode: 'open' });
  private line = document.createElement('div');
  private popup = document.createElement('div');
  private toast = document.createElement('div');
  private video: HTMLVideoElement | null = null;
  private cues: Cue[] = [];
  private shownText = '';
  private pausedByUs = false;
  private hovering = false;
  private toastTimer = 0;
  private frame = 0;

  constructor(
    private settings: Settings,
    private lookup: Lookup,
  ) {
    const style = document.createElement('style');
    style.textContent = css;
    this.line.className = 'line';
    this.popup.className = 'popup';
    this.popup.hidden = true;
    this.toast.className = 'toast';
    this.root.append(style, this.line, this.popup, this.toast);
    this.host.dataset.sottotitoli = '';

    // Keep Plex's player from treating our clicks as play/pause toggles.
    for (const type of ['click', 'mousedown', 'pointerdown', 'dblclick'] as const) {
      this.line.addEventListener(type, (e) => e.stopPropagation());
      this.popup.addEventListener(type, (e) => e.stopPropagation());
    }
    this.line.addEventListener('click', (e) => this.onWordClick(e));
    this.line.addEventListener('mouseenter', () => {
      this.hovering = true;
      if (this.settings.pauseOnHover) this.pause();
    });
    this.line.addEventListener('mouseleave', () => {
      this.hovering = false;
      if (this.popup.hidden) this.resume();
    });
    document.addEventListener('keydown', (e) => e.key === 'Escape' && this.closePopup(), true);
    document.addEventListener('mousedown', (e) => !e.composedPath().includes(this.host) && this.closePopup(), true);
  }

  get hasSubtitles(): boolean {
    return this.cues.length > 0;
  }

  get element(): HTMLElement {
    return this.host;
  }

  updateSettings(settings: Settings): void {
    this.settings = settings;
    this.line.style.fontSize = `${settings.fontSize}px`;
    this.host.style.display = settings.enabled ? '' : 'none';
  }

  setCues(cues: Cue[]): void {
    this.cues = cues;
    this.shownText = '';
    this.render();
  }

  clear(): void {
    this.setCues([]);
    this.closePopup();
  }

  /** Mounts over `video`, moving if Plex swapped the element (e.g. next episode). */
  attach(video: HTMLVideoElement): void {
    const parent = video.parentElement;
    if (!parent) return;
    if (this.video !== video || this.host.parentElement !== parent) {
      if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
      parent.append(this.host);
      this.video = video;
      this.updateSettings(this.settings);
    }
    if (!this.frame) this.loop();
  }

  showToast(message: string, ms = 4000): void {
    this.toast.textContent = message;
    this.toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toast.classList.remove('show'), ms);
  }

  private loop = () => {
    this.frame = requestAnimationFrame(this.loop);
    this.render();
  };

  private render(): void {
    const text = this.video && this.cues.length ? activeText(this.cues, this.video.currentTime) : '';
    if (text === this.shownText) return;
    this.shownText = text;
    this.line.replaceChildren(
      ...tokenize(text).map((t) => {
        if (!t.word) return document.createTextNode(t.text);
        const span = document.createElement('span');
        span.className = 'word';
        span.textContent = t.text;
        return span;
      }),
    );
  }

  private pause(): void {
    if (this.video && !this.video.paused) {
      this.video.pause();
      this.pausedByUs = true;
    }
  }

  private resume(): void {
    if (this.pausedByUs && this.video?.paused) void this.video.play();
    this.pausedByUs = false;
  }

  private closePopup(): void {
    if (this.popup.hidden) return;
    this.popup.hidden = true;
    this.line.querySelector('.word.active')?.classList.remove('active');
    if (!this.hovering) this.resume();
  }

  private async onWordClick(e: MouseEvent): Promise<void> {
    const target = e.target as HTMLElement;
    if (!target.classList?.contains('word')) return;
    this.pause();
    this.line.querySelector('.word.active')?.classList.remove('active');
    target.classList.add('active');

    const word = target.textContent ?? '';
    this.popup.replaceChildren(el('h3', word), el('div', 'Looking up…', 'empty'));
    this.popup.hidden = false;
    this.positionPopup(target);

    const result = await this.lookup(word);
    if (!target.classList.contains('active')) return; // another word was clicked meanwhile
    this.popup.replaceChildren(...renderResult(result, this.settings.language));
    this.positionPopup(target);
  }

  private positionPopup(anchor: HTMLElement): void {
    const box = this.host.getBoundingClientRect();
    const a = anchor.getBoundingClientRect();
    const width = this.popup.offsetWidth;
    const left = Math.min(Math.max(a.left + a.width / 2 - box.left - width / 2, 8), box.width - width - 8);
    this.popup.style.left = `${left}px`;
    this.popup.style.bottom = `${box.bottom - a.top + 10}px`;
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function renderSenses(entry: DictEntry): HTMLElement[] {
  return (entry.s ?? []).flatMap(([pos, glosses]) => {
    const list = el('ol');
    list.append(...glosses.map((g) => el('li', g)));
    return [el('div', pos, 'pos'), list];
  });
}

function renderResult(r: LookupResult, lang: Language): HTMLElement[] {
  const out: HTMLElement[] = [el('h3', r.query)];
  if (r.loading) {
    out.push(el('div', 'The dictionary is still loading (first run only). Try again in a minute.', 'empty'));
  } else if (!r.entry) {
    out.push(el('div', 'Not in the offline dictionary.', 'empty'));
  } else {
    for (const [lemma, description] of r.entry.f ?? []) out.push(el('div', description || `form of ${lemma}`, 'form'));
    out.push(...renderSenses(r.entry));
    for (const { word, entry } of r.lemmas) out.push(el('div', word, 'lemma'), ...renderSenses(entry));
  }
  const target = r.lemmas[0]?.word ?? r.matched ?? r.query;
  const link = el('a', `Open “${target}” in WordReference ↗`, 'wr');
  link.href = wordReferenceUrl(target, lang);
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  out.push(link);
  return out;
}
