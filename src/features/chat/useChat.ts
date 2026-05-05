import { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../app/firebase';
import { useAuth } from '../auth/useAuth';

export interface Message {
  id: string;
  text: string;
  userId: string;
  displayName: string;
  photoURL: string;
  createdAt: any;
}

export function useChat(serverId: string | undefined) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!serverId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'servers', serverId, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(msgs.reverse());
      setLoading(false);
    });

    return () => unsubscribe();
  }, [serverId]);

  const sendMessage = async (text: string) => {
    if (!user || !serverId || !text.trim()) return;

    await addDoc(collection(db, 'servers', serverId, 'messages'), {
      text,
      userId: user.uid,
      displayName: user.displayName,
      photoURL: user.photoURL,
      createdAt: serverTimestamp()
    });
  };

  return { messages, loading, sendMessage };
}
