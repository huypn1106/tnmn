import { Timestamp } from 'firebase/firestore';

export interface Playlist {
  id: string;
  name: string;
  description: string | null;
  coverURL: string | null;
  createdBy: string;
  createdAt: Timestamp | any;
  trackCount: number;
  totalDuration: number;
  source: 'manual' | 'youtube_import' | 'llm';
  llmPrompt: string | null;
  order: number;
}

export interface Track {
  id: string;
  source: 'youtube' | 'soundcloud' | 'url';
  sourceId: string;
  title: string;
  thumbnail: string;
  duration: number;
  addedBy: string;
  addedByName?: string;
  order: number;
  addedAt: Timestamp | any;
}
