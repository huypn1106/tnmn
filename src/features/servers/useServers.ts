import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../app/firebase';
import { useAuth } from '../auth/useAuth';

export interface Server {
  id: string;
  name: string;
  coverURL: string | null;
  ownerId: string;
  members: string[];
  djId: string;
  inviteToken: string;
  createdAt: any;
}

export function useServers() {
  const { user } = useAuth();
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'servers'),
      where('members', 'array-contains', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const serversData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Server[];
      setServers(serversData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching servers:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  return { servers, loading };
}
