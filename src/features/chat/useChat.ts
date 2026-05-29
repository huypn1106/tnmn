import { useEffect, useState } from 'react';
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
  replyTo?: {
    id: string;
    text: string;
    username: string;
  } | null;
}

export function useChat(serverId: string | undefined) {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [limitCount, setLimitCount] = useState(50);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    if (!serverId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'servers', serverId, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
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
      setHasMore(msgs.length === limitCount);
    });

    return () => unsubscribe();
  }, [serverId, limitCount]);

  const loadMore = () => {
    if (!loading && hasMore) {
      setLimitCount(prev => prev + 50);
    }
  };

  const sendMessage = async (text: string, playbackState?: Message['playbackState'], replyTo?: Message['replyTo']) => {
    if (!user || !serverId || !text.trim()) return;

    await addDoc(collection(db, 'servers', serverId, 'messages'), {
      text,
      userId: user.uid,
      username: profile?.username || user.displayName || 'Unknown',
      photoURL: user.photoURL,
      createdAt: serverTimestamp(),
      playbackState: playbackState || null,
      replyTo: replyTo || null
    });
  };

  return { messages, loading, sendMessage, loadMore, hasMore };
}
