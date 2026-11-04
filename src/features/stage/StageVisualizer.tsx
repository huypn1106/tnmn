import { useEffect, useMemo, useRef, useState } from 'react';
import { addDoc, collection, limit, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { db } from '../../app/firebase';
import {
  AUTO_SET,
  DEFAULT_SKIN,
  DROP_SET,
  EMOS,
  MOVE_NAMES,
  PANTS,
  SHIRTS,
  SKINS,
  STAGE_PRESETS,
} from './types';
import type {
  DanceMove,
  SkinConfig,
  StageMember,
} from './types';
import {
  PI,
  TAU,
  clamp,
  drawDancer,
  ease,
  easeOutBack,
  getPose,
  idlePose,
  lerpPose,
  pick,
  roundRect,
} from './danceMath';
import SkinEditorModal from './SkinEditorModal';
import StageBackgroundModal from './StageBackgroundModal';
import StageLedModal from './StageLedModal';

interface StageVisualizerProps {
  serverId?: string;
  serverName?: string;
  trackTitle?: string;
  isPlaying?: boolean;
  playbackPosition?: number;
  updatedAt?: number;
  roomMembers?: Array<{ uid: string; displayName?: string; username?: string; photoURL?: string }>;
  currentUserName?: string;
  currentUserId?: string;
  isOwner?: boolean;
  stageBackground?: string;
  onUpdateBackground?: (bg: string) => void | Promise<void>;
  ledText?: string;
  ledMode?: 'marquee' | 'static' | 'track';
  ledSpeed?: number;
  onUpdateLedConfig?: (config: { text: string; mode: 'marquee' | 'static' | 'track'; speed: number }) => void | Promise<void>;
  onSwitchToClassic?: () => void;
}

const STORAGE_SKIN_KEY = 'tnmn_stage_avatar_v1';
const FONT = '"DM Sans", system-ui, -apple-system, sans-serif';

export default function StageVisualizer({
  serverId,
  serverName = 'Sân khấu TNMN',
  trackTitle,
  isPlaying = false,
  playbackPosition = 0,
  updatedAt = Date.now(),
  roomMembers = [],
  currentUserName = 'Bạn',
  currentUserId = 'me',
  isOwner = false,
  stageBackground = 'default',
  onUpdateBackground,
  ledText = '',
  ledMode = 'marquee',
  ledSpeed = 70,
  onUpdateLedConfig,
  onSwitchToClassic,
}: StageVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const STAGE_BPM = 132;

  // User Skin & Customization
  const [skin, setSkin] = useState<SkinConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SKIN_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn(e);
    }
    return DEFAULT_SKIN;
  });
  const [isSkinModalOpen, setIsSkinModalOpen] = useState(false);
  const [isBgModalOpen, setIsBgModalOpen] = useState(false);
  const [isLedModalOpen, setIsLedModalOpen] = useState(false);

  // Background Image Cache for custom image URLs
  const bgImageRef = useRef<{ url: string; img: HTMLImageElement; loaded: boolean }>({
    url: '',
    img: new Image(),
    loaded: false,
  });
  const [, setBgLoadedTick] = useState<number>(0);

  useEffect(() => {
    if (!stageBackground || !stageBackground.match(/^(https?:\/\/|data:image)/i)) {
      bgImageRef.current = { url: '', img: new Image(), loaded: false };
      return;
    }

    if (bgImageRef.current.url === stageBackground && bgImageRef.current.loaded) {
      return;
    }

    const img = new Image();
    img.onload = () => {
      bgImageRef.current = { url: stageBackground, img, loaded: true };
      setBgLoadedTick((t) => t + 1);
    };
    img.onerror = (err) => {
      console.warn('Failed to load stage background image:', stageBackground, err);
      bgImageRef.current = { url: '', img: new Image(), loaded: false };
    };
    img.src = stageBackground;
    if (img.complete && img.naturalWidth > 0) {
      bgImageRef.current = { url: stageBackground, img, loaded: true };
      setBgLoadedTick((t) => t + 1);
    }
  }, [stageBackground]);

  // Twinkling stars for galaxy background
  const galaxyStars = useMemo(() => {
    return [...Array(65)].map(() => ({
      x: Math.random(),
      y: Math.random() * 0.46,
      r: 0.6 + Math.random() * 1.5,
      speed: 1.5 + Math.random() * 3.5,
      phase: Math.random() * PI * 2,
    }));
  }, []);

  // Toggle Controls (Show/Hide panel for dance moves, emotes, beat)
  const [showControls, setShowControls] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('tnmn_stage_show_controls');
      if (saved !== null) return saved === 'true';
    } catch (e) {
      console.warn(e);
    }
    return true;
  });

  const toggleControls = () => {
    setShowControls((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('tnmn_stage_show_controls', String(next));
      } catch (e) {
        console.warn(e);
      }
      return next;
    });
  };

  // Chat bubbles above dancers' heads (30s duration)
  const chatBubblesRef = useRef<Map<string, { text: string; receivedAt: number }>>(new Map());
  const [chatInput, setChatInput] = useState<string>('');
  const [isSendingChat, setIsSendingChat] = useState<boolean>(false);

  // Listen to live chat messages for this room
  useEffect(() => {
    if (!serverId) return;

    const q = query(
      collection(db, 'servers', serverId, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const now = performance.now();
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          const senderId = data.userId;
          const text = data.text;
          if (!text || !senderId) return;

          // Check timestamp: accept recent messages within the last 30 seconds
          let isRecent = false;
          if (data.createdAt?.toMillis) {
            const ageMs = Date.now() - data.createdAt.toMillis();
            if (ageMs < 30000 && ageMs >= -2000) {
              isRecent = true;
            }
          } else {
            // Local optimistic write
            isRecent = true;
          }

          if (isRecent) {
            const entry = { text: String(text).trim(), receivedAt: now };
            chatBubblesRef.current.set(senderId, entry);
            if (senderId === currentUserId) {
              chatBubblesRef.current.set('me', entry);
            }
          }
        }
      });
    });

    return () => unsubscribe();
  }, [serverId, currentUserId]);

  const handleSendStageChat = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed || !serverId || isSendingChat) return;

    setIsSendingChat(true);
    try {
      const myId = currentUserId || 'me';
      const now = performance.now();
      const entry = { text: trimmed, receivedAt: now };
      chatBubblesRef.current.set(myId, entry);
      chatBubblesRef.current.set('me', entry);

      await addDoc(collection(db, 'servers', serverId, 'messages'), {
        text: trimmed,
        userId: myId,
        username: currentUserName || 'Bạn',
        createdAt: serverTimestamp(),
      });
      setChatInput('');
    } catch (err) {
      console.error('Failed to send stage chat:', err);
    } finally {
      setIsSendingChat(false);
    }
  };

  // Dance Move states
  const [youMove, setYouMove] = useState<DanceMove>('auto');
  const [group, setGroup] = useState<{ move: DanceMove; start: number; end: number } | null>(null);
  const groupRef = useRef<{ move: DanceMove; start: number; end: number } | null>(null);
  groupRef.current = group;

  // Local toasts
  const [toasts, setToasts] = useState<Array<{ id: number; text: string }>>([]);
  const addToast = (text: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-3), { id, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2800);
  };

  // Particles
  const particlesRef = useRef<
    Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      c: string;
      r: number;
      rot: number;
      vr: number;
      life: number;
    }>
  >([]);

  const burst = (x: number, y: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const s = 150 + Math.random() * 350;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 250,
        c: `hsl(${Math.floor(Math.random() * 360)}, 95%, 62%)`,
        r: 2 + Math.random() * 3,
        rot: Math.random() * TAU,
        vr: (Math.random() - 0.5) * 10,
        life: 1.4 + Math.random(),
      });
    }
  };

  // Members on stage
  const membersRef = useRef<StageMember[]>([]);
  const [, setRosterCount] = useState<number>(0);

  // Position swapping refs & helpers
  const slotOrderRef = useRef<string[]>([]);
  const nextSwapBeatRef = useRef<number>(24);
  const currentBeatRef = useRef<number>(0);

  const swapTwoPositions = () => {
    const visible = membersRef.current.filter((m) => !m.leaving && !m.hidden);
    if (visible.length < 2) return null;

    const n = visible.length;
    const iA = Math.floor(Math.random() * n);
    let iB = Math.floor(Math.random() * (n - 1));
    if (iB >= iA) iB++;

    const da = visible[iA];
    const db = visible[iB];
    const idA = String(da.id);
    const idB = String(db.id);

    const list = slotOrderRef.current;
    const posA = list.indexOf(idA);
    const posB = list.indexOf(idB);
    if (posA !== -1 && posB !== -1) {
      list[posA] = idB;
      list[posB] = idA;
    }

    if (da.x !== null) burst(da.x, da.y - da.s * 0.7, 14);
    if (db.x !== null) burst(db.x, db.y - db.s * 0.7, 14);

    return {
      a: da.name || (da.isYou ? 'Bạn' : 'user'),
      b: db.name || (db.isYou ? 'Bạn' : 'user'),
    };
  };

  const swapTwoPositionsRef = useRef(swapTwoPositions);
  swapTwoPositionsRef.current = swapTwoPositions;

  const handleManualSwap = () => {
    const res = swapTwoPositions();
    if (res) {
      nextSwapBeatRef.current = currentBeatRef.current + 24 + Math.random() * 8;
      addToast(`${res.a} & ${res.b} vừa đổi vị trí! 🔀`);
    }
  };

  // Initialize members from roomMembers or fallback mock dancers
  useEffect(() => {
    const existing = membersRef.current;
    const existingMap = new Map<string | number, StageMember>();
    existing.forEach((m) => existingMap.set(m.id, m));

    const updated: StageMember[] = [];

    // Current user ("Bạn")
    const myId = currentUserId || 'me';
    const myExisting = existingMap.get(myId);
    const me: StageMember = {
      ...skin,
      id: myId,
      name: currentUserName || 'Bạn',
      isYou: true,
      seed: 0,
      off: 0,
      x: myExisting?.x ?? null,
      y: myExisting?.y ?? 0,
      s: myExisting?.s ?? 0,
      tx: 0,
      ty: 0,
      ts: 0,
      enter: myExisting ? myExisting.enter : 1,
      leaving: false,
      leave: 0,
      hidden: false,
      mv: myExisting?.mv ?? null,
      prev: myExisting?.prev ?? null,
      blend: myExisting?.blend ?? 0,
      emotes: myExisting?.emotes ?? [],
    };
    updated.push(me);

    // Other real members currently listening in the room
    const currentMemberUids = new Set(roomMembers.map((u) => u.uid));
    const otherUsers = roomMembers.filter((u) => u.uid !== myId);

    otherUsers.forEach((u, i) => {
      const prevM = existingMap.get(u.uid);
      const uname = u.username || u.displayName || `user_${i + 1}`;
      if (prevM) {
        updated.push({
          ...prevM,
          name: uname,
          leaving: false,
        });
      } else {
        updated.push({
          id: u.uid,
          name: uname,
          isYou: false,
          shirt: pick([...SHIRTS, 'bayern', 'mu', 'mc', 'zalo_ts']),
          pants: pick(PANTS),
          skin: pick(SKINS),
          hairC: pick(SKINS),
          hair: Math.floor(Math.random() * 5),
          glasses: Math.random() < 0.4 ? 1 : 0,
          acc: Math.random() < 0.3 ? 1 : 0,
          seed: (i + 1) % 7,
          off: (Math.random() - 0.5) * 0.05,
          x: null,
          y: 0,
          s: 0,
          tx: 0,
          ty: 0,
          ts: 0,
          enter: 0.1,
          leaving: false,
          leave: 0,
          hidden: false,
          mv: null,
          prev: null,
          blend: 0,
          emotes: [],
        });
      }
    });

    // Handle members who left the room: set leaving = true so they smoothly fade out
    existing.forEach((m) => {
      if (!m.isYou && !currentMemberUids.has(String(m.id)) && !m.leaving) {
        updated.push({
          ...m,
          leaving: true,
        });
      }
    });

    membersRef.current = updated;
    setRosterCount(updated.length);
  }, [roomMembers, currentUserId, currentUserName, skin]);

  // Send an emote
  const handleSendEmote = (e: string) => {
    const me = membersRef.current.find((m) => m.isYou);
    if (me) {
      me.emotes.push({ e, t: 0, dx: (Math.random() - 0.5) * 0.6 });
      if (e === '🥳' && me.x !== null) {
        burst(me.x, me.y - me.s, 40);
      }
    }
    // Random other dancer reacts back
    const others = membersRef.current.filter((m) => !m.isYou && !m.leaving && !m.hidden);
    if (others.length > 0) {
      const lucky = pick(others);
      setTimeout(() => {
        lucky.emotes.push({ e, t: 0, dx: (Math.random() - 0.5) * 0.6 });
      }, 300 + Math.random() * 400);
    }
  };

  // Trigger group unison dance
  const handleGroupDance = () => {
    const me = membersRef.current.find((m) => m.isYou);
    const selectedMove = youMove !== 'auto' ? youMove : me?.mv || 'chiTroi';
    const now = Date.now();
    const posSec = isPlaying ? playbackPosition + (now - updatedAt) / 1000 : playbackPosition;
    const currentBeat = (posSec * STAGE_BPM) / 60;
    const start = Math.ceil(currentBeat / 4) * 4 + (Math.ceil(currentBeat / 4) * 4 - currentBeat < 1 ? 4 : 0);
    const nextGroup = { move: selectedMove, start, end: start + 16 };
    setGroup(nextGroup);
    addToast(`Cả phòng sẽ cùng "${MOVE_NAMES[selectedMove]}" sau ít nhịp! 🕺`);
  };

  // Main Canvas Render Loop
  useEffect(() => {
    let animId: number;
    let lastTs = performance.now();
    let intensity = 0.22;
    let lastBar: number | null = null;
    let curTime = 0;

    const render = (ts: number) => {
      const dt = Math.min(0.05, (ts - lastTs) / 1000);
      lastTs = ts;
      curTime += dt;

      const cv = canvasRef.current;
      const wrap = containerRef.current;
      if (!cv || !wrap) {
        animId = requestAnimationFrame(render);
        return;
      }

      const ctx = cv.getContext('2d');
      if (!ctx) return;

      // Handle Responsive Resize with clean proportions
      const w = wrap.clientWidth;
      const isMobile = w < 540;

      // Target aspect ratio: ~0.48 on desktop, ~0.65 on mobile
      const targetAspect = isMobile ? 0.65 : 0.48;
      const h = Math.round(clamp(w * targetAspect, isMobile ? 260 : 340, isMobile ? 360 : 480));

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
        cv.width = Math.round(w * dpr);
        cv.height = Math.round(h * dpr);
        cv.style.height = `${h}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      // Compute Beat
      const activePlaying = isPlaying;
      let b = 0;
      if (isPlaying) {
        const now = Date.now();
        const curSec = playbackPosition + (now - updatedAt) / 1000;
        b = (curSec * STAGE_BPM) / 60;
      } else {
        b = (curTime * STAGE_BPM) / 60;
      }
      currentBeatRef.current = b;

      const bar = Math.floor(b / 4);
      const p = ((b % 1) + 1) % 1;
      const ph = ((bar % 16) + 16) % 16;
      const drop = activePlaying && ph >= 8;

      intensity += ((activePlaying ? 1 : 0.22) - intensity) * Math.min(1, dt * 2.5);
      const kick = activePlaying && !(ph === 7 && (b % 4) >= 3) ? Math.exp(-p * 7) : 0;

      if (activePlaying && lastBar !== null && bar !== lastBar && ph === 8) {
        burst(w / 2, h * 0.25, 70);
      }
      lastBar = bar;

      const currentGroup = groupRef.current;
      if (currentGroup && b >= currentGroup.end) {
        setGroup(null);
      }

      // Responsive Dancers Per Row
      const per = w < 400 ? 2 : w < 540 ? 3 : w < 840 ? 4 : w < 1140 ? 5 : 6;
      const act = membersRef.current.filter((m) => !m.leaving);

      // Reconcile slotOrderRef with currently active members
      const actIds = new Set(act.map((m) => String(m.id)));
      slotOrderRef.current = slotOrderRef.current.filter((id) => actIds.has(id));

      act.forEach((m) => {
        const idStr = String(m.id);
        if (!slotOrderRef.current.includes(idStr)) {
          if (m.isYou) {
            slotOrderRef.current.unshift(idStr);
          } else {
            slotOrderRef.current.push(idStr);
          }
        }
      });

      // Sort active members according to slotOrderRef
      const orderMap = new Map(slotOrderRef.current.map((id, idx) => [id, idx]));
      const actOrdered = [...act].sort(
        (a, c) => (orderMap.get(String(a.id)) ?? 999) - (orderMap.get(String(c.id)) ?? 999)
      );

      const shown = actOrdered.slice(0, per * 3);
      const overflow = actOrdered.length - shown.length;
      actOrdered.forEach((m, idx) => {
        m.hidden = idx >= per * 3;
      });

      // Periodic position swap between two visible dancers to keep stage lively
      if (shown.length >= 2 && b >= nextSwapBeatRef.current) {
        nextSwapBeatRef.current = b + 24 + Math.random() * 12;
        swapTwoPositionsRef.current();
      }

      // Floor Horizon line
      const fyFloor = isMobile ? h * 0.46 : h * 0.48;
      const floorH = h - fyFloor;

      // Feet Y positions: giving safe margin at bottom so feet are NEVER cut off
      // Front row feet are at 85% of h (leaves 15% floor under their feet)
      const ROWY = [0.85, 0.73, 0.61];
      const ROWS = isMobile ? [0.90, 0.76, 0.62] : [1.0, 0.82, 0.66];

      // Safe speaker margins
      const spw = Math.max(16, Math.min(Math.round(w * 0.075), 58));
      const sideMargin = (spw + (isMobile ? 12 : 22)) / w;
      const SPAN = [
        [sideMargin, 1 - sideMargin],
        [sideMargin + 0.05, 1 - (sideMargin + 0.05)],
        [sideMargin + 0.10, 1 - (sideMargin + 0.10)],
      ];

      for (let r = 0; r * per < shown.length; r++) {
        const row = shown.slice(r * per, r * per + per);
        const c = row.length;
        const [x0, x1] = SPAN[Math.min(r, SPAN.length - 1)];
        const totalSpan = (x1 - x0) * w;
        const spacing = Math.min(totalSpan / Math.max(1, c), totalSpan / 2.5);
        const slots = [...Array(c).keys()]
          .map((k) => w / 2 + (k - (c - 1) / 2) * spacing)
          .sort((a1, b1) => Math.abs(a1 - w / 2) - Math.abs(b1 - w / 2));

        // Scale dancer height proportionately to fit floor and spacing
        const maxHByFloor = floorH * 0.46 * ROWS[r];
        const dancerH = Math.min(maxHByFloor, spacing * 0.95);

        row.forEach((m, idx) => {
          m.tx = slots[idx];
          m.ty = h * ROWY[r];
          m.ts = dancerH;
          if (m.x === null || m.y === 0 || Math.abs(m.x - m.tx) > w * 0.9) {
            m.x = m.tx;
            m.y = m.ty;
            m.s = m.ts;
          }
        });
      }

      // --- DRAW STAGE ---
      const hue = ((bar * 47) % 360 + 360) % 360;
      const isCustomBgLoaded = bgImageRef.current.loaded;
      const preset = STAGE_PRESETS[stageBackground || 'default'] || STAGE_PRESETS.default;

      if (isCustomBgLoaded) {
        const img = bgImageRef.current.img;
        const imgRatio = img.naturalWidth / img.naturalHeight;
        const canvasRatio = w / h;
        let dw = w;
        let dh = h;
        let dx = 0;
        let dy = 0;
        if (canvasRatio > imgRatio) {
          dh = w / imgRatio;
          dy = (h - dh) / 2;
        } else {
          dw = h * imgRatio;
          dx = (w - dw) / 2;
        }
        ctx.drawImage(img, dx, dy, dw, dh);

        // Dark ambient overlay to keep dancers and visualizer sharp
        ctx.fillStyle = 'rgba(7, 3, 16, 0.62)';
        ctx.fillRect(0, 0, w, h);
      } else {
        const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
        bgGrad.addColorStop(0, preset.top);
        bgGrad.addColorStop(0.55, preset.mid);
        bgGrad.addColorStop(1, preset.bottom);
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);

        // Twinkling stars for galaxy preset
        if (stageBackground === 'galaxy') {
          for (const st of galaxyStars) {
            const alpha = 0.2 + 0.65 * Math.abs(Math.sin(curTime * st.speed + st.phase));
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(st.x * w, st.y * h, st.r, 0, TAU);
            ctx.fill();
          }
        }
      }

      // Top edge
      ctx.fillStyle = isCustomBgLoaded ? 'rgba(255,255,255,0.12)' : preset.mid;
      ctx.fillRect(0, h * 0.02, w, Math.max(3, h * 0.012));

      // LED Screen
      const sx = w * 0.16;
      const sy = h * 0.05;
      const sw2 = w * 0.68;
      const sh = h * (isMobile ? 0.32 : 0.28);
      roundRect(ctx, sx, sy, sw2, sh, 10);
      ctx.fillStyle = '#090514';
      ctx.fill();
      ctx.strokeStyle = '#33255a';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.save();
      roundRect(ctx, sx, sy, sw2, sh, 10);
      ctx.clip();

      const sg = ctx.createRadialGradient(w / 2, sy + sh * 0.6, 10, w / 2, sy + sh * 0.6, sw2 * 0.6);
      sg.addColorStop(0, `hsla(${hue}, 90%, 55%, ${0.18 + 0.25 * kick * intensity})`);
      sg.addColorStop(1, 'hsla(0,0%,0%,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(sx, sy, sw2, sh);

      // Visualizer Bars
      const nBars = isMobile ? 24 : 32;
      const bw = sw2 / nBars;
      for (let i = 0; i < nBars; i++) {
        const v = clamp(
          (0.18 +
            0.3 * (0.5 + 0.5 * Math.sin(b * PI * 0.5 + i * 0.55)) +
            0.5 * kick * (0.4 + 0.6 * Math.abs(Math.sin(i * 1.7)))) *
            (0.3 + 0.7 * intensity),
          0.04,
          1
        );
        const bh = v * sh * 0.56;
        ctx.fillStyle = `hsl(${(hue + i * 5) % 360}, 95%, ${55 + 15 * kick}%)`;
        roundRect(ctx, sx + i * bw + bw * 0.18, sy + sh - bh - 5, bw * 0.64, bh, Math.min(3, bw * 0.3));
        ctx.fill();
      }

      // Text display on LED (Custom Marquee / Custom Static / Default Song Title)
      const hasCustomText = Boolean(ledText && ledText.trim() && ledMode !== 'track');
      const activeLedMode = hasCustomText ? (ledMode || 'marquee') : 'track';

      if (activeLedMode === 'marquee') {
        const textToRun = ledText!.trim();
        const marqueeFs = clamp(sh * (isMobile ? 0.20 : 0.17), 13, 28);
        ctx.font = `800 ${marqueeFs}px ${FONT}`;

        const textW = ctx.measureText(textToRun).width;
        const gap = Math.max(sw2 * 0.35, 120);
        const cycle = textW + gap;
        const currentSpeed = ledSpeed || 70;
        const offset = (curTime * currentSpeed) % cycle;
        const yCenter = sy + sh * 0.27;

        ctx.save();
        ctx.shadowColor = `hsla(${hue}, 95%, 65%, 0.75)`;
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        // Draw primary instance
        const xPos1 = sx + sw2 - offset;
        ctx.fillText(textToRun, xPos1, yCenter);

        // Draw loop instance if needed
        if (xPos1 + textW < sx + sw2 + 10) {
          ctx.fillText(textToRun, xPos1 + cycle, yCenter);
        }
        ctx.restore();

        // Subtitle badge below ticker
        ctx.font = `600 ${clamp(sh * (isMobile ? 0.085 : 0.075), 9, 13)}px ${FONT}`;
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const subDisplay = activePlaying && trackTitle ? `♪ ${trackTitle}` : `✦ ${serverName} ✦`;
        const maxSubLen = isMobile ? 26 : 42;
        const truncatedSub = subDisplay.length > maxSubLen ? subDisplay.slice(0, maxSubLen - 2) + '…' : subDisplay;
        ctx.fillText(truncatedSub, w / 2, sy + sh * 0.47);

      } else if (activeLedMode === 'static') {
        const textToShow = ledText!.trim();
        const fs = clamp(sh * (isMobile ? 0.18 : 0.15), 13, 26);
        ctx.font = `800 ${fs}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.save();
        ctx.shadowColor = `hsla(${hue}, 95%, 65%, 0.75)`;
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#ffffff';
        const maxCustomLen = isMobile ? 24 : 38;
        const displayCustom = textToShow.length > maxCustomLen ? textToShow.slice(0, maxCustomLen - 2) + '…' : textToShow;
        ctx.fillText(displayCustom, w / 2, sy + sh * 0.27);
        ctx.restore();

        // Subtitle badge below custom text
        ctx.font = `600 ${clamp(sh * (isMobile ? 0.085 : 0.075), 9, 13)}px ${FONT}`;
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        const subDisplay = activePlaying && trackTitle ? `♪ ${trackTitle}` : `✦ ${serverName} ✦`;
        const maxSubLen = isMobile ? 26 : 42;
        const truncatedSub = subDisplay.length > maxSubLen ? subDisplay.slice(0, maxSubLen - 2) + '…' : subDisplay;
        ctx.fillText(truncatedSub, w / 2, sy + sh * 0.47);

      } else {
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `800 ${clamp(sh * (isMobile ? 0.17 : 0.14), 12, 28)}px ${FONT}`;
        const maxTitleLen = isMobile ? 22 : 36;
        const displayTitle = trackTitle
          ? trackTitle.length > maxTitleLen
            ? trackTitle.slice(0, maxTitleLen - 2) + '…'
            : trackTitle
          : serverName;
        ctx.fillText(displayTitle, w / 2, sy + sh * 0.25);

        ctx.font = `600 ${clamp(sh * (isMobile ? 0.09 : 0.08), 9, 14)}px ${FONT}`;
        ctx.fillStyle = 'rgba(255,255,255,0.72)';
        let statusText = 'Đang chờ nhạc…';
        if (activePlaying) {
          statusText = drop ? '🔥 DROP!' : '♪ Quẩy cùng phòng';
        }
        ctx.fillText(statusText, w / 2, sy + sh * 0.45);
      }
      ctx.restore();

      // Floor Horizon
      ctx.beginPath();
      ctx.moveTo(w * 0.05, fyFloor);
      ctx.lineTo(w * 0.95, fyFloor);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      const floorGrad = ctx.createLinearGradient(0, fyFloor, 0, h);
      floorGrad.addColorStop(0, isCustomBgLoaded ? 'rgba(25, 16, 51, 0.88)' : preset.floorTop);
      floorGrad.addColorStop(1, isCustomBgLoaded ? 'rgba(9, 5, 20, 0.96)' : preset.floorBottom);
      ctx.fillStyle = floorGrad;
      ctx.fill();

      ctx.save();
      ctx.clip();
      ctx.strokeStyle = isCustomBgLoaded ? 'rgba(150,110,255,0.22)' : preset.gridColor;
      ctx.lineWidth = 1;
      for (let k = -10; k <= 10; k++) {
        ctx.beginPath();
        ctx.moveTo(w / 2 + k * w * 0.044, fyFloor);
        ctx.lineTo(w / 2 + k * w * 0.11, h);
        ctx.stroke();
      }
      for (let j = 1; j < 9; j++) {
        const yLine = fyFloor + (h - fyFloor) * Math.pow(j / 9, 1.7);
        ctx.beginPath();
        ctx.moveTo(0, yLine);
        ctx.lineTo(w, yLine);
        ctx.stroke();
      }
      const floorKickG = ctx.createRadialGradient(w / 2, h * 0.82, 10, w / 2, h * 0.82, w * 0.5);
      floorKickG.addColorStop(0, `hsla(${hue}, 95%, 60%, ${0.32 * kick * intensity + 0.05})`);
      floorKickG.addColorStop(1, 'hsla(0,0%,0%,0)');
      ctx.fillStyle = floorKickG;
      ctx.fillRect(0, fyFloor, w, h - fyFloor);
      ctx.restore();

      ctx.fillStyle = `hsla(${hue}, 95%, 60%, ${0.45 + 0.5 * kick * intensity})`;
      ctx.fillRect(w * 0.05, fyFloor - 1.5, w * 0.90, 3);

      // Tower Speakers
      for (const side of [-1, 1]) {
        const sx0 = side < 0 ? Math.max(3, Math.round(w * 0.012)) : w - Math.max(3, Math.round(w * 0.012)) - spw;
        for (let k = 0; k < 2; k++) {
          const y0 = h * 0.18 + k * h * 0.18;
          const sh2 = h * 0.16;
          roundRect(ctx, sx0, y0, spw, sh2, Math.min(6, spw * 0.2));
          ctx.fillStyle = '#120d1f';
          ctx.fill();
          ctx.strokeStyle = '#2c2346';
          ctx.lineWidth = 1.2;
          ctx.stroke();

          const rSp = Math.min(spw, sh2) * 0.33 * (1 + 0.09 * kick);
          const cx = sx0 + spw / 2;
          ctx.beginPath();
          ctx.arc(cx, y0 + sh2 * 0.58, rSp, 0, TAU);
          ctx.fillStyle = '#05030a';
          ctx.fill();
          ctx.strokeStyle = '#3b2f5c';
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(cx, y0 + sh2 * 0.58, rSp * 0.35, 0, TAU);
          ctx.fillStyle = '#2b2140';
          ctx.fill();

          ctx.beginPath();
          ctx.arc(cx, y0 + sh2 * 0.18, rSp * 0.25, 0, TAU);
          ctx.fillStyle = '#05030a';
          ctx.fill();
        }
      }

      // Moving Head Spotlights
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) {
        const lx = w * (0.1 + i * 0.16);
        const ang = Math.sin((b * PI) / 8 + i * 1.3) * 0.45 * (0.4 + 0.6 * intensity);
        const len = h * 1.1;
        const wa = 0.085;
        const a = (0.14 + 0.18 * kick) * (0.3 + 0.7 * intensity);
        const col = (hue + i * 40) % 360;

        const beamG = ctx.createLinearGradient(lx, h * 0.03, lx + Math.sin(ang) * len, Math.cos(ang) * len);
        beamG.addColorStop(0, `hsla(${col}, 100%, 70%, ${a})`);
        beamG.addColorStop(1, 'hsla(0,0%,0%,0)');
        ctx.fillStyle = beamG;
        ctx.beginPath();
        ctx.moveTo(lx, h * 0.03);
        ctx.lineTo(lx + Math.sin(ang - wa) * len, Math.cos(ang - wa) * len);
        ctx.lineTo(lx + Math.sin(ang + wa) * len, Math.cos(ang + wa) * len);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.arc(lx, h * 0.035, 3.5, 0, TAU);
        ctx.fillStyle = `hsla(${col}, 100%, 80%, 0.9)`;
        ctx.fill();
      }

      // Lasers during Drop
      if (drop) {
        const p8 = ((b * 2) % 1 + 1) % 1;
        if (p8 < 0.55) {
          ctx.lineWidth = 1.2;
          for (const [ox, dir] of [
            [w * 0.2, 1],
            [w * 0.8, -1],
          ]) {
            for (let k = 0; k < 6; k++) {
              const a2 = dir * (0.6 + k * 0.22 + 0.25 * Math.sin((b * PI) / 2));
              ctx.strokeStyle = `hsla(${(140 + k * 14) % 360}, 100%, 60%, 0.5)`;
              ctx.beginPath();
              ctx.moveTo(ox, h * 0.38);
              ctx.lineTo(ox + Math.sin(a2) * w * 1.2, h * 0.38 + Math.cos(a2) * w * 1.2);
              ctx.stroke();
            }
          }
        }
      }
      ctx.restore();

      // Choreography decision
      const moveFor = (m: StageMember): DanceMove => {
        if (currentGroup && b >= currentGroup.start && b < currentGroup.end) {
          return currentGroup.move;
        }
        if (m.isYou && youMove !== 'auto') {
          return youMove;
        }
        if (activePlaying && ph >= 8) {
          return DROP_SET[(((Math.floor(bar / 2) % DROP_SET.length) + DROP_SET.length) % DROP_SET.length)];
        }
        return AUTO_SET[
          (((Math.floor(bar / 2) + m.seed) % AUTO_SET.length) + AUTO_SET.length) % AUTO_SET.length
        ];
      };

      // Draw Dancers (Sorted back to front, tie-broken by id to prevent z-fighting during swap)
      const vis = membersRef.current
        .filter((m) => !m.hidden && m.x !== null)
        .sort((a1, c1) => a1.y - c1.y || String(a1.id).localeCompare(String(c1.id)));

      const tags: Array<[StageMember, { hx: number; hy: number; u: number }, number]> = [];

      for (const m of vis) {
        const kLerp = Math.min(1, dt * 3.5);
        if (!m.leaving) {
          m.x! += (m.tx - m.x!) * kLerp;
          m.y += (m.ty - m.y) * kLerp;
          m.s += (m.ts - m.s) * kLerp;
        }
        m.enter = Math.min(1, m.enter + dt / 0.8);
        if (m.leaving) m.leave = Math.min(1, m.leave + dt / 0.6);
        const ein = clamp(m.enter, 0, 1);
        if (m.enter <= 0) continue;

        // Rhythmic hop while swapping spots across stage
        const distToTarget = Math.hypot(m.tx - (m.x ?? m.tx), m.ty - m.y);
        const swapFactor = clamp((distToTarget - 4) / 20, 0, 1);
        const swapHop = swapFactor > 0 ? -Math.abs(Math.sin(PI * b)) * 6.5 * swapFactor : 0;

        const alpha = clamp(ein * 3, 0, 1) * (1 - ease(m.leave));
        // Safe entry bounce: strictly bounded so character NEVER overshoots below floor
        const yOff = -(1 - easeOutBack(ein)) * h * 0.22 + ease(m.leave) * 8 + swapHop;

        // Compute Pose
        const mv = moveFor(m);
        if (mv !== m.mv) {
          if (m.mv) {
            m.prev = m.mv;
            m.blend = b;
          }
          m.mv = mv;
        }
        const bb = b + m.off;
        let ps = getPose(mv, bb);
        if (m.prev) {
          const t = ease((b - m.blend) / 0.6);
          if (t >= 1) m.prev = null;
          else ps = lerpPose(getPose(m.prev, bb), ps, t);
        }
        const finalPose = lerpPose(idlePose(bb), ps, intensity);
        if (m.isYou) m.lastPose = finalPose;

        const hp = drawDancer(ctx, m, finalPose, alpha, yOff, drop, intensity, curTime);
        tags.push([m, hp, alpha]);
      }

      // Draw Name Tags & Emotes (With strict boundary clamping)
      for (const [m, hp, alpha] of tags) {
        const fs = clamp(hp.u * 10, 8.5, 12);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = `600 ${fs}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const label = m.name || (m.isYou ? 'Bạn' : 'user');
        const tw = ctx.measureText(label).width + fs * 1.2;
        const th = fs * 1.6;

        // Clamp tag within canvas left & right edges [6, w - 6]
        const safeTagX = clamp(hp.hx, tw / 2 + 6, w - tw / 2 - 6);
        roundRect(ctx, safeTagX - tw / 2, hp.hy - th, tw, th, th / 2);
        ctx.fillStyle = m.isYou ? '#ff4fae' : 'rgba(8,4,18,0.72)';
        ctx.fill();
        ctx.fillStyle = m.isYou ? '#1a0612' : '#ffffff';
        ctx.fillText(label, safeTagX, hp.hy - th / 2 + 0.5);

        // Emotes
        const es = clamp(hp.u * 15, 13, 24);
        ctx.font = `${es}px system-ui, sans-serif`;
        for (let i = m.emotes.length - 1; i >= 0; i--) {
          const e = m.emotes[i];
          e.t += dt;
          if (e.t > 1.7) {
            m.emotes.splice(i, 1);
            continue;
          }
          ctx.globalAlpha = alpha * clamp(1.7 - e.t, 0, 1) * clamp(e.t * 6, 0, 1);
          const emoteX = clamp(safeTagX + Math.sin(e.t * 6) * 4 + e.dx * e.t * 30, es / 2 + 4, w - es / 2 - 4);
          ctx.fillText(
            e.e,
            emoteX,
            hp.hy - th - 6 - e.t * 45 * Math.max(0.6, hp.u)
          );
        }

        // Chat Bubble (Shown above head for 30s after user chats)
        const bubble = chatBubblesRef.current.get(String(m.id)) || (m.isYou ? chatBubblesRef.current.get('me') : undefined);
        if (bubble) {
          const nowMs = performance.now();
          const ageSec = (nowMs - bubble.receivedAt) / 1000;
          if (ageSec < 30.0) {
            const popScale = ageSec < 0.25 ? easeOutBack(ageSec / 0.25) : 1;
            const fadeAlpha = ageSec > 28.0 ? (30.0 - ageSec) / 2.0 : 1;
            const bubbleAlpha = clamp(fadeAlpha, 0, 1) * alpha;

            if (bubbleAlpha > 0.01) {
              ctx.save();
              ctx.globalAlpha = bubbleAlpha;

              const bubbleFontSize = clamp(hp.u * 8.5, 10, 13);
              ctx.font = `600 ${bubbleFontSize}px ${FONT}`;
              const maxBubbleW = clamp(w * 0.38, 130, 240);

              const words = bubble.text.split(/\s+/);
              const lines: string[] = [];
              let curLine = '';
              for (const word of words) {
                const test = curLine ? `${curLine} ${word}` : word;
                if (ctx.measureText(test).width > maxBubbleW - 20 && curLine) {
                  lines.push(curLine);
                  curLine = word;
                  if (lines.length >= 3) break;
                } else {
                  curLine = test;
                }
              }
              if (curLine && lines.length < 3) lines.push(curLine);
              if (lines.length === 3 && lines[2].length > 18) {
                lines[2] = lines[2].slice(0, 15) + '…';
              }
              const displayLines = lines.length ? lines : [bubble.text];

              const lineH = bubbleFontSize * 1.35;
              const textH = displayLines.length * lineH;
              let maxTextW = 0;
              for (const l of displayLines) {
                const lw = ctx.measureText(l).width;
                if (lw > maxTextW) maxTextW = lw;
              }

              const padX = 10;
              const padY = 6;
              const bw = maxTextW + padX * 2;
              const bh = textH + padY * 2;
              const tailH = 5;
              const tailW = 8;

              const bubbleAnchorX = safeTagX;
              const bubbleAnchorY = hp.hy - th - 5;
              const bubbleX = clamp(bubbleAnchorX, bw / 2 + 8, w - bw / 2 - 8);
              const bubbleY = bubbleAnchorY - bh - tailH;

              // Pop-in scale centered on anchor
              ctx.translate(bubbleAnchorX, bubbleAnchorY);
              ctx.scale(popScale, popScale);
              ctx.translate(-bubbleAnchorX, -bubbleAnchorY);

              // Bubble shadow
              ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
              ctx.shadowBlur = 10;
              ctx.shadowOffsetY = 3;

              // Bubble background
              roundRect(ctx, bubbleX - bw / 2, bubbleY, bw, bh, 8);
              ctx.fillStyle = m.isYou ? '#ffffff' : '#f8f6fc';
              ctx.fill();

              // Tail pointing down to head
              ctx.beginPath();
              const tailX = clamp(bubbleAnchorX, bubbleX - bw / 2 + 8, bubbleX + bw / 2 - 8);
              ctx.moveTo(tailX - tailW / 2, bubbleY + bh);
              ctx.lineTo(tailX, bubbleY + bh + tailH);
              ctx.lineTo(tailX + tailW / 2, bubbleY + bh);
              ctx.closePath();
              ctx.fillStyle = m.isYou ? '#ffffff' : '#f8f6fc';
              ctx.fill();

              // Reset shadow
              ctx.shadowColor = 'transparent';
              ctx.shadowBlur = 0;

              // Border outline
              roundRect(ctx, bubbleX - bw / 2, bubbleY, bw, bh, 8);
              ctx.strokeStyle = m.isYou ? 'rgba(255, 79, 174, 0.65)' : 'rgba(124, 92, 255, 0.45)';
              ctx.lineWidth = 1;
              ctx.stroke();

              // Text lines
              ctx.fillStyle = '#0f0a1d';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              displayLines.forEach((line, idx) => {
                const lineY = bubbleY + padY + (idx + 0.5) * lineH;
                ctx.fillText(line, bubbleX, lineY);
              });

              ctx.restore();
            }
          } else {
            chatBubblesRef.current.delete(String(m.id));
            if (m.isYou) chatBubblesRef.current.delete('me');
          }
        }
        ctx.restore();
      }

      // Cleanup departed members
      for (let i = membersRef.current.length - 1; i >= 0; i--) {
        if (membersRef.current[i].leaving && membersRef.current[i].leave >= 1) {
          membersRef.current.splice(i, 1);
        }
      }

      // Confetti Particles
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const q = particlesRef.current[i];
        q.vy += 520 * dt;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.vx *= 0.99;
        q.rot += q.vr * dt;
        q.life -= dt;
        if (q.life <= 0 || q.y > h + 20) {
          particlesRef.current.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = Math.min(1, q.life);
        ctx.translate(q.x, q.y);
        ctx.rotate(q.rot);
        ctx.fillStyle = q.c;
        ctx.fillRect(-q.r, -q.r * 0.5, q.r * 2, q.r);
        ctx.restore();
      }

      // Drop strobe flash
      if (drop) {
        ctx.fillStyle = `rgba(255,255,255,${0.05 * kick})`;
        ctx.fillRect(0, 0, w, h);
      }

      // Overflow indicator
      if (overflow > 0) {
        const fs = isMobile ? 10 : 12;
        ctx.font = `600 ${fs}px ${FONT}`;
        const txt = `+${overflow} người nghe`;
        const tw = ctx.measureText(txt).width + 16;
        roundRect(ctx, w - tw - 8, h - 28, tw, 20, 10);
        ctx.fillStyle = 'rgba(8,4,18,0.75)';
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(txt, w - 8 - tw / 2, h - 18);
      }

      // Group dance countdown banner
      if (currentGroup && b < currentGroup.start) {
        const fs = isMobile ? 13 : 15;
        ctx.font = `800 ${fs}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const left = Math.ceil(currentGroup.start - b);
        ctx.fillStyle = '#ff4fae';
        ctx.fillText(`Đồng diễn "${MOVE_NAMES[currentGroup.move]}" sau ${left} nhịp…`, w / 2, h * 0.47);
      }

      // Clean up departed members
      if (membersRef.current.some((m) => m.leaving && m.leave >= 1)) {
        membersRef.current = membersRef.current.filter((m) => !(m.leaving && m.leave >= 1));
        setRosterCount(membersRef.current.length);
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isPlaying, playbackPosition, updatedAt, youMove, stageBackground, galaxyStars, ledText, ledMode, ledSpeed]);

  const activeDancerCount = membersRef.current.filter((m) => !m.leaving).length;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto custom-scrollbar p-2 sm:p-4 md:p-6 bg-[#0a0712] text-[#f1ecff]">
      {/* Top Banner & Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 sm:mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-accent animate-pulse shrink-0" />
            <h1 className="font-serif text-base sm:text-xl md:text-2xl font-bold tracking-tight truncate">
              Sân khấu của phòng 🎧
            </h1>
          </div>
          <p className="hidden sm:block text-xs text-white/50 mt-0.5 truncate">
            Mỗi người trong phòng là một nhân vật trên sân khấu, tự nhảy khớp theo nhịp bài đang phát.
          </p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {onSwitchToClassic && (
            <button
              onClick={onSwitchToClassic}
              className="border border-white/20 bg-white/5 hover:bg-white/10 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg font-mono text-[10px] sm:text-xs uppercase tracking-wider text-white/80 transition-all flex items-center gap-1"
            >
              <span>☰</span> Classic
            </button>
          )}

          {isOwner && (
            <button
              onClick={() => setIsBgModalOpen(true)}
              className="bg-purple-600/20 border border-purple-500/40 hover:bg-purple-600/30 text-purple-300 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg font-mono text-[10px] sm:text-xs uppercase tracking-wider font-semibold transition-all flex items-center gap-1 shadow-sm"
              title="Đổi nền sân khấu (Dành cho chủ phòng)"
            >
              <span>🖼</span>
              <span className="hidden sm:inline">Đổi nền</span>
              <span className="sm:hidden">Nền</span>
            </button>
          )}

          {isOwner && (
            <button
              onClick={() => setIsLedModalOpen(true)}
              className="bg-pink-600/20 border border-pink-500/40 hover:bg-pink-600/30 text-pink-300 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg font-mono text-[10px] sm:text-xs uppercase tracking-wider font-semibold transition-all flex items-center gap-1 shadow-sm"
              title="Chỉnh chữ chạy màn hình LED (Dành cho chủ phòng)"
            >
              <span>📺</span>
              <span className="hidden sm:inline">Chữ LED</span>
              <span className="sm:hidden">LED</span>
            </button>
          )}

          <button
            onClick={() => setIsSkinModalOpen(true)}
            className="bg-accent/20 border border-accent/40 hover:bg-accent/30 text-accent px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg font-mono text-[10px] sm:text-xs uppercase tracking-wider font-semibold transition-all flex items-center gap-1 shadow-sm"
          >
            <span>👗</span> Tạo hình
          </button>

          <button
            onClick={toggleControls}
            className={`border px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg font-mono text-[10px] sm:text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm ${
              showControls
                ? 'border-white/20 bg-white/10 text-white hover:bg-white/15'
                : 'border-accent/40 bg-accent/15 text-accent hover:bg-accent/25'
            }`}
            title={showControls ? 'Ẩn bảng điều khiển' : 'Hiện bảng điều khiển'}
          >
            <span>🎛</span>
            <span className="hidden sm:inline">{showControls ? 'Ẩn điều khiển' : 'Hiện điều khiển'}</span>
            <span className="sm:hidden">{showControls ? 'Ẩn' : 'Hiện'}</span>
          </button>

          <div className="bg-white/10 border border-white/10 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full font-mono text-[10px] sm:text-xs text-white/80 whitespace-nowrap">
            👥 {activeDancerCount}
          </div>
        </div>
      </div>

      {/* Stage Canvas Container */}
      <div
        ref={containerRef}
        className="relative w-full rounded-2xl overflow-hidden bg-[#07030f] border border-white/10 shadow-2xl"
      >
        <canvas ref={canvasRef} className="block w-full" />

        {/* Toasts overlay */}
        <div className="absolute left-2.5 top-2.5 flex flex-col gap-1.5 pointer-events-none max-w-xs z-20">
          {toasts.map((t) => (
            <div
              key={t.id}
              className="bg-black/80 backdrop-blur-md text-white text-[11px] sm:text-xs px-2.5 py-1 rounded-lg border border-white/10 shadow-lg animate-in fade-in slide-in-from-top-1"
            >
              {t.text}
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Controls Grid (Collapsible) */}
      {showControls ? (
        <div className="mt-3 sm:mt-4 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-mono text-white/50 uppercase tracking-wider flex items-center gap-1.5">
              <span>🎛</span> Bảng điều khiển sân khấu
            </span>
            <button
              onClick={toggleControls}
              className="text-[10px] sm:text-[11px] font-mono text-white/50 hover:text-white transition-colors flex items-center gap-1 py-0.5 px-2 rounded-md hover:bg-white/5"
              title="Ẩn bảng điều khiển"
            >
              <span>✕</span> Thu gọn
            </button>
          </div>

          {/* Quick Chat bar on Stage */}
          <form
            onSubmit={handleSendStageChat}
            className="flex items-center gap-2 bg-[#140e24] border border-white/10 rounded-xl p-1.5 px-3 shadow-md focus-within:border-accent/50 transition-colors"
          >
            <span className="text-base select-none">💬</span>
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Chat gì đó lên đầu nhân vật... (bong bóng 30s)"
              className="flex-1 bg-transparent text-xs text-white placeholder-white/35 focus:outline-none font-sans min-w-0"
              maxLength={120}
            />
            <button
              type="submit"
              disabled={!chatInput.trim() || isSendingChat}
              className="px-3 py-1 bg-accent hover:brightness-110 active:scale-95 text-accent-foreground text-xs font-mono font-bold rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm shrink-0"
            >
              {isSendingChat ? '...' : 'Gửi'}
            </button>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3">
            {/* Box 1: Điệu nhảy của bạn */}
            <div className="bg-[#140e24] border border-white/10 rounded-2xl p-3 sm:p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[11px] sm:text-xs font-mono font-bold uppercase tracking-wider text-white/60">Điệu nhảy của bạn</h3>
                  <span className="text-[10px] font-mono text-accent">Auto-sync</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setYouMove('auto')}
                    className={`px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-mono transition-all ${
                      youMove === 'auto'
                        ? 'bg-accent text-accent-foreground font-semibold shadow-md'
                        : 'bg-white/5 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    Tự động
                  </button>
                  {Object.entries(MOVE_NAMES).map(([k, label]) => {
                    const isSelected = youMove === k;
                    return (
                      <button
                        key={k}
                        onClick={() => setYouMove(k as DanceMove)}
                        className={`px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-mono transition-all ${
                          isSelected
                            ? 'bg-accent text-accent-foreground font-semibold shadow-md'
                            : 'bg-white/5 text-white/70 hover:bg-white/10'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-2.5 pt-2.5 border-t border-white/10">
                <button
                  onClick={handleGroupDance}
                  className="w-full bg-gradient-to-r from-accent to-[#7c5cff] text-white text-[11px] sm:text-xs font-bold uppercase tracking-wider py-2 rounded-xl shadow-lg hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-1.5"
                >
                  <span>🎉</span> Rủ cả phòng đồng diễn
                </button>
              </div>
            </div>

            {/* Box 2: Thả cảm xúc */}
            <div className="bg-[#140e24] border border-white/10 rounded-2xl p-3 sm:p-4 flex flex-col justify-between">
              <div>
                <h3 className="text-[11px] sm:text-xs font-mono font-bold uppercase tracking-wider text-white/60 mb-2">Thả cảm xúc</h3>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {EMOS.map((emo) => (
                    <button
                      key={emo}
                      onClick={() => handleSendEmote(emo)}
                      className="h-9 w-9 sm:h-10 sm:w-10 flex items-center justify-center text-lg sm:text-xl bg-white/5 hover:bg-white/10 rounded-xl active:scale-90 transition-all border border-white/5 hover:border-white/20"
                      title={`Thả ${emo}`}
                    >
                      {emo}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[10px] sm:text-[11px] font-mono text-white/40 mt-2 sm:mt-3">
                Emote sẽ bay lên trên đầu nhân vật của bạn và cả phòng!
              </p>
            </div>

            {/* Box 3: Người nghe trong phòng */}
            <div className="bg-[#140e24] border border-white/10 rounded-2xl p-3 sm:p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[11px] sm:text-xs font-mono font-bold uppercase tracking-wider text-white/60">
                    Đang nghe cùng bạn
                  </h3>
                  <span className="text-[11px] font-mono font-bold text-accent">
                    👥 {activeDancerCount} người
                  </span>
                </div>

                <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar pr-0.5">
                  {membersRef.current
                    .filter((m) => !m.leaving)
                    .map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between bg-white/5 border border-white/5 px-2.5 py-1.5 rounded-xl text-[11px] font-mono"
                      >
                        <div className="flex items-center gap-2 truncate min-w-0">
                          <span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0 animate-pulse" />
                          <span className="truncate text-white/90 font-medium">
                            {m.name}
                          </span>
                          {m.isYou && (
                            <span className="text-accent text-[9px] font-mono px-1 bg-accent/15 rounded shrink-0">
                              Bạn
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-white/40 shrink-0 font-mono ml-2">
                          {MOVE_NAMES[m.mv || ''] || 'Tự động'}
                        </span>
                      </div>
                    ))}
                </div>

                {activeDancerCount <= 1 && (
                  <p className="text-[10px] font-mono text-white/40 text-center mt-2">
                    Chỉ có bạn trên sàn. Khi bạn bè vào phòng nghe nhạc, họ sẽ tự động lên sân khấu!
                  </p>
                )}

                {activeDancerCount >= 2 && (
                  <button
                    onClick={handleManualSwap}
                    className="w-full mt-2 bg-white/5 hover:bg-white/10 active:scale-98 border border-white/10 text-white/80 hover:text-white text-[11px] font-mono py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm"
                    title="Đổi vị trí ngẫu nhiên hai người trên sân khấu"
                  >
                    <span>🔀</span> Đổi vị trí
                  </button>
                )}
              </div>

              <div className="mt-2.5 pt-2.5 border-t border-white/10 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-white/50">Nền sân khấu:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-purple-300 font-semibold truncate max-w-[120px]">
                      {stageBackground?.match(/^(https?:\/\/|data:image)/i)
                        ? 'Ảnh riêng 🖼'
                        : STAGE_PRESETS[stageBackground || 'default']?.name || 'Club Tím'}
                    </span>
                    {isOwner && (
                      <button
                        onClick={() => setIsBgModalOpen(true)}
                        className="text-purple-400 hover:text-purple-200 underline cursor-pointer"
                      >
                        Đổi
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-white/50">Màn hình LED:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-pink-300 font-semibold truncate max-w-[120px]">
                      {ledText?.trim() && ledMode !== 'track'
                        ? ledMode === 'marquee'
                          ? 'Chữ chạy 🏃'
                          : 'Cố định 🎯'
                        : 'Tên bài hát 🎵'}
                    </span>
                    {isOwner && (
                      <button
                        onClick={() => setIsLedModalOpen(true)}
                        className="text-pink-400 hover:text-pink-200 underline cursor-pointer"
                      >
                        Sửa
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono text-white/50">
                  <span>Trạng thái phòng:</span>
                  <span className={isPlaying ? 'text-accent font-semibold flex items-center gap-1' : 'text-white/40'}>
                    {isPlaying ? '♪ Đang phát nhạc' : 'Đang tạm dừng'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex justify-center animate-in fade-in duration-200">
          <button
            onClick={toggleControls}
            className="text-[11px] sm:text-xs font-mono text-white/60 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 shadow-sm hover:border-accent/30 hover:shadow-accent/5 group"
          >
            <span className="text-accent group-hover:scale-110 transition-transform">🎛</span>
            <span>Mở bảng điều khiển</span>
            <span className="text-white/40 text-[10px] hidden sm:inline">(Điệu nhảy, Cảm xúc, Phòng)</span>
            <span className="text-xs text-white/40">▾</span>
          </button>
        </div>
      )}

      {/* Skin Customizer Modal */}
      <SkinEditorModal
        isOpen={isSkinModalOpen}
        onClose={() => setIsSkinModalOpen(false)}
        currentSkin={skin}
        onSave={(updatedSkin) => {
          setSkin(updatedSkin);
          try {
            localStorage.setItem(STORAGE_SKIN_KEY, JSON.stringify(updatedSkin));
          } catch (e) {
            console.warn(e);
          }
          const me = membersRef.current.find((m) => m.isYou);
          if (me) {
            Object.assign(me, updatedSkin);
            me.emotes.push({ e: '✨', t: 0, dx: 0 });
          }
        }}
      />

      {/* Stage Background Customizer Modal (Room owner only) */}
      {isOwner && (
        <StageBackgroundModal
          isOpen={isBgModalOpen}
          onClose={() => setIsBgModalOpen(false)}
          currentBackground={stageBackground}
          onSave={async (bg) => {
            if (onUpdateBackground) {
              await onUpdateBackground(bg);
              addToast('Chủ phòng đã cập nhật nền sân khấu mới! 🖼');
            }
          }}
        />
      )}

      {/* Stage LED Customizer Modal (Room owner only) */}
      {isOwner && (
        <StageLedModal
          isOpen={isLedModalOpen}
          onClose={() => setIsLedModalOpen(false)}
          currentText={ledText}
          currentMode={ledMode}
          currentSpeed={ledSpeed}
          onSave={async (config) => {
            if (onUpdateLedConfig) {
              await onUpdateLedConfig(config);
              addToast('Chủ phòng đã cập nhật chữ LED thành công! 📺');
            }
          }}
        />
      )}
    </div>
  );
}
