import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ref, update, onDisconnect, serverTimestamp, onValue } from 'firebase/database';
import { rtdb } from '../../app/firebase';
import { useAuth } from '../../features/auth/useAuth';
import { STORAGE_SKIN_KEY, sanitizeSkin } from '../../features/stage/types';

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
        onDisconnect(presenceRef).update({
          online: false,
          activeServerId: null,
          lastSeen: serverTimestamp(),
        });

        let savedSkin = null;
        try {
          const raw = localStorage.getItem(STORAGE_SKIN_KEY);
          if (raw) savedSkin = sanitizeSkin(JSON.parse(raw), user.uid);
        } catch {}

        update(presenceRef, {
          online: true,
          activeServerId: serverId || null,
          lastSeen: serverTimestamp(),
          ...(savedSkin ? { stageSkin: savedSkin } : {}),
        });
      }
    });

    return () => {
      unsubscribe();
      update(presenceRef, {
        online: false,
        activeServerId: null,
        lastSeen: serverTimestamp(),
      });
    };
  }, [user, serverId]);
}
