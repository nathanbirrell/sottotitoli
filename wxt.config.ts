import { defineConfig } from 'wxt';

export default defineConfig({
  // Not `.output`: macOS hides dot-folders in Chrome's "Load unpacked" picker.
  outDir: 'dist',
  // MV3 on Firefox too: the Plex hook needs `world: 'MAIN'` content scripts.
  manifestVersion: 3,
  manifest: ({ browser }) => ({
    name: 'Sottotitoli',
    description: 'Clickable Italian subtitles with an offline Italian→English dictionary, for Plex Web.',
    permissions: ['storage'],
    action: { default_title: 'Sottotitoli' },
    ...(browser === 'firefox' && {
      browser_specific_settings: { gecko: { id: 'sottotitoli@nathanbirrell.me', strict_min_version: '128.0' } },
    }),
  }),
});
