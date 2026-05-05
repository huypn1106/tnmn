export interface TrackMetadata {
  source: 'youtube' | 'soundcloud';
  sourceId: string;
  title: string;
  thumbnail: string;
  duration: number;
}

export function parseYouTubeVideoId(url: string): string | null {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[7].length === 11) ? match[7] : null;
}

export function parseSoundCloudUrl(url: string): string | null {
  return (url.includes('soundcloud.com')) ? url : null;
}

export async function fetchTrackMetadata(url: string): Promise<TrackMetadata> {
  const ytId = parseYouTubeVideoId(url);
  if (ytId) {
    const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${ytId}&format=json`);
    const data = await response.json();
    return {
      source: 'youtube',
      sourceId: ytId,
      title: data.title,
      thumbnail: data.thumbnail_url,
      duration: 0, // oEmbed doesn't give duration for YT usually, will be updated on play
    };
  }

  const scUrl = parseSoundCloudUrl(url);
  if (scUrl) {
    const response = await fetch(`https://soundcloud.com/oembed?url=${scUrl}&format=json`);
    const data = await response.json();
    return {
      source: 'soundcloud',
      sourceId: scUrl,
      title: data.title,
      thumbnail: data.thumbnail_url,
      duration: 0,
    };
  }

  throw new Error('Unsupported source');
}
