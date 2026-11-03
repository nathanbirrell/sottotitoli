import { browser } from 'wxt/browser';
import { isLanguage, LANGUAGES } from '@/lib/languages';
import { DEFAULT_SETTINGS, type DictStatus, type RuntimeMessage, type Settings } from '@/lib/messages';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const language = $<HTMLSelectElement>('language');
const enabled = $<HTMLInputElement>('enabled');
const pauseOnHover = $<HTMLInputElement>('pauseOnHover');
const hidePlexSubtitles = $<HTMLInputElement>('hidePlexSubtitles');
const fontSize = $<HTMLInputElement>('fontSize');
const dict = $<HTMLParagraphElement>('dict');
const hint = $<HTMLParagraphElement>('hint');

const stored = await browser.storage.local.get('settings');
let settings: Settings = { ...DEFAULT_SETTINGS, ...(stored.settings as Partial<Settings> | undefined) };
language.value = settings.language;
enabled.checked = settings.enabled;
pauseOnHover.checked = settings.pauseOnHover;
hidePlexSubtitles.checked = settings.hidePlexSubtitles;
fontSize.value = String(settings.fontSize);

function save() {
  settings = {
    language: isLanguage(language.value) ? language.value : DEFAULT_SETTINGS.language,
    enabled: enabled.checked,
    pauseOnHover: pauseOnHover.checked,
    hidePlexSubtitles: hidePlexSubtitles.checked,
    fontSize: Number(fontSize.value),
  };
  void browser.storage.local.set({ settings });
}
language.addEventListener('change', () => {
  save();
  showHint();
  void refreshStatus();
});
enabled.addEventListener('change', save);
pauseOnHover.addEventListener('change', save);
hidePlexSubtitles.addEventListener('change', save);
fontSize.addEventListener('input', save);

function showHint() {
  hint.textContent = `No ${LANGUAGES[settings.language].name} track on Plex? Drop a .srt, .vtt or .ass file onto the player.`;
}
showHint();

let statusTimer = 0;
async function refreshStatus() {
  clearTimeout(statusTimer);
  const s = (await browser.runtime.sendMessage({ type: 'dict-status' } satisfies RuntimeMessage)) as DictStatus;
  const { name } = LANGUAGES[settings.language];
  if (s.ready) dict.textContent = `Dictionary ready: ${s.count.toLocaleString()} ${name} words and forms.`;
  else if (s.error) dict.textContent = `Dictionary import failed: ${s.error}`;
  else dict.textContent = `Importing ${name} dictionary… ${s.count.toLocaleString()} entries so far.`;
  if (!s.ready) statusTimer = window.setTimeout(refreshStatus, 1000);
}
void refreshStatus();
