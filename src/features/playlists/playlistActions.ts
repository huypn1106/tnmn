import { collection, doc, addDoc, updateDoc, writeBatch, serverTimestamp, getDocs, getDoc, query, orderBy, limit, deleteDoc } from 'firebase/firestore';
import { db } from '../../app/firebase';
import type { Playlist } from './types';

async function getLastPlaylistOrder(serverId: string): Promise<number> {
  const ref = collection(db, 'servers', serverId, 'playlists');
  const q = query(ref, orderBy('order', 'desc'), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return 0;
  return snap.docs[0].data().order || 0;
}

export async function createPlaylist(
  serverId: string,
  name: string,
  createdBy: string,
  source: 'manual' | 'llm' | 'youtube_import' = 'manual',
  llmPrompt: string | null = null
): Promise<string> {
  const ref = collection(db, 'servers', serverId, 'playlists');
  const lastOrder = await getLastPlaylistOrder(serverId);
  const docRef = await addDoc(ref, {
    name,
    description: null,
    coverURL: null,
    createdBy,
    createdAt: serverTimestamp(),
    trackCount: 0,
    totalDuration: 0,
    source,
    llmPrompt,
    order: lastOrder + 1000,
  });
  return docRef.id;
}

export async function updatePlaylist(
  serverId: string,
  playlistId: string,
  patch: Partial<Pick<Playlist, 'name' | 'description' | 'coverURL'>>
): Promise<void> {
  await updateDoc(
    doc(db, 'servers', serverId, 'playlists', playlistId),
    patch
  );
}

export async function deletePlaylist(
  serverId: string,
  playlistId: string
): Promise<void> {
  const tracksRef = collection(db, 'servers', serverId, 'playlists', playlistId, 'tracks');
  const tracksSnap = await getDocs(tracksRef);
  const batch = writeBatch(db);
  tracksSnap.docs.forEach(d => batch.delete(d.ref));
  batch.delete(doc(db, 'servers', serverId, 'playlists', playlistId));
  await batch.commit();
}

export async function setActivePlaylist(
  serverId: string,
  playlistId: string
): Promise<void> {
  await updateDoc(doc(db, 'servers', serverId), { activePlaylistId: playlistId });
}

export async function clonePlaylist(
  serverId: string,
  playlistId: string,
  userId: string
): Promise<string> {
  const originalRef = doc(db, 'servers', serverId, 'playlists', playlistId);
  const originalSnap = await getDoc(originalRef);
  
  if (!originalSnap.exists()) throw new Error('Playlist not found');
  const data = originalSnap.data();

  const lastOrder = await getLastPlaylistOrder(serverId);
  const newPlaylistRef = doc(collection(db, 'servers', serverId, 'playlists'));
  
  const tracksRef = collection(db, 'servers', serverId, 'playlists', playlistId, 'tracks');
  const tracksSnap = await getDocs(tracksRef);
  
  // A Firestore batch can only have 500 operations. 
  // We need 1 for the playlist, so we can do up to 499 tracks per batch.
  // To be safe, we chunk by 400.
  const chunks = [];
  let currentBatch = writeBatch(db);
  let opCount = 0;

  currentBatch.set(newPlaylistRef, {
    name: `${data.name} (Copy)`,
    description: data.description || null,
    coverURL: data.coverURL || null,
    createdBy: userId,
    createdAt: serverTimestamp(),
    trackCount: data.trackCount || 0,
    totalDuration: data.totalDuration || 0,
    source: data.source || 'manual',
    llmPrompt: data.llmPrompt || null,
    order: lastOrder + 1000,
  });
  opCount++;

  tracksSnap.docs.forEach(trackDoc => {
    if (opCount >= 400) {
      chunks.push(currentBatch.commit());
      currentBatch = writeBatch(db);
      opCount = 0;
    }
    const newTrackRef = doc(collection(db, 'servers', serverId, 'playlists', newPlaylistRef.id, 'tracks'));
    currentBatch.set(newTrackRef, trackDoc.data());
    opCount++;
  });
  
  chunks.push(currentBatch.commit());
  await Promise.all(chunks);

  return newPlaylistRef.id;
}

export async function reorderPlaylist(
  serverId: string,
  playlistId: string,
  newOrder: number
): Promise<void> {
  await updateDoc(doc(db, 'servers', serverId, 'playlists', playlistId), { order: newOrder });
}

export async function sharePlaylist(
  sourceServerId: string,
  playlistId: string,
  targetServerIds: string[],
  userId: string,
  playlistName: string
): Promise<void> {
  const originalRef = doc(db, 'servers', sourceServerId, 'playlists', playlistId);
  
  // Set the original as shared
  await updateDoc(originalRef, { isShared: true });

  // Create proxy documents in each target server
  const chunks = [];
  let currentBatch = writeBatch(db);
  let opCount = 0;

  for (const targetId of targetServerIds) {
    if (opCount >= 400) {
      chunks.push(currentBatch.commit());
      currentBatch = writeBatch(db);
      opCount = 0;
    }
    
    // Check if proxy already exists
    // We don't have a good way to check by sharedFrom/sharedPlaylistId without an index, but since we are just adding, we can let it duplicate if they share again, or we can just fetch and check
    // Actually just create the proxy
    const newProxyRef = doc(collection(db, 'servers', targetId, 'playlists'));
    currentBatch.set(newProxyRef, {
      name: playlistName,
      description: null,
      coverURL: null,
      createdBy: userId,
      createdAt: serverTimestamp(),
      trackCount: 0, // Track count and duration aren't maintained on the proxy directly
      totalDuration: 0,
      source: 'shared',
      llmPrompt: null,
      order: 9999, // Put at the bottom by default
      sharedFrom: sourceServerId,
      sharedPlaylistId: playlistId,
    });
    opCount++;
  }

  if (opCount > 0) {
    chunks.push(currentBatch.commit());
  }
  await Promise.all(chunks);
}

export async function unsharePlaylist(
  targetServerId: string,
  proxyPlaylistId: string
): Promise<void> {
  // We just delete the proxy playlist. We don't need to delete tracks since proxies have no tracks.
  await deleteDoc(doc(db, 'servers', targetServerId, 'playlists', proxyPlaylistId));
}
