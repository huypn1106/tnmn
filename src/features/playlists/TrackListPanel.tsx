import { useState, useEffect, useRef } from 'react';
import { rtdb } from '../../app/firebase';
import { ref, update } from 'firebase/database';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { useTracks } from './usePlaylists';
import { usePlaybackSync } from '../playback/usePlaybackSync';
import WaveformBars from '../playback/WaveformBars';
import { removeTrackFromPlaylist, reorderTracksInPlaylist } from './trackActions';
import { useAuth } from '../auth/useAuth';
import { setActivePlaylist, deletePlaylist } from './playlistActions';
import PlaylistSettingsModal from './PlaylistSettingsModal';
import AudioVisualizer from '../playback/AudioVisualizer';
import type { Playlist, Track } from './types';
import ConfirmModal from '../../shared/ConfirmModal';
import { RecommendationsPanel } from '../llm/RecommendationsPanel';
import {
  getTrackAddedBy,
  formatRelativeTime,
  formatExactDate,
  formatDuration,
  useUserProfiles,
} from './trackUtils';

interface SortableTrackItemProps {
  item: Track;
  index: number;
  totalTracks: number;
  isPlaying: boolean;
  isDJ: boolean;
  canEdit: boolean;
  playbackPlaying: boolean;
  userProfiles: Record<string, { displayName: string; photoURL: string }>;
  onPlay: (item: Track) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onRemove: (item: Track) => void;
  trackRef: (el: HTMLDivElement | null) => void;
}

function SortableTrackItem({
  item,
  index,
  totalTracks,
  isPlaying,
  isDJ,
  canEdit,
  playbackPlaying,
  userProfiles,
  onPlay,
  onMoveUp,
  onMoveDown,
  onRemove,
  trackRef,
}: SortableTrackItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    disabled: !canEdit,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.35 : 1,
  };

  const addedInfo = getTrackAddedBy(item);
  const profileFallback = userProfiles[addedInfo.uid];
  const displayName =
    addedInfo.displayName !== 'Member'
      ? addedInfo.displayName
      : profileFallback?.displayName || 'Member';
  const avatar = addedInfo.avatar || profileFallback?.photoURL || '';

  const relativeTime = formatRelativeTime(item.addedAt);
  const exactDate = formatExactDate(item.addedAt);
  const durationStr = formatDuration(item.duration);

  const timeTooltip = exactDate
    ? `Added by ${displayName} • ${exactDate}`
    : `Added by ${displayName}`;

  const setCombinedRef = (el: HTMLDivElement | null) => {
    setNodeRef(el);
    trackRef(el);
  };

  return (
    <div
      ref={setCombinedRef}
      style={style}
      className={`group relative flex items-center gap-3 sm:gap-4 border p-2.5 sm:p-3 transition-all scroll-mt-12 bg-bg-2/30 ${
        isPlaying
          ? 'border-accent/50 bg-bg-3 shadow-sm'
          : 'border-transparent hover:border-rule hover:bg-bg-3/50'
      } ${isDragging ? 'shadow-2xl ring-1 ring-accent' : ''}`}
    >
      {/* Drag handle (DJ only) */}
      {canEdit && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="touch-none cursor-grab active:cursor-grabbing p-1 text-text-3/60 hover:text-accent transition-colors shrink-0"
          title="Drag to reorder"
          aria-label="Drag to reorder"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <circle cx="7" cy="4" r="1.5" />
            <circle cx="13" cy="4" r="1.5" />
            <circle cx="7" cy="10" r="1.5" />
            <circle cx="13" cy="10" r="1.5" />
            <circle cx="7" cy="16" r="1.5" />
            <circle cx="13" cy="16" r="1.5" />
          </svg>
        </button>
      )}

      {/* Index or Play button */}
      <div className="w-7 sm:w-8 shrink-0 flex items-center justify-center">
        {isDJ ? (
          <button
            type="button"
            onClick={() => onPlay(item)}
            className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full transition-all ${
              isPlaying
                ? 'bg-accent text-accent-foreground'
                : 'text-text-3 hover:bg-accent/10 hover:text-accent'
            }`}
            title={isPlaying ? 'Now playing' : 'Play track'}
          >
            {isPlaying ? (
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
        ) : (
          <span className="font-mono text-[10px] text-text-3">
            {index + 1}
          </span>
        )}
      </div>

      {/* Thumbnail */}
      <div className="relative aspect-video w-20 sm:w-24 bg-bg-3 shrink-0 overflow-hidden border border-rule/20">
        <img
          src={item.thumbnail}
          alt=""
          className={`h-full w-full object-cover transition-all duration-500 group-hover:opacity-100 group-hover:scale-105 ${
            isPlaying ? 'opacity-100' : 'opacity-80'
          }`}
        />
        {isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg/40 backdrop-blur-[2px]">
            <WaveformBars isPlaying={playbackPlaying} />
          </div>
        )}
      </div>

      {/* Title & Metadata */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <p
          className={`truncate font-serif text-sm sm:text-base transition-colors group-hover:text-text ${
            isPlaying ? 'text-accent font-bold' : 'text-text-2'
          }`}
          title={item.title}
        >
          {item.title}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded-sm border border-rule/50 bg-bg-3 text-text-3">
            {item.source}
          </span>
          {durationStr && (
            <span className="font-mono text-[9px] text-text-3">
              {durationStr}
            </span>
          )}
          {isPlaying && (
            <span className="font-mono text-[9px] uppercase text-accent tracking-widest font-semibold flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              Playing
            </span>
          )}

          {/* Mobile inline addedBy badge */}
          <div
            className="md:hidden flex items-center gap-1.5 font-mono text-[9px] text-text-3"
            title={timeTooltip}
          >
            <span>•</span>
            {avatar ? (
              <img
                src={avatar}
                alt=""
                className="w-3.5 h-3.5 rounded-full object-cover shrink-0"
              />
            ) : (
              <span className="w-3.5 h-3.5 rounded-full bg-accent/20 text-accent text-[8px] font-bold flex items-center justify-center shrink-0">
                {displayName.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="truncate max-w-[80px]">{displayName}</span>
          </div>
        </div>
      </div>

      {/* Added By Badge (Desktop/Tablet) */}
      <div
        className="hidden md:flex items-center gap-2 shrink-0 px-2.5 py-1 bg-bg-3/70 border border-rule/50 rounded-full text-text-3 group-hover:border-rule transition-colors"
        title={timeTooltip}
      >
        <div className="relative h-5 w-5 shrink-0 overflow-hidden rounded-full border border-rule/50 bg-bg-2">
          {avatar ? (
            <img
              src={avatar}
              alt={displayName}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-mono text-[9px] font-bold text-accent uppercase">
              {displayName.charAt(0)}
            </div>
          )}
        </div>
        <div className="flex flex-col text-left">
          <span className="font-mono text-[10px] text-text-2 max-w-[85px] lg:max-w-[120px] truncate leading-tight">
            {displayName}
          </span>
          {relativeTime && (
            <span className="font-mono text-[8px] text-text-3 leading-tight">
              {relativeTime}
            </span>
          )}
        </div>
      </div>

      {/* Action Buttons: Move Up, Move Down, Delete (DJ only) */}
      {canEdit && (
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          <button
            type="button"
            disabled={index === 0}
            onClick={(e) => {
              e.stopPropagation();
              onMoveUp(index);
            }}
            className="h-7 w-7 flex items-center justify-center text-text-3 hover:text-accent hover:bg-bg-3 rounded disabled:opacity-20 disabled:hover:text-text-3 disabled:hover:bg-transparent transition-colors"
            title="Move up"
            aria-label="Move up"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>

          <button
            type="button"
            disabled={index === totalTracks - 1}
            onClick={(e) => {
              e.stopPropagation();
              onMoveDown(index);
            }}
            className="h-7 w-7 flex items-center justify-center text-text-3 hover:text-accent hover:bg-bg-3 rounded disabled:opacity-20 disabled:hover:text-text-3 disabled:hover:bg-transparent transition-colors"
            title="Move down"
            aria-label="Move down"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(item);
            }}
            className="h-7 w-7 flex items-center justify-center text-text-3 hover:text-accent hover:bg-bg-3 rounded transition-colors ml-1"
            title="Remove track"
            aria-label="Remove track"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

export default function TrackListPanel({
  serverId,
  playlist,
  activePlaylistId,
  isDJ,
}: {
  serverId: string;
  playlist: Playlist;
  activePlaylistId: string | null;
  isDJ: boolean;
}) {
  const { user } = useAuth();
  const { tracks, loading } = useTracks(serverId, playlist.id);
  const { playbackState } = usePlaybackSync(serverId, isDJ, null, true);

  const [optimisticTracks, setOptimisticTracks] = useState<Track[] | null>(null);
  const [activeDragTrack, setActiveDragTrack] = useState<Track | null>(null);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [trackToRemove, setTrackToRemove] = useState<Track | null>(null);
  const [showDeletePlaylistConfirm, setShowDeletePlaylistConfirm] = useState(false);

  const trackRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const containerRef = useRef<HTMLDivElement>(null);

  const isPlayingFromHere = activePlaylistId === playlist.id;
  const canEdit = isDJ && playlist.source !== 'shared';
  const displayTracks = optimisticTracks ?? tracks;

  // Extract UIDs for resolving missing profiles (e.g. legacy tracks)
  const legacyUids = displayTracks
    .map((t) => (typeof t.addedBy === 'string' ? t.addedBy : t.addedBy?.uid || ''))
    .filter(Boolean);
  const userProfiles = useUserProfiles(legacyUids);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Auto-scroll logic to currently playing track
  useEffect(() => {
    if (isPlayingFromHere && playbackState?.trackId) {
      const el = trackRefs.current[playbackState.trackId];
      if (el) {
        const timer = setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [playbackState?.trackId, isPlayingFromHere, displayTracks.length]);

  const playTrack = async (item: Track) => {
    if (!isDJ || !user) return;

    if (!isPlayingFromHere) {
      await setActivePlaylist(serverId, playlist.id);
    }

    update(ref(rtdb, `playback/${serverId}`), {
      playlistId: playlist.id,
      trackId: item.id,
      source: item.source,
      sourceId: item.sourceId,
      title: item.title,
      thumbnail: item.thumbnail,
      position: 0,
      playing: true,
      updatedAt: Date.now(),
      djId: user.uid,
    });
  };

  const handleSwitchToPlaylist = async () => {
    if (!isDJ || !displayTracks.length) return;
    playTrack(displayTracks[0]);
  };

  // Drag & drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    const found = displayTracks.find((t) => t.id === event.active.id);
    if (found) setActiveDragTrack(found);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragTrack(null);

    if (over && active.id !== over.id) {
      const oldIndex = displayTracks.findIndex((t) => t.id === active.id);
      const newIndex = displayTracks.findIndex((t) => t.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(displayTracks, oldIndex, newIndex);
        setOptimisticTracks(reordered);
        try {
          await reorderTracksInPlaylist(serverId, playlist.id, reordered);
        } catch (err) {
          console.error('Failed to sync reordered tracks to database:', err);
        } finally {
          setOptimisticTracks(null);
        }
      }
    }
  };

  const handleDragCancel = () => {
    setActiveDragTrack(null);
  };

  // Manual move handlers (up / down buttons)
  const handleMoveUp = async (index: number) => {
    if (index <= 0 || !canEdit) return;
    const reordered = arrayMove(displayTracks, index, index - 1);
    setOptimisticTracks(reordered);
    try {
      await reorderTracksInPlaylist(serverId, playlist.id, reordered);
    } catch (err) {
      console.error('Failed to move track up:', err);
    } finally {
      setOptimisticTracks(null);
    }
  };

  const handleMoveDown = async (index: number) => {
    if (index >= displayTracks.length - 1 || !canEdit) return;
    const reordered = arrayMove(displayTracks, index, index + 1);
    setOptimisticTracks(reordered);
    try {
      await reorderTracksInPlaylist(serverId, playlist.id, reordered);
    } catch (err) {
      console.error('Failed to move track down:', err);
    } finally {
      setOptimisticTracks(null);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-8 animate-pulse space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 w-full bg-bg-3 opacity-50" />
        ))}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 flex flex-col overflow-hidden relative">
      {!isPlayingFromHere && (
        <div className="shrink-0 bg-bg-3 border-b border-rule px-4 py-2 flex items-center justify-between shadow-md z-10">
          <span className="font-mono text-[11px] text-text-3">
            Not playing from this playlist
          </span>
          {isDJ && (
            <button
              onClick={handleSwitchToPlaylist}
              className="font-mono text-[11px] text-accent hover:text-text transition-colors uppercase tracking-widest"
            >
              Switch to this playlist
            </button>
          )}
        </div>
      )}

      {/* Now Playing Billboard */}
      {playbackState?.trackId && (
        <div className="shrink-0 relative z-20 mx-4 mt-4 md:mx-8 md:mt-6">
          <div className="relative bg-bg/40 backdrop-blur-3xl rounded-none border border-rule/10 shadow-2xl overflow-hidden group animate-in fade-in slide-in-from-top-4 duration-1000 ease-out animate-glow hover:bg-bg/50 transition-colors">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-accent/5 opacity-50 animate-slow-pan" />

            <div
              className="absolute inset-0 rounded-none pointer-events-none"
              style={{
                mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                maskComposite: 'exclude',
                padding: '1px',
              }}
            >
              <div
                className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent_0%,var(--accent)_10%,transparent_20%)] animate-[spin_8s_linear_infinite]"
                style={{
                  width: '200%',
                  height: '200%',
                  top: '-50%',
                  left: '-50%',
                }}
              />
            </div>

            <div className="relative p-5 md:px-10 md:py-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-accent animate-pulse shadow-[0_0_10px_rgba(var(--accent-rgb),0.8)]" />
                  <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.5em] text-accent/80">
                    Now Broadcasting
                  </h3>
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-px w-32 bg-gradient-to-r from-accent/30 to-transparent" />
                  {isPlayingFromHere && (
                    <span className="font-mono text-[9px] uppercase text-accent tracking-[0.3em] flex items-center gap-2 opacity-60">
                      <span className="h-[2px] w-4 bg-accent/40" />
                      Active
                    </span>
                  )}
                </div>
              </div>

              <div
                className={`relative flex items-center gap-6 md:gap-12 ${
                  isDJ ? 'cursor-pointer' : ''
                }`}
                onClick={() => {
                  if (isDJ && playbackState) {
                    update(ref(rtdb, `playback/${serverId}`), {
                      position: 0,
                      playing: true,
                      updatedAt: Date.now(),
                    });
                  }
                }}
              >
                <div className="relative h-24 w-24 md:h-40 md:w-40 shrink-0 group/thumb">
                  <div className="absolute -inset-4 bg-accent/10 blur-3xl opacity-0 group-hover/thumb:opacity-100 transition-opacity duration-1000" />

                  <div className="relative h-full w-full bg-bg-3 overflow-hidden rounded-none border border-rule/20 shadow-2xl transition-all duration-700 group-hover/thumb:scale-[1.05] group-hover/thumb:rotate-1 animate-float">
                    <img
                      src={playbackState.thumbnail}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-1000 group-hover/thumb:scale-110"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-bg/30 backdrop-blur-[1px]">
                      <WaveformBars isPlaying={playbackState.playing || false} />
                    </div>
                  </div>

                  {isDJ && (
                    <div className="absolute -bottom-3 -right-3 h-10 w-10 bg-accent text-accent-foreground rounded-none flex items-center justify-center shadow-2xl opacity-0 group-hover/thumb:opacity-100 transition-all scale-75 group-hover/thumb:scale-100">
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
                      </svg>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-4">
                  <div className="space-y-1">
                    <h4 className="font-serif text-2xl md:text-4xl font-bold tracking-tight text-text leading-none animate-in fade-in slide-in-from-bottom-2 duration-1000">
                      {playbackState.title}
                    </h4>
                  </div>

                  <AudioVisualizer isPlaying={playbackState.playing || false} />

                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[9px] uppercase px-3 py-1 rounded-none border border-accent/20 text-accent tracking-[0.2em] bg-accent/5 backdrop-blur-md">
                        {playbackState.source}
                      </span>
                    </div>
                    {playbackState.playing && (
                      <div className="flex items-center gap-3 font-mono text-[9px] uppercase text-text-3 tracking-[0.3em]">
                        <div className="flex gap-[2px]">
                          <div className="w-0.5 h-2 bg-accent/60 animate-waveform" />
                          <div className="w-0.5 h-3 bg-accent/80 animate-[waveform_1s_infinite_0.2s]" />
                          <div className="w-0.5 h-2.5 bg-accent animate-[waveform_0.8s_infinite_0.4s]" />
                        </div>
                        Broadcast Live
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute bottom-0 left-0 w-full h-1 bg-white/5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-transparent via-accent to-transparent opacity-40 animate-shimmer"
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Track List Section */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 pt-6">
        {displayTracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-12">
            <p className="font-serif text-2xl text-text-3 mb-4 max-w-sm leading-relaxed">
              This playlist is empty.
            </p>
            <div className="w-12 h-px bg-rule" />
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext
              items={displayTracks.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {displayTracks.map((item, index) => {
                  const isPlaying =
                    isPlayingFromHere && item.id === playbackState?.trackId;

                  return (
                    <SortableTrackItem
                      key={item.id}
                      item={item}
                      index={index}
                      totalTracks={displayTracks.length}
                      isPlaying={isPlaying}
                      isDJ={isDJ}
                      canEdit={canEdit}
                      playbackPlaying={playbackState?.playing || false}
                      userProfiles={userProfiles}
                      onPlay={playTrack}
                      onMoveUp={handleMoveUp}
                      onMoveDown={handleMoveDown}
                      onRemove={(track) => setTrackToRemove(track)}
                      trackRef={(el) => {
                        trackRefs.current[item.id] = el;
                      }}
                    />
                  );
                })}
              </div>
            </SortableContext>

            {/* Drag Overlay for smooth visual feedback */}
            <DragOverlay>
              {activeDragTrack ? (
                <div className="flex items-center gap-4 border border-accent bg-bg-2 p-3 shadow-2xl opacity-95 cursor-grabbing pointer-events-none rounded-none">
                  <div className="w-4 h-4 text-accent shrink-0">
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <circle cx="7" cy="4" r="1.5" />
                      <circle cx="13" cy="4" r="1.5" />
                      <circle cx="7" cy="10" r="1.5" />
                      <circle cx="13" cy="10" r="1.5" />
                      <circle cx="7" cy="16" r="1.5" />
                      <circle cx="13" cy="16" r="1.5" />
                    </svg>
                  </div>
                  <div className="aspect-video w-20 bg-bg-3 shrink-0 overflow-hidden border border-rule/30">
                    <img
                      src={activeDragTrack.thumbnail}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-serif text-sm font-semibold truncate text-text">
                      {activeDragTrack.title}
                    </p>
                    <p className="font-mono text-[9px] uppercase text-text-3 mt-0.5">
                      {activeDragTrack.source}
                    </p>
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {isDJ && playlist.source !== 'shared' && (
        <RecommendationsPanel serverId={serverId} playlistId={playlist.id} />
      )}

      {isSettingsOpen && (
        <PlaylistSettingsModal
          serverId={serverId}
          playlist={playlist}
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      {trackToRemove && (
        <ConfirmModal
          title="Remove Track"
          message={`Remove "${trackToRemove.title}" from this playlist?`}
          onConfirm={() => {
            removeTrackFromPlaylist(
              serverId,
              playlist.id,
              trackToRemove.id,
              trackToRemove.duration
            );
            setTrackToRemove(null);
          }}
          onCancel={() => setTrackToRemove(null)}
          confirmText="Remove"
          variant="danger"
        />
      )}

      {showDeletePlaylistConfirm && (
        <ConfirmModal
          title="Delete Playlist"
          message={`Are you sure you want to delete "${playlist.name}"? This removes all ${playlist.trackCount} tracks.`}
          onConfirm={() => {
            deletePlaylist(serverId, playlist.id);
            setShowDeletePlaylistConfirm(false);
          }}
          onCancel={() => setShowDeletePlaylistConfirm(false)}
          confirmText="Delete"
          variant="danger"
        />
      )}
    </div>
  );
}
