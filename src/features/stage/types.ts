export interface SkinConfig {
  shirt: string;
  pants: string;
  skin: string;
  hairC: string;
  hair: number; // 0: Đinh, 1: Bob, 2: Búi tó, 3: Nón ngược, 4: Tóc dài
  glasses: number; // 0: Không, 1: Kính đen, 2: Kính tim
  acc: number; // 0: Không, 1: Tai nghe, 2: Băng đô
}

export type DanceMove = 
  | 'auto' 
  | 'lacDau' 
  | 'chiTroi' 
  | 'xoayTay' 
  | 'vayTay' 
  | 'daChan' 
  | 'voTay' 
  | 'nhayTung';

export interface EmoteInstance {
  e: string;
  t: number;
  dx: number;
}

export interface StageMember extends SkinConfig {
  id: string | number;
  name: string;
  isYou: boolean;
  seed: number;
  off: number;
  x: number | null;
  y: number;
  s: number;
  tx: number;
  ty: number;
  ts: number;
  enter: number;
  leaving: boolean;
  leave: number;
  hidden: boolean;
  mv: DanceMove | null;
  prev: DanceMove | null;
  blend: number;
  emotes: EmoteInstance[];
  lastPose?: any;
}

export interface PoseState {
  bob: number;
  jump: number;
  lean: number;
  head: number;
  nod: number;
  la: number;
  le: number;
  ra: number;
  re: number;
  kl: number;
  kr: number;
  spread: number;
}

export const MOVE_NAMES: Record<string, string> = {
  lacDau: 'Lắc đầu',
  chiTroi: 'Chỉ trời',
  xoayTay: 'Xoay tay',
  vayTay: 'Vẫy tay',
  daChan: 'Đá chân',
  voTay: 'Vỗ tay',
  nhayTung: 'Nhảy tưng',
};

export const AUTO_SET: DanceMove[] = ['lacDau', 'chiTroi', 'xoayTay', 'vayTay', 'daChan', 'voTay'];
export const DROP_SET: DanceMove[] = ['nhayTung', 'chiTroi', 'vayTay', 'voTay'];

export interface FootballKit {
  id: 'bayern' | 'mu' | 'mc' | 'zalo_ts';
  name: string;
  sub: string;
  baseColor: string;
  previewBg: string;
  badge: string;
}

export const FOOTBALL_KITS: FootballKit[] = [
  {
    id: 'bayern',
    name: 'Bảy Yến',
    sub: 'Đỏ sọc trắng',
    baseColor: '#dc052d',
    previewBg: 'linear-gradient(135deg, #dc052d 0%, #8b001a 100%)',
    badge: '🔴 T',
  },
  {
    id: 'mu',
    name: 'MU',
    sub: 'Moscow 2008',
    baseColor: '#c70101',
    previewBg: 'linear-gradient(135deg, #c70101 0%, #6e0000 100%)',
    badge: '👹 AIG',
  },
  {
    id: 'mc',
    name: 'MC',
    sub: 'Gradient Sky Blue',
    baseColor: '#6cabdd',
    previewBg: 'linear-gradient(180deg, #539be2 0%, #ffffff 100%)',
    badge: '⚡ MC',
  },
  {
    id: 'zalo_ts',
    name: 'Zalo TS',
    sub: 'Technical Sharing',
    baseColor: '#141416',
    previewBg: 'linear-gradient(135deg, #1c1c24 0%, #0c0c10 100%)',
    badge: '💬 Z',
  },
];

export const SHIRTS = ['#ff4fae', '#7c5cff', '#19c6d6', '#ffb21f', '#3fd57a', '#ff6a48', '#f4f4f8', '#2f8bff', '#c56bff'];
export const PANTS = ['#24203a', '#1d2a44', '#3a2a22', '#2b2b2f', '#15324a', '#5a7fb8', '#e9e4d4'];
export const SKINS = ['#f7d6b6', '#efc59e', '#dcab82', '#c58e66'];
export const HAIRC = ['#16101c', '#2f1d14', '#5c3624', '#e14f9f', '#f0c64a', '#8fd8ff', '#b9b4c8'];

export const DEFAULT_SKIN: SkinConfig = {
  shirt: '#ff4fae',
  pants: '#24203a',
  skin: '#efc59e',
  hair: 3,
  hairC: '#16101c',
  glasses: 1,
  acc: 1,
};

export const EMOS = ['🔥', '🙌', '💃', '😎', '❤️', '🥳'];

export interface StageBgPreset {
  id: string;
  name: string;
  icon: string;
  sub: string;
  top: string;
  mid: string;
  bottom: string;
  floorTop: string;
  floorBottom: string;
  gridColor: string;
}

export const STAGE_PRESETS: Record<string, StageBgPreset> = {
  default: {
    id: 'default',
    name: 'Club Tím',
    sub: 'Cyberpunk Classic',
    icon: '🟣',
    top: '#15092a',
    mid: '#0b041a',
    bottom: '#05020c',
    floorTop: '#191033',
    floorBottom: '#090514',
    gridColor: 'rgba(150,110,255,0.16)',
  },
  neon: {
    id: 'neon',
    name: 'Neon Tokyo',
    sub: 'Hồng & Xanh Cyber',
    icon: '💖',
    top: '#2d003b',
    mid: '#150024',
    bottom: '#06000f',
    floorTop: '#3d023a',
    floorBottom: '#0e0017',
    gridColor: 'rgba(0,240,255,0.22)',
  },
  sunset: {
    id: 'sunset',
    name: 'Retro Sunset',
    sub: 'Hoàng hôn Synthwave 80s',
    icon: '🌅',
    top: '#3b0e2b',
    mid: '#230722',
    bottom: '#0c0212',
    floorTop: '#331024',
    floorBottom: '#0d030c',
    gridColor: 'rgba(255,160,40,0.22)',
  },
  ocean: {
    id: 'ocean',
    name: 'Deep Ocean',
    sub: 'Đại dương sâu thẳm',
    icon: '🌊',
    top: '#041f38',
    mid: '#021124',
    bottom: '#010712',
    floorTop: '#062544',
    floorBottom: '#020d1c',
    gridColor: 'rgba(50,210,255,0.20)',
  },
  galaxy: {
    id: 'galaxy',
    name: 'Ngân Hà',
    sub: 'Vũ trụ ngàn sao lấp lánh',
    icon: '🌌',
    top: '#0c0628',
    mid: '#06031a',
    bottom: '#02010c',
    floorTop: '#150c38',
    floorBottom: '#050212',
    gridColor: 'rgba(180,140,255,0.20)',
  },
  emerald: {
    id: 'emerald',
    name: 'Rừng Ngọc',
    sub: 'Xanh ngọc huyền bí',
    icon: '🌲',
    top: '#032b1e',
    mid: '#011710',
    bottom: '#000a06',
    floorTop: '#043625',
    floorBottom: '#01120b',
    gridColor: 'rgba(40,255,160,0.20)',
  },
  minimal: {
    id: 'minimal',
    name: 'Đen Tối Giản',
    sub: 'Huyền bí & Tinh gọn',
    icon: '🖤',
    top: '#131317',
    mid: '#09090c',
    bottom: '#030305',
    floorTop: '#181822',
    floorBottom: '#060608',
    gridColor: 'rgba(255,255,255,0.10)',
  },
};

