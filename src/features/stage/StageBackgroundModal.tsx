import { useState, useEffect, useRef } from 'react';
import { STAGE_PRESETS } from './types';

interface StageBackgroundModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBackground?: string;
  onSave: (bg: string) => void | Promise<void>;
}

const SAMPLE_IMAGES = [
  {
    name: 'Concert Neon',
    sub: 'Đèn laser sân khấu',
    url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1200&auto=format&fit=crop',
  },
  {
    name: 'Cyberpunk City',
    sub: 'Thành phố neon tương lai',
    url: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?q=80&w=1200&auto=format&fit=crop',
  },
  {
    name: 'Synthwave 80s',
    sub: 'Lưới retro hoàng hôn',
    url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1200&auto=format&fit=crop',
  },
  {
    name: 'Deep Cosmos',
    sub: 'Dải ngân hà huyền ảo',
    url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?q=80&w=1200&auto=format&fit=crop',
  },
];

export default function StageBackgroundModal({
  isOpen,
  onClose,
  currentBackground = 'default',
  onSave,
}: StageBackgroundModalProps) {
  const isInitialCustom = !!currentBackground?.match(/^(https?:\/\/|data:image)/i);
  const [activeTab, setActiveTab] = useState<'presets' | 'custom'>(isInitialCustom ? 'custom' : 'presets');
  const [selectedPreset, setSelectedPreset] = useState<string>(isInitialCustom ? 'default' : currentBackground);
  const [customUrl, setCustomUrl] = useState<string>(isInitialCustom ? currentBackground : '');
  const [previewUrl, setPreviewUrl] = useState<string>(isInitialCustom ? currentBackground : '');
  const [uploadFileName, setUploadFileName] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      const isCustom = !!currentBackground?.match(/^(https?:\/\/|data:image)/i);
      setActiveTab(isCustom ? 'custom' : 'presets');
      if (isCustom) {
        setCustomUrl(currentBackground);
        setPreviewUrl(currentBackground);
        setUploadFileName(currentBackground.startsWith('data:') ? 'Ảnh tải lên từ máy' : '');
      } else {
        setSelectedPreset(currentBackground || 'default');
      }
      setIsSaving(false);
    }
  }, [isOpen, currentBackground]);

  if (!isOpen) return null;

  const handleApplyCustomUrl = () => {
    const trimmed = customUrl.trim();
    if (trimmed) {
      setPreviewUrl(trimmed);
      setUploadFileName('');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const rawDataUrl = ev.target?.result as string;
      if (!rawDataUrl) return;

      // Compress and resize image using HTML5 Canvas to keep Firestore payload small (< 120KB)
      const tempImg = new Image();
      tempImg.src = rawDataUrl;
      tempImg.onload = () => {
        const maxDim = 1200;
        let w = tempImg.width;
        let h = tempImg.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(tempImg, 0, 0, w, h);
          const compressed = canvas.toDataURL('image/jpeg', 0.82);
          setCustomUrl(compressed);
          setPreviewUrl(compressed);
          setUploadFileName(file.name);
        }
      };
    };
    reader.readAsDataURL(file);
    // Reset file input value so user can upload the same file again if desired
    e.target.value = '';
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const targetBg = activeTab === 'custom' && customUrl.trim() ? customUrl.trim() : selectedPreset;
      await onSave(targetBg);
      onClose();
    } catch (err) {
      console.error('Failed to save stage background:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-[#120a22] border border-white/15 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-[#f1ecff]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">🖼</span>
            <div>
              <h2 className="font-serif text-base sm:text-lg font-bold text-white tracking-tight">
                Cài đặt nền sân khấu
              </h2>
              <p className="text-[11px] font-mono text-purple-300/70">
                👑 Quyền chủ phòng • Nền sẽ đồng bộ cho tất cả người nghe trong phòng
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

        {/* Tab switch */}
        <div className="flex border-b border-white/10 p-2 sm:px-4 bg-white/[0.02] shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('presets')}
            className={`flex-1 py-1.5 px-3 rounded-xl font-mono text-xs uppercase tracking-wider font-semibold transition-all ${
              activeTab === 'presets'
                ? 'bg-purple-600/30 border border-purple-500/50 text-purple-200 shadow-sm'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            🎨 Bộ sưu tập chủ đề ({Object.keys(STAGE_PRESETS).length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('custom')}
            className={`flex-1 py-1.5 px-3 rounded-xl font-mono text-xs uppercase tracking-wider font-semibold transition-all ${
              activeTab === 'custom'
                ? 'bg-purple-600/30 border border-purple-500/50 text-purple-200 shadow-sm'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            📁 Tải ảnh lên / URL riêng
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-3 sm:p-4 overflow-y-auto custom-scrollbar flex-1 space-y-4">
          {activeTab === 'presets' ? (
            <div className="space-y-2.5">
              <p className="text-xs text-white/60 font-mono">
                Chọn phong cách ánh sáng & màu sắc cho sân khấu của bạn:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {Object.values(STAGE_PRESETS).map((preset) => {
                  const isSelected = selectedPreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setSelectedPreset(preset.id)}
                      className={`flex flex-col text-left p-3 rounded-xl border transition-all relative overflow-hidden group ${
                        isSelected
                          ? 'border-purple-400 bg-purple-900/25 shadow-lg shadow-purple-900/30'
                          : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
                      }`}
                    >
                      {/* Color gradient banner preview */}
                      <div
                        className="w-full h-10 rounded-lg mb-2 relative overflow-hidden border border-white/10"
                        style={{
                          background: `linear-gradient(135deg, ${preset.top} 0%, ${preset.mid} 60%, ${preset.floorTop} 100%)`,
                        }}
                      >
                        <div
                          className="absolute inset-x-0 bottom-0 h-3 opacity-60"
                          style={{
                            background: `linear-gradient(to bottom, transparent, ${preset.floorBottom})`,
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-base shrink-0">{preset.icon}</span>
                          <span className="font-semibold text-xs text-white truncate">{preset.name}</span>
                        </div>
                        {isSelected && (
                          <span className="h-4 w-4 rounded-full bg-purple-500 text-black text-[10px] font-bold flex items-center justify-center shrink-0">
                            ✓
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-mono text-white/45 mt-0.5 truncate">{preset.sub}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Option 1: Upload from local files */}
              <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                    <span>📤</span> Tải ảnh từ máy tính / điện thoại:
                  </span>
                  {uploadFileName && (
                    <span className="text-[10px] font-mono text-accent truncate max-w-[160px]">
                      {uploadFileName}
                    </span>
                  )}
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/png, image/jpeg, image/webp, image/gif"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 px-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 hover:border-purple-400 text-purple-200 text-xs font-mono font-semibold rounded-xl transition-all flex items-center justify-center gap-2 group active:scale-98 shadow-sm"
                >
                  <span className="group-hover:scale-110 transition-transform">📁</span>
                  <span>Chọn ảnh từ thiết bị của bạn</span>
                </button>
                <p className="text-[10px] font-mono text-white/40 text-center">
                  Tự động tối ưu dung lượng ảnh & lưu trữ an toàn
                </p>
              </div>

              {/* Option 2: Enter URL */}
              <div>
                <label className="block text-xs font-mono text-white/70 mb-1.5">
                  Hoặc nhập đường dẫn ảnh trực tiếp (URL):
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={customUrl.startsWith('data:') ? '' : customUrl}
                    onChange={(e) => {
                      setCustomUrl(e.target.value);
                      setUploadFileName('');
                    }}
                    placeholder={customUrl.startsWith('data:') ? 'Đã chọn ảnh từ thiết bị' : 'https://... (URL ảnh JPG, PNG, WebP)'}
                    className="flex-1 bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-purple-400 font-mono min-w-0"
                  />
                  <button
                    type="button"
                    onClick={handleApplyCustomUrl}
                    className="px-3 py-2 bg-white/10 hover:bg-white/15 border border-white/15 rounded-xl text-xs font-mono font-medium transition-all shrink-0"
                  >
                    Xem thử
                  </button>
                </div>
              </div>

              {/* Preview Thumbnail */}
              {previewUrl && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-mono text-white/50">Xem trước ảnh nền:</span>
                  <div className="relative w-full h-36 rounded-xl overflow-hidden border border-white/15 bg-black/50">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={() => {
                        console.warn('Invalid custom image url');
                      }}
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
                      <span className="text-xs font-mono text-white/90 bg-black/60 px-2.5 py-1 rounded-full border border-white/20">
                        Sân khấu sẽ phủ lớp lọc dịu mắt tự động
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Option 3: Quick Sample Image suggestions */}
              <div>
                <span className="text-[11px] font-mono text-white/50 block mb-2">
                  Hoặc chọn nhanh ảnh mẫu có sẵn:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {SAMPLE_IMAGES.map((sample) => (
                    <button
                      key={sample.name}
                      type="button"
                      onClick={() => {
                        setCustomUrl(sample.url);
                        setPreviewUrl(sample.url);
                        setUploadFileName('');
                      }}
                      className="flex items-center gap-2 p-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-xl text-left transition-all group"
                    >
                      <img
                        src={sample.url}
                        alt={sample.name}
                        className="w-10 h-10 rounded-lg object-cover shrink-0 border border-white/10"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate group-hover:text-purple-300">
                          {sample.name}
                        </p>
                        <p className="text-[10px] text-white/40 font-mono truncate">{sample.sub}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
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
            disabled={isSaving || (activeTab === 'custom' && !customUrl.trim())}
            className="px-5 py-2 bg-gradient-to-r from-purple-600 to-accent text-white text-xs font-mono font-bold uppercase tracking-wider rounded-xl shadow-lg hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
          >
            <span>✨</span>
            <span>{isSaving ? 'Đang lưu...' : 'Lưu nền sân khấu'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
