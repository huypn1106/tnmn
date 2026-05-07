import { collection, doc, updateDoc, writeBatch, serverTimestamp, getDocs, query, orderBy, limit, increment } from 'firebase/firestore';
import { db } from '../../app/firebase';
import type { Track } from './types';

async function getLastTrackOrder(serverId: string, playlistId: string): Promise<number> {
  const ref = collection(db, 'servers', serverId, 'playlists', playlistId, 'tracks');
  const q = query(ref, orderBy('order', 'desc'), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return 0;
  return snap.docs[0].data().order || 0;
}

export async function addTrackToPlaylist(
  serverId: string,
  playlistId: string,
  track: Omit<Track, 'id' | 'order' | 'addedAt'>,
  addedBy: string
): Promise<void> {
  const tracksRef = collection(db, 'servers', serverId, 'playlists', playlistId, 'tracks');
  const lastOrder = await getLastTrackOrder(serverId, playlistId);

  const batch = writeBatch(db);

  const trackRef = doc(tracksRef);
  batch.set(trackRef, {
    ...track,
    addedBy,
    order: lastOrder + 1000,
    addedAt: serverTimestamp(),
  });

  const playlistRef = doc(db, 'servers', serverId, 'playlists', playlistId);
  batch.update(playlistRef, {
    trackCount: increment(1),
    totalDuration: increment(track.duration ?? 0),
  });

  await batch.commit();
}

export async function removeTrackFromPlaylist(
  serverId: string,
  playlistId: string,
  trackId: string,
  duration: number
): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'servers', serverId, 'playlists', playlistId, 'tracks', trackId));
  batch.update(doc(db, 'servers', serverId, 'playlists', playlistId), {
    trackCount: increment(-1),
    totalDuration: increment(-duration),
  });
  await batch.commit();
}

export async function updateTrackOrderInPlaylist(
  serverId: string,
  playlistId: string,
  trackId: string,
  newOrder: number
): Promise<void> {
  await updateDoc(doc(db, 'servers', serverId, 'playlists', playlistId, 'tracks', trackId), { order: newOrder });
}
