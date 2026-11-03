import { browser } from 'wxt/browser';
import { DEFAULT_SETTINGS, type DictStatus, type RuntimeMessage, type Settings } from '@/lib/messages';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const enabled = $<HTMLInputElement>('enabled');
const pauseOnHover = $<HTMLInputElement>('pauseOnHover');
const hidePlexSubtitles = $<HTMLInputElement>('hidePlexSubtitles');
const fontSize = $<HTMLInputElement>('fontSize');
const dict = $<HTMLParagraphElement>('dict');

const stored = await browser.storage.local.get('settings');
let settings: Settings = { ...DEFAULT_SETTINGS, ...(stored.settings as Partial<Settings> | undefined) };
enabled.checked = settings.enabled;
pauseOnHover.checked = settings.pauseOnHover;
hidePlexSubtitles.checked = settings.hidePlexSubtitles;
fontSize.value = String(settings.fontSize);

function save() {
  settings = {
    enabled: enabled.checked,
    pauseOnHover: pauseOnHover.checked,
    hidePlexSubtitles: hidePlexSubtitles.checked,
    fontSize: Number(fontSize.value),
  };
  void browser.storage.local.set({ settings });
}
enabled.addEventListener('change', save);
pauseOnHover.addEventListener('change', save);
hidePlexSubtitles.addEventListener('change', save);
fontSize.addEventListener('input', save);

async function refreshStatus() {
  const s = (await browser.runtime.sendMessage({ type: 'dict-status' } satisfies RuntimeMessage)) as DictStatus;
  if (s.ready) dict.textContent = `Dictionary ready: ${s.count.toLocaleString()} Italian words and forms.`;
  else if (s.error) dict.textContent = `Dictionary import failed: ${s.error}`;
  else dict.textContent = `Importing dictionary… ${s.count.toLocaleString()} entries so far.`;
  if (!s.ready) setTimeout(refreshStatus, 1000);
}
void refreshStatus();
