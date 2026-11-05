import { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../app/firebase';
import { useAuth } from '../auth/useAuth';

export interface MessageReactionItem {
  uid: string;
  username: string;
}

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
  reactions?: Record<string, MessageReactionItem[]>;
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
          username: data.username || data.displayName || 'Unknown',
          reactions: data.reactions || {},
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
      replyTo: replyTo || null,
      reactions: {}
    });
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user || !serverId) return;
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;

    const myUid = user.uid;
    const myUsername = profile?.username || user.displayName || 'user';

    const curReactions = msg.reactions || {};
    const currentList = curReactions[emoji] || [];
    const hasReacted = currentList.some(r => r.uid === myUid);

    const updatedList = hasReacted
      ? currentList.filter(r => r.uid !== myUid)
      : [...currentList, { uid: myUid, username: myUsername }];

    const updatedReactions = { ...curReactions };
    if (updatedList.length > 0) {
      updatedReactions[emoji] = updatedList;
    } else {
      delete updatedReactions[emoji];
    }

    try {
      await updateDoc(doc(db, 'servers', serverId, 'messages', messageId), {
        reactions: updatedReactions
      });
    } catch (err) {
      console.error('Failed to toggle reaction:', err);
    }
  };

  return { messages, loading, sendMessage, toggleReaction, loadMore, hasMore };
}
