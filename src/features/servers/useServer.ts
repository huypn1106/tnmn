import { useState, useEffect } from 'react';
import { doc, onSnapshot, collection, query, where, getDocs, getDoc } from 'firebase/firestore';
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
    setServer(null);
    setResolvedId(null);

    let active = true;
    let unsubscribe: () => void = () => {};

    const resolveAndWatch = async () => {
      try {
        // 1. Try by ID first
        const docRef = doc(db, 'servers', serverId);
        const docSnap = await getDoc(docRef);
        
        if (!active) return;

        let targetId = '';
        if (docSnap.exists()) {
          targetId = docSnap.id;
        } else {
          // 2. Try by slug
          const q = query(collection(db, 'servers'), where('slug', '==', serverId));
          const snap = await getDocs(q);
          if (!active) return;
          
          if (!snap.empty) {
            targetId = snap.docs[0].id;
          }
        }

        if (targetId && active) {
          unsubscribe = onSnapshot(doc(db, 'servers', targetId), (s) => {
            if (s.exists() && active) {
              setServer({ id: s.id, ...s.data() } as Server);
              setResolvedId(s.id);
            }
            setLoading(false);
          });
        } else if (active) {
          setServer(null);
          setResolvedId(null);
          setLoading(false);
        }
      } catch (error) {
        console.error("Error resolving server:", error);
        if (active) setLoading(false);
      }
    };

    resolveAndWatch();
    
    return () => {
      active = false;
      unsubscribe();
    };
  }, [serverId]);

  return { server, resolvedId, loading };
}
