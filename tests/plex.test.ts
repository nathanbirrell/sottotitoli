import { describe, expect, it } from 'vitest';
import { describeItem, parsePlaybackRequest, pickItalianStream, type PlexStream } from '@/lib/plex';

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

describe('pickItalianStream', () => {
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
    expect(pickItalianStream(meta)?.id).toBe(13);
  });

  it('returns null when there is no Italian text stream', () => {
    expect(pickItalianStream({ Media: [{ Part: [{ Stream: [sub({ languageCode: 'eng' })] }] }] })).toBeNull();
    expect(pickItalianStream({})).toBeNull();
  });

  it('describes episodes and movies', () => {
    expect(describeItem({ grandparentTitle: 'Il Commissario Montalbano', parentIndex: 1, index: 2 })).toBe('Il Commissario Montalbano S1E2');
    expect(describeItem({ title: 'La grande bellezza' })).toBe('La grande bellezza');
  });
});
