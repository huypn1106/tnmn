import { useEffect, useState, useRef } from 'react';
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../app/firebase';
import { useAuth } from '../auth/useAuth';

export interface Message {
  id: string;
  text: string;
  userId: string;
  username: string;
  photoURL: string;
  createdAt: any;
  playbackState?: {
    title?: string;
    thumbnail?: string;
    source?: string;
    sourceId?: string;
  } | null;
}

export function useChat(serverId: string | undefined, onNewMessage?: () => void) {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    if (!serverId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    isInitialLoad.current = true;
    const q = query(
      collection(db, 'servers', serverId, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          username: data.username || data.displayName || 'Unknown'
        };
      }) as Message[];
      
      const reversedMsgs = [...msgs].reverse();
      setMessages(reversedMsgs);
      setLoading(false);

      if (!isInitialLoad.current) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const msg = change.doc.data() as Message;
            if (msg.userId !== user?.uid) {
              onNewMessage?.();
            }
          }
        });
      }
      
      isInitialLoad.current = false;
    });

    return () => unsubscribe();
  }, [serverId, user?.uid, onNewMessage]);

  const sendMessage = async (text: string, playbackState?: Message['playbackState']) => {
    if (!user || !serverId || !text.trim()) return;

    await addDoc(collection(db, 'servers', serverId, 'messages'), {
      text,
      userId: user.uid,
      username: profile?.username || user.displayName || 'Unknown',
      photoURL: user.photoURL,
      createdAt: serverTimestamp(),
      playbackState: playbackState || null
    });
  };

  return { messages, loading, sendMessage };
}
