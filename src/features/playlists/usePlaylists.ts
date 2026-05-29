import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../../app/firebase';
import type { Playlist, Track } from './types';

export function usePlaylists(serverId: string | undefined) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!serverId) {
      setPlaylists([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ref = collection(db, 'servers', serverId, 'playlists');
    const q = query(ref, orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setPlaylists(snap.docs.map(d => ({ id: d.id, ...d.data() } as Playlist)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [serverId]);

  return { playlists, loading };
}

export function useTracks(serverId: string | undefined, playlistId: string | null | undefined) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!serverId || !playlistId) {
      setTracks([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    let unsubscribe: () => void;

    // First fetch the playlist to see if it's a shared proxy
    const playlistRef = doc(db, 'servers', serverId, 'playlists', playlistId);
    import('firebase/firestore').then(({ getDoc }) => {
      getDoc(playlistRef).then(snap => {
        const data = snap.data() as Playlist;
        let targetServerId = serverId;
        let targetPlaylistId = playlistId;

        if (data?.source === 'shared' && data?.sharedFrom && data?.sharedPlaylistId) {
          targetServerId = data.sharedFrom;
          targetPlaylistId = data.sharedPlaylistId;
        }

        const ref = collection(db, 'servers', targetServerId, 'playlists', targetPlaylistId, 'tracks');
        const q = query(ref, orderBy('order', 'asc'));
        unsubscribe = onSnapshot(q, (tracksSnap) => {
          setTracks(tracksSnap.docs.map(d => ({ id: d.id, ...d.data() } as Track)));
          setLoading(false);
        });
      }).catch(err => {
        console.error(err);
        setLoading(false);
      });
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [serverId, playlistId]);

  return { tracks, loading };
}

export function useAllTracks(serverId: string | undefined) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const { playlists } = usePlaylists(serverId);

  useEffect(() => {
    if (!serverId || !playlists.length) {
      if (!loading) setLoading(true);
      return;
    }

    const unsubscribers: (() => void)[] = [];
    const playlistTracks: Record<string, Track[]> = {};

    playlists.forEach(p => {
      let targetServerId = serverId;
      let targetPlaylistId = p.id;

      if (p.source === 'shared' && p.sharedFrom && p.sharedPlaylistId) {
        targetServerId = p.sharedFrom;
        targetPlaylistId = p.sharedPlaylistId;
      }

      const ref = collection(db, 'servers', targetServerId, 'playlists', targetPlaylistId, 'tracks');
      const q = query(ref, orderBy('order', 'asc'));
      const unsub = onSnapshot(q, (snap) => {
        playlistTracks[p.id] = snap.docs.map(d => ({ id: d.id, ...d.data(), playlistId: p.id } as any as Track));
        
        // Merge all tracks, sorted by playlist order then track order
        const merged = playlists
          .filter(pl => playlistTracks[pl.id])
          .flatMap(pl => playlistTracks[pl.id]);
        
        setTracks(merged);
        setLoading(false);
      });
      unsubscribers.push(unsub);
    });

    return () => unsubscribers.forEach(unsub => unsub());
  }, [serverId, playlists]);

  return { tracks, loading };
}
