import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../app/firebase';

export interface QueueItem {
  id: string;
  source: 'youtube' | 'soundcloud';
  sourceId: string;
  title: string;
  thumbnail: string;
  duration: number;
  addedBy: string;
  addedByName?: string;
  order: number;
}

export function useQueue(serverId: string | undefined) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!serverId) {
      setQueue([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'servers', serverId, 'queue'),
      orderBy('order', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const queueData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as QueueItem[];
      setQueue(queueData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching queue:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [serverId]);

  const removeItem = async (itemId: string) => {
    if (!serverId) return;
    await deleteDoc(doc(db, 'servers', serverId, 'queue', itemId));
  };

  const updateItemOrder = async (itemId: string, newOrder: number) => {
    if (!serverId) return;
    await updateDoc(doc(db, 'servers', serverId, 'queue', itemId), { order: newOrder });
  };

  return { queue, loading, removeItem, updateItemOrder };
}
