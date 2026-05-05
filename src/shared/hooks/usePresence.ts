import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ref, set, onDisconnect, serverTimestamp, onValue } from 'firebase/database';
import { rtdb } from '../../app/firebase';
import { useAuth } from '../../features/auth/useAuth';

export function usePresence() {
  const { user } = useAuth();
  const { serverId } = useParams<{ serverId: string }>();

  useEffect(() => {
    if (!user) return;

    const presenceRef = ref(rtdb, `presence/${user.uid}`);
    const connectedRef = ref(rtdb, '.info/connected');

    const unsubscribe = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        // We are connected (or reconnected)
        onDisconnect(presenceRef).set({
          online: false,
          activeServerId: null,
          lastSeen: serverTimestamp(),
        });

        set(presenceRef, {
          online: true,
          activeServerId: serverId || null,
          lastSeen: serverTimestamp(),
        });
      }
    });

    return () => {
      unsubscribe();
      set(presenceRef, {
        online: false,
        activeServerId: null,
        lastSeen: serverTimestamp(),
      });
    };
  }, [user, serverId]);
}
