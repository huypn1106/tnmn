export interface ResolvedTrack {
  videoId: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
}

const cache = new Map<string, ResolvedTrack>();

export async function resolveTrackToYouTube(
  searchQuery: string
): Promise<ResolvedTrack | null> {
  if (cache.has(searchQuery)) return cache.get(searchQuery)!;

  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('q', searchQuery);
  url.searchParams.set('type', 'video');
  url.searchParams.set('maxResults', '1');
  url.searchParams.set('key', import.meta.env.VITE_YT_API_KEY);

  try {
    const res = await fetch(url.toString());
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.error('YouTube API Error:', res.status, errData);
      throw new Error(`YouTube API returned ${res.status}: ${errData.error?.message || 'Unknown error'}`);
    }
    const data = await res.json();
    const item = data.items?.[0];
    if (!item) return null;

    const resolved: ResolvedTrack = {
      videoId: item.id.videoId,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails.medium.url,
      channelTitle: item.snippet.channelTitle,
    };
    cache.set(searchQuery, resolved);
    return resolved;
  } catch (err) {
    console.error('Failed to resolve track to YouTube:', err);
    return null;
  }
}
