import { collection, doc, runTransaction, serverTimestamp, getDocs, getDoc } from 'firebase/firestore';
import { db, rtdb } from '../../app/firebase';
import { ref, get, update } from 'firebase/database';

export async function migrateQueueToPlaylist(
  serverId: string,
  ownerId: string
): Promise<void> {
  const serverRef = doc(db, 'servers', serverId);

  await runTransaction(db, async (tx) => {
    const serverSnap = await tx.get(serverRef);
    if (serverSnap.data()?.defaultPlaylistId) return; // already done

    const queueSnap = await getDocs(collection(db, 'servers', serverId, 'queue'));

    const playlistRef = doc(collection(db, 'servers', serverId, 'playlists'));
    
    let totalDuration = 0;
    queueSnap.docs.forEach((d) => {
      totalDuration += (d.data().duration ?? 0);
    });

    tx.set(playlistRef, {
      name: 'Queue',
      description: null,
      coverURL: null,
      createdBy: ownerId,
      createdAt: serverTimestamp(),
      trackCount: queueSnap.size,
      totalDuration: totalDuration,
      source: 'manual',
      llmPrompt: null,
      order: 1000,
    });

    queueSnap.docs.forEach((trackDoc) => {
      const trackRef = doc(collection(db, 'servers', serverId, 'playlists', playlistRef.id, 'tracks'));
      tx.set(trackRef, trackDoc.data());
    });

    tx.update(serverRef, {
      defaultPlaylistId: playlistRef.id,
      activePlaylistId: playlistRef.id,
    });

    queueSnap.docs.forEach((d) => tx.delete(d.ref));
  });

  const pbSnap = await get(ref(rtdb, `playback/${serverId}`));
  if (pbSnap.exists()) {
    const sDoc = await getDoc(serverRef);
    const activePlaylistId = sDoc.data()?.activePlaylistId;
    if (activePlaylistId) {
      await update(ref(rtdb, `playback/${serverId}`), {
        playlistId: activePlaylistId,
      });
    }
  }
}
