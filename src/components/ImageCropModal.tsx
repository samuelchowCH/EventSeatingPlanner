import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, X, Crop, Check, Image as ImageIcon, RotateCcw, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';

interface ImageCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertImage: (imgHtml: string) => void;
  currentTemplateHtml?: string;
}

interface CropRect {
  x: number; // % of container
  y: number;
  w: number;
  h: number;
}

type Handle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | 'move';

const MIN_CROP_PCT = 5;

export default function ImageCropModal({ isOpen, onClose, onInsertImage, currentTemplateHtml }: ImageCropModalProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [croppedSrc, setCroppedSrc] = useState<string | null>(null); // after applying crop
  const [scalePct, setScalePct] = useState<number>(100); // % of natural image width capped to 600px
  const [alignment, setAlignment] = useState<'left' | 'center' | 'right' | 'inline'>('center');
  const [altText, setAltText] = useState('Event Banner');
  const [isCropMode, setIsCropMode] = useState(false);

  // Crop rect in percentage of the preview container (not the original image)
  const [crop, setCrop] = useState<CropRect>({ x: 10, y: 10, w: 80, h: 80 });
  const [dragging, setDragging] = useState<{ handle: Handle; startX: number; startY: number; startCrop: CropRect } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset when closed
  useEffect(() => {
    if (!isOpen) {
      setImageSrc(null);
      setCroppedSrc(null);
      setCrop({ x: 10, y: 10, w: 80, h: 80 });
      setIsCropMode(false);
      setScalePct(100);
      setAlignment('center');
      setAltText('Event Banner');
    }
  }, [isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      setImageSrc(src);
      setCroppedSrc(null);
      setCrop({ x: 5, y: 5, w: 90, h: 90 });
      setIsCropMode(false);
    };
    reader.readAsDataURL(file);
  };

  // ─── Crop Drag Logic ────────────────────────────────────────────────────────
  const getContainerRect = () => containerRef.current?.getBoundingClientRect();

  const onMouseDown = useCallback((e: React.MouseEvent, handle: Handle) => {
    if (!isCropMode) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = getContainerRect();
    if (!rect) return;
    setDragging({
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startCrop: { ...crop },
    });
  }, [isCropMode, crop]);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: MouseEvent) => {
      const rect = getContainerRect();
      if (!rect) return;

      const dx = ((e.clientX - dragging.startX) / rect.width) * 100;
      const dy = ((e.clientY - dragging.startY) / rect.height) * 100;
      const sc = dragging.startCrop;

      setCrop(prev => {
        let { x, y, w, h } = sc;

        switch (dragging.handle) {
          case 'move':
            x = Math.max(0, Math.min(100 - w, sc.x + dx));
            y = Math.max(0, Math.min(100 - h, sc.y + dy));
            break;
          case 'nw':
            x = Math.max(0, Math.min(sc.x + sc.w - MIN_CROP_PCT, sc.x + dx));
            y = Math.max(0, Math.min(sc.y + sc.h - MIN_CROP_PCT, sc.y + dy));
            w = sc.w - (x - sc.x);
            h = sc.h - (y - sc.y);
            break;
          case 'ne':
            y = Math.max(0, Math.min(sc.y + sc.h - MIN_CROP_PCT, sc.y + dy));
            w = Math.max(MIN_CROP_PCT, Math.min(100 - sc.x, sc.w + dx));
            h = sc.h - (y - sc.y);
            break;
          case 'sw':
            x = Math.max(0, Math.min(sc.x + sc.w - MIN_CROP_PCT, sc.x + dx));
            w = sc.w - (x - sc.x);
            h = Math.max(MIN_CROP_PCT, Math.min(100 - sc.y, sc.h + dy));
            break;
          case 'se':
            w = Math.max(MIN_CROP_PCT, Math.min(100 - sc.x, sc.w + dx));
            h = Math.max(MIN_CROP_PCT, Math.min(100 - sc.y, sc.h + dy));
            break;
          case 'n':
            y = Math.max(0, Math.min(sc.y + sc.h - MIN_CROP_PCT, sc.y + dy));
            h = sc.h - (y - sc.y);
            break;
          case 's':
            h = Math.max(MIN_CROP_PCT, Math.min(100 - sc.y, sc.h + dy));
            break;
          case 'e':
            w = Math.max(MIN_CROP_PCT, Math.min(100 - sc.x, sc.w + dx));
            break;
          case 'w':
            x = Math.max(0, Math.min(sc.x + sc.w - MIN_CROP_PCT, sc.x + dx));
            w = sc.w - (x - sc.x);
            break;
        }
        return { x, y, w, h };
      });
    };

    const onUp = () => setDragging(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging]);

  // ─── Apply Crop via Canvas ────────────────────────────────────────────────
  const applyCrop = () => {
    const src = croppedSrc || imageSrc;
    if (!src || !canvasRef.current || !containerRef.current) return;

    const imgEl = containerRef.current.querySelector('img') as HTMLImageElement;
    if (!imgEl) return;

    // The img element fills the container; get its rendered bounds
    const imgRect = imgEl.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    // Offset of the img inside the container (for object-contain letterboxing)
    const imgOffsetLeft = imgRect.left - containerRect.left;
    const imgOffsetTop = imgRect.top - containerRect.top;

    // Crop box in px relative to container
    const cropPxX = (crop.x / 100) * containerRect.width;
    const cropPxY = (crop.y / 100) * containerRect.height;
    const cropPxW = (crop.w / 100) * containerRect.width;
    const cropPxH = (crop.h / 100) * containerRect.height;

    // Convert to % of the rendered image dimensions
    const relX = (cropPxX - imgOffsetLeft) / imgRect.width;
    const relY = (cropPxY - imgOffsetTop) / imgRect.height;
    const relW = cropPxW / imgRect.width;
    const relH = cropPxH / imgRect.height;

    const clamp = (v: number) => Math.max(0, Math.min(1, v));

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    img.onload = () => {
      const sx = clamp(relX) * img.naturalWidth;
      const sy = clamp(relY) * img.naturalHeight;
      const sw = Math.max(1, clamp(relW) * img.naturalWidth);
      const sh = Math.max(1, clamp(relH) * img.naturalHeight);

      const canvas = canvasRef.current!;
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      const cropped = canvas.toDataURL('image/jpeg', 0.9);
      setCroppedSrc(cropped);
      setCrop({ x: 5, y: 5, w: 90, h: 90 });
      setIsCropMode(false);
    };
  };

  const resetCrop = () => {
    setCroppedSrc(null);
    setCrop({ x: 5, y: 5, w: 90, h: 90 });
    setIsCropMode(false);
  };

  const handleInsert = () => {
    const src = croppedSrc || imageSrc;
    if (!src) return;

    // Use percentage-based max-width with naturalWidth as cap
    const maxW = Math.round((scalePct / 100) * 600);

    const marginMap = {
      left: 'margin: 12px 0;',
      center: 'margin: 12px auto;',
      right: 'margin: 12px 0 12px auto;',
    };

    const safeAlt = altText.replace(/"/g, '&quot;');
    const imgTag = `<img src="${src}" alt="${safeAlt}" style="max-width: ${maxW}px; width: 100%; height: auto; display: block; ${marginMap[alignment]} border-radius: 4px;" />`;
    onInsertImage(imgTag);
    onClose();
  };

  if (!isOpen) return null;

  const displaySrc = croppedSrc || imageSrc;
  const canInsert = !!displaySrc && !isCropMode;

  // Corner + edge handle definition
  const handles: { id: Handle; style: React.CSSProperties; cursor: string }[] = [
    { id: 'nw', style: { top: -5, left: -5 }, cursor: 'nwse-resize' },
    { id: 'ne', style: { top: -5, right: -5 }, cursor: 'nesw-resize' },
    { id: 'sw', style: { bottom: -5, left: -5 }, cursor: 'nesw-resize' },
    { id: 'se', style: { bottom: -5, right: -5 }, cursor: 'nwse-resize' },
    { id: 'n', style: { top: -4, left: '50%', transform: 'translateX(-50%)' }, cursor: 'n-resize' },
    { id: 's', style: { bottom: -4, left: '50%', transform: 'translateX(-50%)' }, cursor: 's-resize' },
    { id: 'e', style: { right: -4, top: '50%', transform: 'translateY(-50%)' }, cursor: 'e-resize' },
    { id: 'w', style: { left: -4, top: '50%', transform: 'translateY(-50%)' }, cursor: 'w-resize' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gilded-ink/70 backdrop-blur-md">
      <div className="bg-white border border-gilded-border shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh] rounded-none">
        {/* Header */}
        <div className="px-5 py-3 border-b border-gilded-border flex items-center justify-between bg-gilded-bg shrink-0">
          <div className="flex items-center gap-2">
            <ImageIcon size={15} className="text-gilded-accent" />
            <h3 className="font-serif font-semibold text-gilded-ink text-sm">Insert Inline Image</h3>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gilded-ink cursor-pointer transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {!displaySrc ? (
            /* ── Upload Zone ── */
            <div
              className="border-2 border-dashed border-gilded-border rounded-none p-10 text-center bg-gilded-faint/30 hover:bg-gilded-faint/60 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={36} className="mx-auto text-gilded-accent mb-3" />
              <p className="text-sm font-semibold text-gilded-ink mb-1">Click to upload an image</p>
              <p className="text-xs text-gray-400 font-mono">PNG · JPG · WebP — max 5 MB</p>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            </div>
          ) : (
            <>
              {/* ── Image Preview / Crop Area ── */}
              <div
                ref={containerRef}
                className="relative bg-[#1a1a1a] border border-gray-700 overflow-hidden select-none"
                style={{ minHeight: 260, maxHeight: 380, cursor: isCropMode ? 'crosshair' : 'default' }}
              >
                <img
                  src={displaySrc}
                  alt="Preview"
                  className="w-full h-full object-contain pointer-events-none"
                  style={{ maxHeight: 380, display: 'block' }}
                  draggable={false}
                />

                {/* Dark overlay outside crop when in crop mode */}
                {isCropMode && (
                  <>
                    {/* Darkened areas */}
                    <div className="absolute inset-0 pointer-events-none" style={{
                      background: `linear-gradient(
                        to bottom,
                        rgba(0,0,0,0.55) ${crop.y}%,
                        transparent ${crop.y}%,
                        transparent ${crop.y + crop.h}%,
                        rgba(0,0,0,0.55) ${crop.y + crop.h}%
                      )`
                    }} />
                    <div className="absolute pointer-events-none" style={{
                      top: `${crop.y}%`,
                      left: 0,
                      width: `${crop.x}%`,
                      height: `${crop.h}%`,
                      background: 'rgba(0,0,0,0.55)',
                    }} />
                    <div className="absolute pointer-events-none" style={{
                      top: `${crop.y}%`,
                      right: 0,
                      left: `${crop.x + crop.w}%`,
                      height: `${crop.h}%`,
                      background: 'rgba(0,0,0,0.55)',
                    }} />

                    {/* Crop box */}
                    <div
                      className="absolute border-2 border-amber-400 box-border"
                      style={{
                        left: `${crop.x}%`,
                        top: `${crop.y}%`,
                        width: `${crop.w}%`,
                        height: `${crop.h}%`,
                        cursor: 'move',
                      }}
                      onMouseDown={(e) => onMouseDown(e, 'move')}
                    >
                      {/* Rule-of-thirds grid lines */}
                      <div className="absolute inset-0 pointer-events-none" style={{
                        backgroundImage: 'linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)',
                        backgroundSize: '33.33% 33.33%',
                      }} />

                      {/* Handles */}
                      {handles.map(h => (
                        <div
                          key={h.id}
                          className="absolute w-3 h-3 bg-amber-400 border border-amber-600 rounded-sm z-10"
                          style={{ ...h.style, cursor: h.cursor, position: 'absolute' }}
                          onMouseDown={(e) => onMouseDown(e, h.id)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* ── Toolbar ── */}
              <div className="flex flex-wrap items-center gap-2">
                {!isCropMode ? (
                  <button
                    type="button"
                    onClick={() => setIsCropMode(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-semibold bg-white border border-gray-300 hover:border-gilded-accent text-gray-700 cursor-pointer transition-all"
                  >
                    <Crop size={12} /> Crop / Trim
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={applyCrop}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer transition-all"
                    >
                      <Check size={12} /> Apply Crop
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCropMode(false)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-semibold bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 cursor-pointer"
                    >
                      <X size={12} /> Cancel
                    </button>
                  </>
                )}

                {croppedSrc && !isCropMode && (
                  <button
                    type="button"
                    onClick={resetCrop}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-semibold bg-white border border-gray-300 text-amber-700 hover:bg-amber-50 cursor-pointer"
                  >
                    <RotateCcw size={12} /> Reset to Original
                  </button>
                )}

                <label className="ml-auto text-xs font-mono text-gray-500 hover:text-gilded-ink cursor-pointer underline underline-offset-2">
                  Change Image
                  <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                </label>
              </div>

              {/* ── Scale Slider (%) ── */}
              <div className="bg-gray-50 border border-gray-200 p-3 space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-mono font-semibold text-gray-700 uppercase tracking-wide">
                      Display Size
                    </label>
                    <span className="text-xs font-mono font-bold text-gilded-ink bg-gilded-accent/20 border border-gilded-accent px-2 py-0.5">
                      {scalePct}% — up to {Math.round((scalePct / 100) * 600)}px wide
                    </span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={100}
                    step={5}
                    value={scalePct}
                    onChange={(e) => setScalePct(Number(e.target.value))}
                    className="w-full accent-gilded-accent cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-gray-400 mt-0.5">
                    <span>Small (20%)</span>
                    <span>Half (50%)</span>
                    <span>Full width (100%)</span>
                  </div>
                </div>

                {/* Alignment */}
                <div>
                  <label className="block text-xs font-mono font-semibold text-gray-700 uppercase tracking-wide mb-1.5">Alignment</label>
                  <div className="flex gap-1.5">
                    {([
                      { val: 'left', Icon: AlignLeft, label: 'Left' },
                      { val: 'center', Icon: AlignCenter, label: 'Center' },
                      { val: 'right', Icon: AlignRight, label: 'Right' },
                    ] as const).map(({ val, Icon, label }) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setAlignment(val)}
                        className={`flex-1 py-1.5 text-xs font-mono flex items-center justify-center gap-1 border transition-all cursor-pointer ${
                          alignment === val
                            ? 'bg-gilded-accent border-gilded-border text-gilded-ink font-bold'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        <Icon size={12} /> {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Alt text */}
              <div>
                <label className="block text-xs font-mono font-semibold text-gray-600 uppercase tracking-wide mb-1">Alt Description</label>
                <input
                  type="text"
                  value={altText}
                  onChange={(e) => setAltText(e.target.value)}
                  placeholder="e.g. Event Banner"
                  className="w-full px-3 py-1.5 border border-gray-300 text-xs font-sans focus:border-gilded-accent outline-none"
                />
              </div>

              {/* ── Live Email Preview ── */}
              {!isCropMode && (
                <div className="border border-gray-300 bg-[#faf7f2] p-4 rounded-none">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-wide">
                      Live Email Preview
                    </p>
                    <span className="text-[10px] font-mono text-gray-400">
                      Display width: {Math.round((scalePct / 100) * 600)}px
                    </span>
                  </div>
                  <div className="bg-white p-5 border border-gilded-border/40 shadow-2xs text-xs font-sans text-gilded-ink leading-relaxed max-w-[600px] mx-auto">
                    {currentTemplateHtml ? (
                      <div
                        className="[&_p]:mb-4 [&_p]:leading-relaxed [&_p]:min-h-[1.25em]"
                        dangerouslySetInnerHTML={{
                          __html: currentTemplateHtml + `<img src="${displaySrc}" alt="${altText.replace(/"/g, '&quot;')}" style="max-width: ${Math.round((scalePct / 100) * 600)}px; width: 100%; height: auto; ${alignment === 'inline' ? 'display: inline-block; vertical-align: middle; margin: 0 4px;' : alignment === 'left' ? 'display: block; float: left; margin: 4px 12px 8px 0;' : alignment === 'right' ? 'display: block; float: right; margin: 4px 0 8px 12px;' : 'display: block; margin: 12px auto;'} border-radius: 4px;" />`,
                        }}
                      />
                    ) : (
                      <>
                        <p style={{ marginBottom: 16, lineHeight: 1.6 }}>Dear Guest,</p>
                        <img
                          src={displaySrc}
                          alt={altText}
                          style={{
                            maxWidth: `${Math.round((scalePct / 100) * 600)}px`,
                            width: '100%',
                            height: 'auto',
                            display: alignment === 'inline' ? 'inline-block' : 'block',
                            margin: alignment === 'center' ? '12px auto' : alignment === 'right' ? '12px 0 12px auto' : alignment === 'left' ? '4px 12px 8px 0' : '0 4px',
                            borderRadius: 4,
                          }}
                        />
                        <p style={{ marginBottom: 16, lineHeight: 1.6 }}>
                          We are delighted to invite you to the event! Your attendance is warmly requested.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Hidden canvas */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gilded-border bg-gilded-bg flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 text-xs font-mono font-semibold uppercase tracking-wider cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleInsert}
            disabled={!canInsert}
            className="px-4 py-1.5 bg-gilded-ink hover:bg-gilded-accent text-white disabled:opacity-40 text-xs font-mono font-semibold uppercase tracking-wider cursor-pointer flex items-center gap-1.5 transition-all"
          >
            <Check size={13} />
            Insert Into Template
          </button>
        </div>
      </div>
    </div>
  );
}
