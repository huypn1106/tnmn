import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ref, update, onDisconnect, serverTimestamp, onValue } from 'firebase/database';
import { rtdb } from '../../app/firebase';
import { useAuth } from '../../features/auth/useAuth';
import { STORAGE_SKIN_KEY, sanitizeSkin } from '../../features/stage/types';

export function usePresence(customServerId?: string) {
  const { user } = useAuth();
  const { serverId } = useParams<{ serverId: string }>();
  const activeServer = customServerId || serverId || null;

  useEffect(() => {
    if (!user) return;

    const presenceRef = ref(rtdb, `presence/${user.uid}`);
    const connectedRef = ref(rtdb, '.info/connected');

    const updateCurrentPresence = () => {
      let savedSkin = null;
      try {
        const raw = localStorage.getItem(STORAGE_SKIN_KEY);
        if (raw) savedSkin = sanitizeSkin(JSON.parse(raw), user.uid);
      } catch {}

      update(presenceRef, {
        online: true,
        activeServerId: activeServer,
        lastSeen: serverTimestamp(),
        ...(savedSkin ? { stageSkin: savedSkin } : {}),
      });
    };

    const unsubscribe = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        // We are connected (or reconnected)
        onDisconnect(presenceRef).update({
          online: false,
          activeServerId: null,
          lastSeen: serverTimestamp(),
        });

        updateCurrentPresence();
      }
    });

    // Also immediately update when activeServer changes while connected
    updateCurrentPresence();

    // Heartbeat every 30s to keep presence fresh and prevent stale state
    const heartbeat = setInterval(() => {
      updateCurrentPresence();
    }, 30000);

    return () => {
      unsubscribe();
      clearInterval(heartbeat);
      // Note: We do NOT write online: false on React cleanup/route transition
      // onDisconnect handles real disconnects when the browser tab closes.
    };
  }, [user?.uid, activeServer]);
}
