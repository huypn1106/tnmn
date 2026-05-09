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
  track: Omit<Track, 'id' | 'order' | 'addedAt' | 'addedBy'>,
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
export async function addMultipleTracksToPlaylist(
  serverId: string,
  playlistId: string,
  tracks: Omit<Track, 'id' | 'order' | 'addedAt' | 'addedBy'>[],
  addedBy: string,
  replace = false
): Promise<void> {
  console.log(`[addMultipleTracksToPlaylist] Starting for server ${serverId}, playlist ${playlistId}, tracks: ${tracks.length}`);
  const batch = writeBatch(db);
  const tracksRef = collection(db, 'servers', serverId, 'playlists', playlistId, 'tracks');
  const playlistRef = doc(db, 'servers', serverId, 'playlists', playlistId);

  if (replace) {
    const snap = await getDocs(tracksRef);
    snap.docs.forEach(d => batch.delete(d.ref));
    batch.update(playlistRef, { trackCount: 0, totalDuration: 0 });
  }

  let currentOrder = 0;
  if (!replace) {
    const q = query(tracksRef, orderBy('order', 'desc'), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      currentOrder = snap.docs[0].data().order || 0;
    }
  }

  let addedDuration = 0;

  tracks.forEach((track) => {
    const trackRef = doc(tracksRef);
    currentOrder += 1000;
    addedDuration += (track.duration || 0);

    batch.set(trackRef, {
      ...track,
      addedBy,
      order: currentOrder,
      addedAt: serverTimestamp(),
    });
  });

  if (tracks.length > 0) {
    if (replace) {
      batch.update(playlistRef, {
        trackCount: tracks.length,
        totalDuration: addedDuration,
      });
    } else {
      batch.update(playlistRef, {
        trackCount: increment(tracks.length),
        totalDuration: increment(addedDuration),
      });
    }
  }

  await batch.commit();
}
