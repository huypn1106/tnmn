import { Timestamp } from 'firebase/firestore';

export interface Playlist {
  id: string;
  name: string;
  description: string | null;
  coverURL: string | null;
  createdBy: string;
  createdAt: Timestamp | Date | { seconds: number; nanoseconds?: number } | null;
  trackCount: number;
  totalDuration: number;
  source: 'manual' | 'youtube_import' | 'llm' | 'shared';
  llmPrompt: string | null;
  order: number;
  isShared?: boolean;
  sharedFrom?: string;
  sharedPlaylistId?: string;
}

export interface TrackAddedBy {
  uid: string;
  displayName?: string;
  avatar?: string;
  photoURL?: string;
}

export interface Track {
  id: string;
  source: 'youtube' | 'soundcloud' | 'url';
  sourceId: string;
  title: string;
  thumbnail: string;
  duration: number;
  addedBy: string | TrackAddedBy;
  addedByName?: string;
  order: number;
  addedAt: Timestamp | Date | { seconds: number; nanoseconds?: number } | null;
}

