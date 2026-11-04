import { useState, useEffect } from 'react';

interface StageLedModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentText?: string;
  currentMode?: 'marquee' | 'static' | 'track';
  currentSpeed?: number;
  onSave: (config: { text: string; mode: 'marquee' | 'static' | 'track'; speed: number }) => void | Promise<void>;
}

const QUICK_SUGGESTIONS = [
  '🔥 QUẨY LÊN NÀO ANH EM! CHÁY HẾT MÌNH! 🕺💃',
  '🎉 CHÀO MỪNG ĐẾN VỚI PHÒNG NGHE NHẠC TNMN! 🎧',
  '🎂 CHÚC MỪNG SINH NHẬT! TUỔI MỚI VUI VẺ & RỰC RỠ! 🥳',
  '❤️ CHILL CÙNG ÂM NHẠC • CHÚC MỌI NGƯỜI NGHE NHẠC THƯ THÁI ✨',
  '⚡ BASS CĂNG CỰC ĐỈNH • DROP TOÀN PHÒNG! 🙌🔥',
];

export default function StageLedModal({
  isOpen,
  onClose,
  currentText = '',
  currentMode = 'marquee',
  currentSpeed = 70,
  onSave,
}: StageLedModalProps) {
  const [text, setText] = useState<string>(currentText);
  const [mode, setMode] = useState<'marquee' | 'static' | 'track'>(currentMode);
  const [speed, setSpeed] = useState<number>(currentSpeed);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setText(currentText || '');
      setMode(currentMode || (currentText ? 'marquee' : 'track'));
      setSpeed(currentSpeed || 70);
      setIsSaving(false);
    }
  }, [isOpen, currentText, currentMode, currentSpeed]);

  if (!isOpen) return null;

  const handleResetToDefault = () => {
    setText('');
    setMode('track');
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const finalMode = !text.trim() ? 'track' : mode === 'track' ? 'marquee' : mode;
      await onSave({
        text: text.trim(),
        mode: finalMode,
        speed,
      });
      onClose();
    } catch (err) {
      console.error('Failed to save LED config:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#120a22] border border-white/15 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-[#f1ecff]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">📺</span>
            <div>
              <h2 className="font-serif text-base sm:text-lg font-bold text-white tracking-tight">
                Chỉnh chữ màn hình LED
              </h2>
              <p className="text-[11px] font-mono text-purple-300/70">
                👑 Quyền chủ phòng • Chữ chạy LED sẽ đồng bộ cho cả phòng
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-3.5 sm:p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4">
          {/* Display Mode Switcher */}
          <div>
            <label className="block text-xs font-mono text-white/70 mb-1.5">
              Chế độ hiển thị:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setMode('marquee')}
                className={`py-2 px-2.5 rounded-xl text-xs font-mono font-semibold transition-all border flex flex-col items-center gap-1 ${
                  mode === 'marquee'
                    ? 'bg-purple-600/30 border-purple-400 text-purple-200 shadow-md'
                    : 'bg-white/[0.03] border-white/10 text-white/60 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                <span className="text-sm">🏃</span>
                <span>Chữ chạy</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('static')}
                className={`py-2 px-2.5 rounded-xl text-xs font-mono font-semibold transition-all border flex flex-col items-center gap-1 ${
                  mode === 'static'
                    ? 'bg-purple-600/30 border-purple-400 text-purple-200 shadow-md'
                    : 'bg-white/[0.03] border-white/10 text-white/60 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                <span className="text-sm">🎯</span>
                <span>Cố định</span>
              </button>
              <button
                type="button"
                onClick={handleResetToDefault}
                className={`py-2 px-2.5 rounded-xl text-xs font-mono font-semibold transition-all border flex flex-col items-center gap-1 ${
                  mode === 'track'
                    ? 'bg-purple-600/30 border-purple-400 text-purple-200 shadow-md'
                    : 'bg-white/[0.03] border-white/10 text-white/60 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                <span className="text-sm">🎵</span>
                <span>Tên bài hát</span>
              </button>
            </div>
          </div>

          {/* Text Input (only relevant if marquee or static) */}
          {mode !== 'track' && (
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-mono text-white/70">
                    Nội dung chữ hiển thị trên LED:
                  </label>
                  <span className="text-[10px] font-mono text-white/40">
                    {text.length}/120 ký tự
                  </span>
                </div>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, 120))}
                  placeholder="Nhập câu chào, lời chúc, hoặc thông báo của phòng..."
                  rows={2}
                  className="w-full bg-black/40 border border-white/15 rounded-xl p-3 text-xs text-white placeholder-white/30 focus:outline-none focus:border-purple-400 font-sans resize-none"
                />
              </div>

              {/* Speed adjustment for marquee */}
              {mode === 'marquee' && (
                <div>
                  <label className="block text-xs font-mono text-white/70 mb-1.5">
                    Tốc độ chữ chạy:
                  </label>
                  <div className="flex gap-2">
                    {[
                      { label: 'Chậm', val: 45 },
                      { label: 'Vừa', val: 70 },
                      { label: 'Nhanh', val: 110 },
                    ].map((s) => (
                      <button
                        key={s.val}
                        type="button"
                        onClick={() => setSpeed(s.val)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-mono transition-all border ${
                          speed === s.val
                            ? 'bg-accent/25 border-accent text-accent font-bold'
                            : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Live Preview Screen */}
              <div>
                <span className="text-[11px] font-mono text-white/50 block mb-1.5">
                  Mô phỏng hiển thị trên màn hình LED:
                </span>
                <div className="w-full h-20 rounded-xl bg-[#090514] border border-[#33255a] p-3 flex flex-col justify-center items-center relative overflow-hidden shadow-inner">
                  {/* Subtle LED glow grid */}
                  <div className="absolute inset-0 bg-radial-glow opacity-30 pointer-events-none" />

                  {mode === 'marquee' ? (
                    <div className="w-full overflow-hidden whitespace-nowrap">
                      <div className="inline-block animate-marquee font-extrabold text-sm text-white tracking-wide drop-shadow-[0_0_8px_rgba(255,79,174,0.7)]">
                        {text.trim() || 'HÃY NHẬP NỘI DUNG CHỮ CỦA BẠN...'}
                      </div>
                    </div>
                  ) : (
                    <p className="font-extrabold text-sm text-white text-center truncate w-full tracking-wide drop-shadow-[0_0_8px_rgba(255,79,174,0.7)]">
                      {text.trim() || 'HÃY NHẬP NỘI DUNG CHỮ CỦA BẠN...'}
                    </p>
                  )}
                  <span className="text-[10px] text-white/60 font-mono mt-1">
                    ♪ Bài hát đang phát • DROP!
                  </span>
                </div>
              </div>

              {/* Quick suggestions */}
              <div>
                <span className="text-[11px] font-mono text-white/50 block mb-1.5">
                  Mẫu chữ gợi ý nhanh:
                </span>
                <div className="space-y-1.5">
                  {QUICK_SUGGESTIONS.map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => {
                        setText(sug);
                      }}
                      className="w-full text-left p-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-[11px] font-mono text-white/80 hover:text-white transition-all truncate block"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {mode === 'track' && (
            <div className="p-4 bg-white/[0.03] border border-white/10 rounded-xl text-center space-y-1.5">
              <span className="text-2xl">🎵</span>
              <p className="text-xs font-semibold text-white">Chế độ mặc định</p>
              <p className="text-[11px] font-mono text-white/50">
                Màn hình LED sẽ tự động hiển thị tên bài hát và nhịp drop của bài nhạc đang phát trong phòng.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-t border-white/10 bg-white/[0.02] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-mono text-white/60 hover:text-white hover:bg-white/5 transition-all"
          >
            Hủy
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 bg-gradient-to-r from-purple-600 to-accent text-white text-xs font-mono font-bold uppercase tracking-wider rounded-xl shadow-lg hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
          >
            <span>✨</span>
            <span>{isSaving ? 'Đang lưu...' : 'Lưu chữ LED'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
