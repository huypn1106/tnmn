import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../app/firebase';
import type { Track, TrackAddedBy } from './types';

export function getTrackAddedBy(track: Track): { uid: string; displayName: string; avatar: string } {
  if (typeof track.addedBy === 'object' && track.addedBy !== null) {
    const raw = track.addedBy as TrackAddedBy;
    return {
      uid: raw.uid || '',
      displayName: raw.displayName || track.addedByName || 'Member',
      avatar: raw.avatar || raw.photoURL || '',
    };
  }

  return {
    uid: typeof track.addedBy === 'string' ? track.addedBy : '',
    displayName: track.addedByName || 'Member',
    avatar: '',
  };
}

export function useUserProfiles(uids: string[]) {
  const [profiles, setProfiles] = useState<Record<string, { displayName: string; photoURL: string }>>({});
  const uidsKey = uids.filter(Boolean).sort().join(',');

  useEffect(() => {
    if (!uidsKey) return;
    const uniqueUids = uidsKey.split(',');

    uniqueUids.forEach(async (uid) => {
      if (!uid) return;
      try {
        const snap = await getDoc(doc(db, 'users', uid));
        if (snap.exists()) {
          const data = snap.data() as { displayName?: string; username?: string; photoURL?: string };
          setProfiles((prev) => {
            if (prev[uid]) return prev;
            return {
              ...prev,
              [uid]: {
                displayName: data.displayName || data.username || 'Member',
                photoURL: data.photoURL || '',
              },
            };
          });
        }
      } catch (err) {
        console.error('Error fetching user profile for', uid, err);
      }
    });
  }, [uidsKey]);

  return profiles;
}

interface TimestampLike {
  toDate?: () => Date;
  seconds?: number;
}

export function formatRelativeTime(timestamp: unknown): string {
  if (!timestamp) return '';
  let date: Date | null = null;

  try {
    const ts = timestamp as TimestampLike;
    if (typeof ts.toDate === 'function') {
      date = ts.toDate();
    } else if (typeof ts.seconds === 'number') {
      date = new Date(ts.seconds * 1000);
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'number') {
      date = new Date(timestamp);
    } else if (typeof timestamp === 'string') {
      const parsed = new Date(timestamp);
      if (!isNaN(parsed.getTime())) date = parsed;
    }
  } catch {
    return '';
  }

  if (!date || isNaN(date.getTime())) return '';

  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - date.getTime()) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatExactDate(timestamp: unknown): string {
  if (!timestamp) return '';
  let date: Date | null = null;

  try {
    const ts = timestamp as TimestampLike;
    if (typeof ts.toDate === 'function') {
      date = ts.toDate();
    } else if (typeof ts.seconds === 'number') {
      date = new Date(ts.seconds * 1000);
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'number') {
      date = new Date(timestamp);
    } else if (typeof timestamp === 'string') {
      const parsed = new Date(timestamp);
      if (!isNaN(parsed.getTime())) date = parsed;
    }
  } catch {
    return '';
  }

  if (!date || isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

export function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
