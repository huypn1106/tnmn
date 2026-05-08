import { useEffect, useState } from 'react';
import { doc, onSnapshot, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../../app/firebase';
import { useAuth } from '../auth/useAuth';

export interface FriendProfile {
  uid: string;
  username: string;
  displayName: string;
  photoURL: string;
}

export interface FriendRequest {
  from: string;
  status: 'pending' | 'accepted' | 'rejected';
}

export function useFriends() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), async (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const pendingRequests = (data.friendRequests || []).filter((r: any) => r.status === 'pending');
        setRequests(pendingRequests);
        
        const friendUids = data.friends || [];
        const profiles = await Promise.all(friendUids.map(async (uid: string) => {
          const d = await getDoc(doc(db, 'users', uid));
          return { uid, ...d.data() } as FriendProfile;
        }));
        setFriends(profiles);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const sendRequest = async (targetUid: string) => {
    if (!user) return;
    await updateDoc(doc(db, 'users', targetUid), {
      friendRequests: arrayUnion({ from: user.uid, status: 'pending' })
    });
  };

  const respondToRequest = async (request: FriendRequest, accept: boolean) => {
    if (!user) return;
    
    // Remove request from current user's list
    await updateDoc(doc(db, 'users', user.uid), {
      friendRequests: arrayRemove(request)
    });

    if (accept) {
      // Add mutual friendship
      await updateDoc(doc(db, 'users', user.uid), {
        friends: arrayUnion(request.from)
      });
      await updateDoc(doc(db, 'users', request.from), {
        friends: arrayUnion(user.uid)
      });
    }
  };

  return { friends, requests, loading, sendRequest, respondToRequest };
}
