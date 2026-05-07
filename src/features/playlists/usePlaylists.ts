import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
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
    const ref = collection(db, 'servers', serverId, 'playlists', playlistId, 'tracks');
    const q = query(ref, orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setTracks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Track)));
      setLoading(false);
    });
    return () => unsubscribe();
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
      const ref = collection(db, 'servers', serverId, 'playlists', p.id, 'tracks');
      const q = query(ref, orderBy('order', 'asc'));
      const unsub = onSnapshot(q, (snap) => {
        playlistTracks[p.id] = snap.docs.map(d => ({ id: d.id, ...d.data(), playlistId: p.id } as Track));
        
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
