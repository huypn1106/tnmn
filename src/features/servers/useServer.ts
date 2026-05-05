import { useState, useEffect } from 'react';
import { doc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../app/firebase';
import type { Server } from './useServers';

export function useServer(serverId: string | undefined) {
  const [server, setServer] = useState<Server | null>(null);
  const [resolvedId, setResolvedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!serverId) {
      setServer(null);
      setResolvedId(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    let unsubscribe: () => void = () => {};

    const resolveAndWatch = async () => {
      // 1. Try by ID first
      const docRef = doc(db, 'servers', serverId);
      const unsub = onSnapshot(docRef, async (docSnap) => {
        if (docSnap.exists()) {
          setServer({ id: docSnap.id, ...docSnap.data() } as Server);
          setResolvedId(docSnap.id);
          setLoading(false);
        } else {
          // 2. Try by slug
          const q = query(collection(db, 'servers'), where('slug', '==', serverId));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const firstDoc = snap.docs[0];
            // Since slugs can change, we might want to watch the resolved ID instead
            // But for now, we'll just watch this specific doc reference
            const unsubSlug = onSnapshot(doc(db, 'servers', firstDoc.id), (s) => {
              if (s.exists()) {
                setServer({ id: s.id, ...s.data() } as Server);
                setResolvedId(s.id);
              }
              setLoading(false);
            });
            unsubscribe = unsubSlug;
          } else {
            setServer(null);
            setResolvedId(null);
            setLoading(false);
          }
        }
      });
      unsubscribe = unsub;
    };

    resolveAndWatch();
    return () => unsubscribe();
  }, [serverId]);

  return { server, resolvedId, loading };
}
