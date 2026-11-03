# Sottotitoli

A Language Reactor–style browser extension for learning Italian on **Plex Web**: it draws the
Italian subtitle track as clickable words over the video and looks each word up in an offline
Italian→English dictionary (Wiktionary via [kaikki.org](https://kaikki.org)), with a link to
WordReference.

## How it works

- `entrypoints/plex-hook.content.ts` runs in the page's JS world and watches Plex Web's requests
  to your media server (`/video/:/transcode/universal/decision` and `/:/timeline`). When a new
  item starts playing it fetches `/library/metadata/<ratingKey>` with the token Plex Web is
  already using, picks the Italian text subtitle stream and downloads it.
- `entrypoints/plex.content/` receives the subtitle text, parses it (SRT, VTT, ASS) and renders
  the active cue over the `<video>` in a shadow root. Clicking a word pauses playback and opens
  the dictionary popup; hovering the line pauses too (configurable).
- `entrypoints/background.ts` imports the bundled dictionary (`public/dict/it-en.ndjson.gz`) into
  IndexedDB on first install (about a minute) and answers lookups. Inflected forms resolve to
  their lemma (`parlavo` → `parlare`), and elisions and enclitic pronouns are handled
  (`dell'`, `parlarti`).

## Using it

1. Your Plex item needs an **Italian text subtitle** (a sidecar `.it.srt` / `.ita.srt` next to the
   video, or an embedded SRT/ASS track). Image-based subtitles (PGS/VobSub) can't be used.
2. Play it in Plex Web (app.plex.tv or your server's `/web`). Plex's own subtitles are hidden while
   Sottotitoli's are showing, unless Plex burns them into the video during a transcode; then set them to None.
3. No Italian track in Plex? Drag a `.srt`, `.vtt` or `.ass` file onto the player.

## Development

```bash
pnpm install
pnpm dev            # Chrome, with hot reload
pnpm dev:firefox    # Firefox
pnpm test
pnpm typecheck
pnpm build && pnpm build:firefox   # → dist/chrome-mv3, dist/firefox-mv3
```

Load a production build manually: Chrome → `chrome://extensions` → Developer mode → *Load
unpacked* → `dist/chrome-mv3`. Firefox → `about:debugging#/runtime/this-firefox` → *Load
Temporary Add-on* → `dist/firefox-mv3/manifest.json`.

### Rebuilding the dictionary

```bash
mkdir -p data
curl -L -o data/kaikki-italian.jsonl.gz \
  https://kaikki.org/dictionary/Italian/kaikki.org-dictionary-Italian.jsonl.gz
pnpm build:dict
```

Bump `DICT_VERSION` in `lib/dictionary.ts` so installed copies re-import it.

## Notes

- SBS On Demand was the original target, but its Italian programmes have English subtitles burned
  into the picture and no Italian text track, so there is nothing to make clickable.
- RaiPlay serves Italian `.srt` files, but most of its video is geo-blocked outside Italy.
- Dictionary data: Wiktionary, CC BY-SA 4.0.
