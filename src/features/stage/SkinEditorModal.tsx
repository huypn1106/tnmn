import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_SKIN,
  FOOTBALL_KITS,
  HAIRC,
  PANTS,
  SHIRTS,
  SKINS,
} from './types';
import type { SkinConfig } from './types';
import {
  drawDancer,
  getPose,
} from './danceMath';

interface SkinEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSkin: SkinConfig;
  onSave: (skin: SkinConfig) => void;
}

export const SKIN_OPTS = [
  { key: 'pants' as const, label: 'Màu quần', type: 'color' as const, values: PANTS },
  { key: 'skin' as const, label: 'Màu da', type: 'color' as const, values: SKINS },
  { key: 'hairC' as const, label: 'Màu tóc', type: 'color' as const, values: HAIRC },
  {
    key: 'hair' as const,
    label: 'Kiểu tóc',
    type: 'text' as const,
    values: [
      [0, 'Đầu đinh'],
      [1, 'Tóc bob'],
      [2, 'Búi tó'],
      [3, 'Nón ngược'],
      [4, 'Tóc dài'],
    ] as [number, string][],
  },
  {
    key: 'glasses' as const,
    label: 'Kính',
    type: 'text' as const,
    values: [
      [0, 'Không'],
      [1, 'Kính đen'],
      [2, 'Kính tim'],
    ] as [number, string][],
  },
  {
    key: 'acc' as const,
    label: 'Phụ kiện',
    type: 'text' as const,
    values: [
      [0, 'Không'],
      [1, 'Tai nghe'],
      [2, 'Băng đô'],
    ] as [number, string][],
  },
];

export default function SkinEditorModal({
  isOpen,
  onClose,
  currentSkin,
  onSave,
}: SkinEditorModalProps) {
  const [skin, setSkin] = useState<SkinConfig>(currentSkin);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const pulseRef = useRef<number>(0);

  useEffect(() => {
    setSkin(currentSkin);
  }, [currentSkin, isOpen]);

  // Live avatar preview render loop
  useEffect(() => {
    if (!isOpen) return;

    let lastT = performance.now();
    const render = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;

      pulseRef.current = Math.max(0, pulseRef.current - dt * 2);

      const cv = previewCanvasRef.current;
      if (cv) {
        const ctx = cv.getContext('2d');
        if (ctx) {
          const w = cv.clientWidth;
          const h = cv.clientHeight;
          const dpr = Math.min(2, window.devicePixelRatio || 1);
          if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
            cv.width = Math.round(w * dpr);
            cv.height = Math.round(h * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          }

          // Background
          const g = ctx.createLinearGradient(0, 0, 0, h);
          g.addColorStop(0, '#1d0c3a');
          g.addColorStop(1, '#08040f');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);

          const sg = ctx.createRadialGradient(w / 2, h * 0.55, 5, w / 2, h * 0.55, w * 0.75);
          sg.addColorStop(0, `rgba(255, 79, 174, ${0.22 + 0.35 * pulseRef.current})`);
          sg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = sg;
          ctx.fillRect(0, 0, w, h);

          const timeSec = now / 1000;
          const beat = timeSec * (138 / 60);
          const s = Math.min(h * 0.72, w * 1.2) * (1 + 0.05 * pulseRef.current);

          const dummyMember = {
            ...skin,
            id: 'preview',
            name: 'Bạn',
            isYou: true,
            seed: 0,
            off: 0,
            x: w / 2,
            y: h * 0.88,
            s,
            tx: w / 2,
            ty: h * 0.88,
            ts: s,
            enter: 1,
            leaving: false,
            leave: 0,
            hidden: false,
            mv: 'lacDau' as const,
            prev: null,
            blend: 0,
            emotes: [],
          };

          const ps = getPose('lacDau', beat);
          drawDancer(ctx, dummyMember, ps, 1, 0, false, 0.4, timeSec);
        }
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isOpen, skin]);

  if (!isOpen) return null;

  const handleUpdate = (patch: Partial<SkinConfig>) => {
    pulseRef.current = 1;
    const next = { ...skin, ...patch };
    setSkin(next);
    onSave(next);
  };

  const handleRandomize = () => {
    pulseRef.current = 1;
    const randomPick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    const next: SkinConfig = {
      shirt: randomPick([...SHIRTS, 'bayern', 'mu', 'mc', 'zalo_ts']),
      pants: randomPick(PANTS),
      skin: randomPick(SKINS),
      hairC: randomPick(HAIRC),
      hair: randomPick([0, 1, 2, 3, 4]),
      glasses: randomPick([0, 1, 2]),
      acc: randomPick([0, 1, 2]),
    };
    setSkin(next);
    onSave(next);
  };

  const handleReset = () => {
    pulseRef.current = 1;
    setSkin(DEFAULT_SKIN);
    onSave(DEFAULT_SKIN);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4">
      <div className="w-full max-w-xl md:max-w-2xl overflow-hidden rounded-2xl border border-rule bg-[#130f1e] text-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2">
            <span className="text-lg sm:text-xl">✨</span>
            <h2 className="font-serif text-base sm:text-lg font-bold tracking-tight">Tạo hình nhân vật của bạn</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white transition-colors text-sm"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 p-4 sm:p-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {/* Avatar Preview */}
          <div className="md:col-span-5 flex flex-col items-center">
            <div className="w-full aspect-[3/4] max-w-[170px] sm:max-w-[220px] rounded-2xl overflow-hidden border border-white/10 shadow-inner bg-[#0b0517]">
              <canvas ref={previewCanvasRef} className="w-full h-full block" />
            </div>
            <div className="mt-3 sm:mt-4 flex gap-2 w-full max-w-[170px] sm:max-w-[220px]">
              <button
                onClick={handleRandomize}
                className="flex-1 bg-white/10 hover:bg-white/20 text-[11px] sm:text-xs font-mono py-1.5 sm:py-2 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                <span>🎲</span> Phối đồ
              </button>
              <button
                onClick={handleReset}
                className="bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-[11px] sm:text-xs font-mono px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-colors"
              >
                Mặc định
              </button>
            </div>
          </div>

          {/* Options */}
          <div className="md:col-span-7 space-y-4">
            {/* Shirt & Football Kits */}
            <div className="space-y-2 pb-3 border-b border-white/10">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-mono uppercase tracking-wider text-white/50">
                  Áo đấu & Mẫu áo đặc biệt
                </label>
                {FOOTBALL_KITS.some((k) => k.id === skin.shirt) && (
                  <span className="text-[10px] font-mono text-accent font-semibold animate-in fade-in truncate max-w-[180px]">
                    ★ {FOOTBALL_KITS.find((k) => k.id === skin.shirt)?.name}
                  </span>
                )}
              </div>

              {/* Special Kits: Bảy Yến, MU, MC, Zalo TS */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {FOOTBALL_KITS.map((kit) => {
                  const isSelected = skin.shirt === kit.id;
                  return (
                    <button
                      key={kit.id}
                      type="button"
                      onClick={() => handleUpdate({ shirt: kit.id })}
                      className={`flex items-center gap-2 p-2 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-accent bg-accent/20 ring-1 ring-accent text-white shadow-md'
                          : 'border-white/10 bg-white/5 hover:bg-white/10 text-white/80'
                      }`}
                    >
                      <div
                        className="w-7 h-7 rounded-lg border border-white/20 shrink-0 flex items-center justify-center font-bold text-[9px] shadow-sm overflow-hidden"
                        style={{ background: kit.previewBg }}
                      >
                        {kit.badge}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate leading-tight">{kit.name}</div>
                        <div className="text-[9px] font-mono text-white/40 truncate">{kit.sub}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Solid Color Shirts */}
              <div className="flex flex-wrap gap-2 items-center pt-1">
                <span className="text-[10px] font-mono text-white/40 mr-1">Màu trơn:</span>
                {SHIRTS.map((colorStr) => {
                  const isSelected = skin.shirt === colorStr;
                  return (
                    <button
                      key={colorStr}
                      onClick={() => handleUpdate({ shirt: colorStr })}
                      style={{ backgroundColor: colorStr }}
                      className={`h-6 w-6 rounded-full transition-all border ${
                        isSelected
                          ? 'scale-110 ring-2 ring-accent ring-offset-2 ring-offset-[#130f1e] border-white'
                          : 'border-white/20 hover:scale-105'
                      }`}
                      title={colorStr}
                    />
                  );
                })}
              </div>
            </div>

            {/* Other Options */}
            {SKIN_OPTS.map((opt) => (
              <div key={opt.key} className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase tracking-wider text-white/50">
                  {opt.label}
                </label>
                <div className="flex flex-wrap gap-2">
                  {opt.type === 'color' ? (
                    opt.values.map((val) => {
                      const colorStr = val as string;
                      const isSelected = skin[opt.key] === colorStr;
                      return (
                        <button
                          key={colorStr}
                          onClick={() => handleUpdate({ [opt.key]: colorStr })}
                          style={{ backgroundColor: colorStr }}
                          className={`h-7 w-7 rounded-full transition-all border ${
                            isSelected
                              ? 'scale-110 ring-2 ring-accent ring-offset-2 ring-offset-[#130f1e] border-white'
                              : 'border-white/20 hover:scale-105'
                          }`}
                          title={colorStr}
                        />
                      );
                    })
                  ) : (
                    (opt.values as [number, string][]).map(([val, label]) => {
                      const isSelected = skin[opt.key] === val;
                      return (
                        <button
                          key={val}
                          onClick={() => handleUpdate({ [opt.key]: val })}
                          className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                            isSelected
                              ? 'bg-accent text-accent-foreground font-semibold shadow-md'
                              : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/10 px-6 py-4 bg-white/[0.02]">
          <p className="text-[11px] font-mono text-white/40">
            Lựa chọn của bạn sẽ được lưu trên trình duyệt và tự động lên sàn nhảy.
          </p>
          <button
            onClick={onClose}
            className="bg-accent px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-accent-foreground shadow-lg hover:brightness-110 active:scale-95 transition-all"
          >
            Xong & Quẩy
          </button>
        </div>
      </div>
    </div>
  );
}
