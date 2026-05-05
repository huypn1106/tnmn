import { collection, writeBatch, doc, serverTimestamp, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../app/firebase';

const YT_API_KEY = import.meta.env.VITE_YT_API_KEY;

export function parseYouTubePlaylistId(url: string): string | null {
  const regExp = /[&?]list=([^#&?]+)/;
  const match = url.match(regExp);
  return match ? match[1] : null;
}

export async function importYouTubePlaylist(
  playlistId: string, 
  serverId: string, 
  userId: string,
  onProgress?: (count: number) => void
) {
  if (!YT_API_KEY) throw new Error('YouTube API Key missing');

  let tracks: any[] = [];
  let nextPageToken = '';
  
  // Fetch items from YT API
  do {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50&pageToken=${nextPageToken}&key=${YT_API_KEY}`
    );
    const data = await response.json();
    
    if (data.error) throw new Error(data.error.message);

    const items = data.items.map((item: any) => ({
      source: 'youtube',
      sourceId: item.snippet.resourceId.videoId,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
      duration: 0,
      addedBy: userId,
      addedAt: serverTimestamp(),
    }));

    tracks = [...tracks, ...items];
    nextPageToken = data.nextPageToken;
    if (onProgress) onProgress(tracks.length);

    // Limit to 200 items to stay within free tier limits/safety
    if (tracks.length >= 200) break;
  } while (nextPageToken);

  // Get current last order
  const q = query(collection(db, 'servers', serverId, 'queue'), orderBy('order', 'desc'), limit(1));
  const snap = await getDocs(q);
  let lastOrder = snap.empty ? 0 : snap.docs[0].data().order;

  // Batch write to Firestore
  const batchSize = 500;
  for (let i = 0; i < tracks.length; i += batchSize) {
    const batch = writeBatch(db);
    const chunk = tracks.slice(i, i + batchSize);
    
    chunk.forEach((track) => {
      lastOrder += 1000;
      const newDocRef = doc(collection(db, 'servers', serverId, 'queue'));
      batch.set(newDocRef, { ...track, order: lastOrder });
    });

    await batch.commit();
  }

  return tracks.length;
}
