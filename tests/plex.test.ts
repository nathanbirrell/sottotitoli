import { describe, expect, it } from 'vitest';
import { describeItem, parsePlaybackRequest, pickSubtitleStream, type PlexStream } from '@/lib/plex';

const SERVER = 'https://10-0-0-5.abc123.plex.direct:32400';

describe('parsePlaybackRequest', () => {
  it('reads timeline reports', () => {
    expect(parsePlaybackRequest(`${SERVER}/:/timeline?ratingKey=4521&key=%2Flibrary%2Fmetadata%2F4521&state=playing&time=1000&X-Plex-Token=abc`)).toEqual({
      origin: SERVER,
      ratingKey: '4521',
      token: 'abc',
      state: 'playing',
    });
  });

  it('reads playback decisions and falls back to a header token', () => {
    const url = `${SERVER}/video/:/transcode/universal/decision?path=%2Flibrary%2Fmetadata%2F99&mediaIndex=0`;
    expect(parsePlaybackRequest(url, 'hdr')).toEqual({ origin: SERVER, ratingKey: '99', token: 'hdr', burnSubtitles: false });
  });

  it('flags transcodes that burn subtitles in', () => {
    const url = `${SERVER}/video/:/transcode/universal/start.mpd?path=%2Flibrary%2Fmetadata%2F99&subtitles=burn`;
    expect(parsePlaybackRequest(url)?.burnSubtitles).toBe(true);
  });

  it('ignores unrelated requests', () => {
    expect(parsePlaybackRequest(`${SERVER}/library/sections`)).toBeNull();
    expect(parsePlaybackRequest('https://metadata.provider.plex.tv/library/metadata/5d776b59ad5437001f79c6f8')).toBeNull();
    expect(parsePlaybackRequest('not a url', null, 'about:blank')).toBeNull();
  });
});

const sub = (s: Partial<PlexStream>): PlexStream => ({ id: 1, streamType: 3, ...s });

describe('pickSubtitleStream', () => {
  it('prefers a selected, non-forced Italian text stream', () => {
    const meta = {
      Media: [{ Part: [{ Stream: [
        { id: 10, streamType: 1 },
        sub({ id: 11, languageCode: 'eng', key: '/library/streams/11' }),
        sub({ id: 12, languageCode: 'ita', forced: true, key: '/library/streams/12' }),
        sub({ id: 13, languageTag: 'it', codec: 'srt', key: '/library/streams/13' }),
        sub({ id: 14, languageCode: 'ita', codec: 'pgs', selected: true }),
      ] }] }],
    };
    expect(pickSubtitleStream(meta, 'it')?.id).toBe(13);
  });

  it('returns null when there is no Italian text stream', () => {
    expect(pickSubtitleStream({ Media: [{ Part: [{ Stream: [sub({ languageCode: 'eng' })] }] }] }, 'it')).toBeNull();
    expect(pickSubtitleStream({}, 'it')).toBeNull();
  });

  it('picks Spanish streams by code or name, ignoring Italian ones', () => {
    const meta = {
      Media: [{ Part: [{ Stream: [
        sub({ id: 20, languageCode: 'ita', key: '/library/streams/20' }),
        sub({ id: 21, languageTag: 'es-419', key: '/library/streams/21' }),
      ] }] }],
    };
    expect(pickSubtitleStream(meta, 'es')?.id).toBe(21);
    expect(pickSubtitleStream(meta, 'it')?.id).toBe(20);
    expect(pickSubtitleStream({ Media: [{ Part: [{ Stream: [sub({ id: 22, language: 'Español' })] }] }] }, 'es')?.id).toBe(22);
    expect(pickSubtitleStream({ Media: [{ Part: [{ Stream: [sub({ id: 23, languageCode: 'spa' })] }] }] }, 'it')).toBeNull();
  });

  it('describes episodes and movies', () => {
    expect(describeItem({ grandparentTitle: 'Il Commissario Montalbano', parentIndex: 1, index: 2 })).toBe('Il Commissario Montalbano S1E2');
    expect(describeItem({ title: 'La grande bellezza' })).toBe('La grande bellezza');
  });
});
