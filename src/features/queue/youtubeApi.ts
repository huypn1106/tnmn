const API_KEY = import.meta.env.VITE_YT_API_KEY;

export interface YouTubeSearchResult {
  id: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
}

export async function searchYouTube(query: string): Promise<YouTubeSearchResult[]> {
  if (!API_KEY) {
    throw new Error('YouTube API key is missing');
  }

  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
      query
    )}&type=video&maxResults=10&key=${API_KEY}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to search YouTube');
  }

  const data = await response.json();
  return data.items.map((item: any) => ({
    id: item.id.videoId,
    title: item.snippet.title,
    thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
    channelTitle: item.snippet.channelTitle,
  }));
}
