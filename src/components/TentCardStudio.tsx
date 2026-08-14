/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { jsPDF } from 'jspdf';
import { Tag, FileDown, Eye, Check, RefreshCw, Printer, ZoomIn, ZoomOut, Grid, Info, Layout } from 'lucide-react';
import { Guest, Table } from '../types';
import { captureElementToJpeg } from '../utils/domImageExporter';

interface TentCardStudioProps {
  guests: Guest[];
  tables: Table[];
  exportRef?: React.MutableRefObject<(() => void) | null>;
  isExporting?: boolean;
  setIsExporting?: (val: boolean) => void;
  exportProgress?: string;
  setExportProgress?: (val: string) => void;
}

export default function TentCardStudio({
  guests,
  tables,
  exportRef,
  isExporting,
  setIsExporting,
  exportProgress,
  setExportProgress,
}: TentCardStudioProps) {
  // Page setup
  const [paperSize, setPaperSize] = useState<'a4' | 'letter'>('a4');
  const [rows, setRows] = useState(8);
  const [cols, setCols] = useState(3);
  const [margin, setMargin] = useState(10); // in mm

  // Card options
  const [cardType, setCardType] = useState<'tent' | 'flat'>('tent'); // tent = foldable, flat = place card
  const [showGuidelines, setShowGuidelines] = useState(true);
  const [showFoldLines, setShowFoldLines] = useState(true);
  const [showSublabels, setShowSublabels] = useState(true);
  const [sortBy, setSortBy] = useState<'alphabetical' | 'table'>('table');

  // Styling options
  const [fontFamily, setFontFamily] = useState<'sans' | 'serif' | 'mono' | 'yahei' | 'kaiti' | 'simhei'>('yahei');
  const [fontSize, setFontSize] = useState(14); // in pt
  const [fontColor, setFontColor] = useState('#0f172a');
  const [fontWeight, setFontWeight] = useState<'normal' | 'medium' | 'bold'>('bold');
  const [textTransform, setTextTransform] = useState<'none' | 'uppercase' | 'capitalize'>('none');
  const [borderColor, setBorderColor] = useState('#e2e8f0');

  // Preview options
  const [previewZoom, setPreviewZoom] = useState(100);
  const [selectedTableFilter, setSelectedTableFilter] = useState<string>('all');

  // Export states (lifted or local)
  const [localIsExporting, localSetIsExporting] = useState(false);
  const [localExportProgress, localSetExportProgress] = useState('');

  const currentIsExporting = isExporting !== undefined ? isExporting : localIsExporting;
  const currentSetIsExporting = setIsExporting !== undefined ? setIsExporting : localSetIsExporting;
  const currentExportProgress = exportProgress !== undefined ? exportProgress : localExportProgress;
  const currentSetExportProgress = setExportProgress !== undefined ? setExportProgress : localSetExportProgress;

  // DOM ref for off-screen capturing
  const printContainerRef = useRef<HTMLDivElement>(null);

  // Filter and Sort guests
  const filteredGuests = guests.filter((g) => {
    if (selectedTableFilter === 'all') return true;
    if (selectedTableFilter === 'unassigned') return g.tableId === null;
    return g.tableId === selectedTableFilter;
  });

  const sortedGuests = [...filteredGuests].sort((a, b) => {
    if (sortBy === 'alphabetical') {
      return a.name.localeCompare(b.name);
    } else {
      // Sort by table name first, then guest name
      const tableA = tables.find((t) => t.id === a.tableId);
      const tableB = tables.find((t) => t.id === b.tableId);
      if (!tableA && !tableB) return a.name.localeCompare(b.name);
      if (!tableA) return 1;
      if (!tableB) return -1;
      const comp = tableA.name.localeCompare(tableB.name);
      if (comp !== 0) return comp;
      return a.name.localeCompare(b.name);
    }
  });

  // Font family mapping
  const getFontFamilyStyle = (font: typeof fontFamily) => {
    switch (font) {
      case 'sans':
        return '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      case 'serif':
        return 'Georgia, Cambria, "Times New Roman", Times, serif';
      case 'mono':
        return '"JetBrains Mono", SFMono-Regular, Consolas, Monaco, monospace';
      case 'yahei':
        return '"Microsoft YaHei", "PingFang SC", "Heiti SC", sans-serif';
      case 'kaiti':
        return '"KaiTi", "STKaiti", "BiauKai", serif';
      case 'simhei':
        return '"SimHei", "STHeiti", sans-serif';
      default:
        return 'sans-serif';
    }
  };

  const getFontFamilyNameLabel = (font: typeof fontFamily) => {
    switch (font) {
      case 'sans': return 'Inter / System Sans';
      case 'serif': return 'Georgia / Editorial Serif';
      case 'mono': return 'JetBrains Mono / Tech';
      case 'yahei': return 'Microsoft YaHei / Modern Chinese';
      case 'kaiti': return 'STKaiti / Elegant Brush (Chinese)';
      case 'simhei': return 'SimHei / Bold Gothic (Chinese)';
    }
  };

  const colorPresets = [
    '#0f172a', // Slate 900
    '#1e293b', // Slate 800
    '#047857', // Emerald 700
    '#1d4ed8', // Blue 700
    '#b91c1c', // Red 700
    '#7c3aed', // Purple 600
    '#a21caf', // Fuchsia 700
    '#c2410c', // Orange 700
  ];

  // Paper Dimensions in mm
  const paperDimensions = {
    a4: { w: 210, h: 297 },
    letter: { w: 215.9, h: 279.4 },
  };

  const dim = paperDimensions[paperSize];
  const itemsPerPage = rows * cols;
  const totalPages = Math.ceil(sortedGuests.length / itemsPerPage) || 1;

  // Render a high-resolution PDF by rendering each page div to an html2canvas, then adding it to jsPDF
  const handleExportPDF = async () => {
    if (sortedGuests.length === 0) return;
    setIsExporting(true);
    currentSetExportProgress('Initializing tent card document...');

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: paperSize,
      });

      const pages = printContainerRef.current?.children;
      if (!pages || pages.length === 0) {
        throw new Error('No pages rendered for export.');
      }

      for (let i = 0; i < pages.length; i++) {
        currentSetExportProgress(`Generating Page ${i + 1} of ${pages.length}...`);
        const pageEl = pages[i] as HTMLElement;

        const captured = await captureElementToJpeg(pageEl, { pixelRatio: 2, quality: 0.95 });
        const imgData = captured.dataUrl;

        if (i > 0) {
          doc.addPage();
        }

        doc.addImage(
          imgData,
          'JPEG',
          0,
          0,
          dim.w,
          dim.h,
          undefined,
          'FAST'
        );
      }

      currentSetExportProgress('Saving file...');
      doc.save(`Tent_Cards_${paperSize.toUpperCase()}_${rows}x${cols}.pdf`);
    } catch (err) {
      console.error('Failed to export PDF:', err);
      alert('Failed to generate PDF. Please try rendering fewer rows/columns or check logs.');
    } finally {
      currentSetIsExporting(false);
      currentSetExportProgress('');
    }
  };

  // Register the export function to the external ref
  React.useEffect(() => {
    if (exportRef) {
      exportRef.current = handleExportPDF;
    }
  });

  return (
    <div className="bg-slate-50 min-h-screen pb-16">
      <div className="max-w-[96%] mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT 4 COLS: DESIGN CONTROL PANEL */}
          <div className="lg:col-span-4 bg-white border border-gilded-border rounded-none p-5 shadow-xs space-y-5">
            <div className="border-b border-gilded-border pb-3">
              <h2 className="text-sm font-bold text-gilded-ink font-serif uppercase tracking-wider flex items-center gap-2">
                <Layout size={16} className="text-gilded-accent" />
                Layout & Size
              </h2>
              <p className="text-[10px] text-gray-400 font-mono mt-0.5">Control the grid alignment exactly</p>
            </div>

            {/* Grid dimensions */}
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono mb-1.5">
                  Rows
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={rows}
                  onChange={(e) => setRows(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full text-xs font-sans bg-slate-50 border border-gilded-border rounded-none p-2.5 focus:bg-white focus:ring-1 focus:ring-gilded-accent transition-colors font-semibold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono mb-1.5">
                  Columns
                </label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={cols}
                  onChange={(e) => setCols(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full text-xs font-sans bg-slate-50 border border-gilded-border rounded-none p-2.5 focus:bg-white focus:ring-1 focus:ring-gilded-accent transition-colors font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono mb-1.5">
                  Paper Format
                </label>
                <select
                  value={paperSize}
                  onChange={(e) => setPaperSize(e.target.value as 'a4' | 'letter')}
                  className="w-full text-xs font-sans bg-slate-50 border border-gilded-border rounded-none p-2.5 focus:bg-white focus:ring-1 focus:ring-gilded-accent transition-colors font-semibold"
                >
                  <option value="a4">A4 (210 x 297 mm)</option>
                  <option value="letter">US Letter (215.9 x 279.4 mm)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono mb-1.5">
                  Margins (mm)
                </label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={margin}
                  onChange={(e) => setMargin(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full text-xs font-sans bg-slate-50 border border-gilded-border rounded-none p-2.5 focus:bg-white focus:ring-1 focus:ring-gilded-accent transition-colors font-semibold"
                />
              </div>
            </div>

            <hr className="border-gilded-border/50" />

            {/* Typography and Stylings Section */}
            <div>
              <h2 className="text-sm font-bold text-gilded-ink font-serif uppercase tracking-wider flex items-center gap-2 mb-3">
                <Tag size={16} className="text-gilded-accent" />
                Typography & Style
              </h2>

              <div className="space-y-4">
                {/* Font families */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono mb-1.5">
                    Font Selection
                  </label>
                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value as any)}
                    className="w-full text-xs font-sans bg-slate-50 border border-gilded-border rounded-none p-2.5 focus:bg-white focus:ring-1 focus:ring-gilded-accent transition-colors font-semibold"
                    style={{ fontFamily: getFontFamilyStyle(fontFamily) }}
                  >
                    <option value="serif">Georgia / Editorial Serif</option>
                    <option value="sans">Inter / Standard Sans-Serif</option>
                    <option value="mono">JetBrains Mono / Tech Code</option>
                    <option value="yahei">Microsoft YaHei (Chinese Recommended)</option>
                    <option value="kaiti">STKaiti (Chinese Brush Script)</option>
                    <option value="simhei">SimHei (Chinese Block Gothic)</option>
                  </select>
                </div>

                {/* Font weights & sizing slider */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono mb-1.5">
                      Font Sizing (pt)
                    </label>
                    <input
                      type="number"
                      min={6}
                      max={48}
                      value={fontSize}
                      onChange={(e) => setFontSize(Math.max(6, parseInt(e.target.value) || 6))}
                      className="w-full text-xs font-sans bg-slate-50 border border-gilded-border rounded-none p-2.5 focus:bg-white focus:ring-1 focus:ring-gilded-accent transition-colors font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono mb-1.5">
                      Font Weight
                    </label>
                    <select
                      value={fontWeight}
                      onChange={(e) => setFontWeight(e.target.value as any)}
                      className="w-full text-xs font-sans bg-slate-50 border border-gilded-border rounded-none p-2.5 focus:bg-white focus:ring-1 focus:ring-gilded-accent transition-colors font-semibold"
                    >
                      <option value="normal">Normal</option>
                      <option value="medium">Medium</option>
                      <option value="bold">Bold</option>
                    </select>
                  </div>
                </div>

                {/* Font Color preset selector */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono mb-1.5">
                    Font Color
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {colorPresets.map((hex) => (
                      <button
                        key={hex}
                        onClick={() => setFontColor(hex)}
                        className={`w-6 h-6 rounded-full border transition-transform cursor-pointer relative ${
                          fontColor === hex ? 'scale-110 border-gilded-accent' : 'border-gray-200'
                        }`}
                        style={{ backgroundColor: hex }}
                      >
                        {fontColor === hex && (
                          <Check size={10} className="text-white absolute inset-0 m-auto" />
                        )}
                      </button>
                    ))}
                    <input
                      type="color"
                      value={fontColor}
                      onChange={(e) => setFontColor(e.target.value)}
                      className="w-6 h-6 p-0 border border-gray-200 rounded-full overflow-hidden cursor-pointer shrink-0"
                    />
                  </div>
                </div>

                {/* Text Transform selector */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono mb-1.5">
                    Text Case capitalization
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['none', 'uppercase', 'capitalize'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setTextTransform(mode)}
                        className={`py-1.5 px-2 text-[10px] font-bold rounded-none border text-center uppercase tracking-wider transition-all cursor-pointer ${
                          textTransform === mode
                            ? 'bg-gilded-accent text-gilded-ink border-gilded-accent'
                            : 'bg-slate-50 hover:bg-slate-100 text-gray-600 border-gilded-border/50'
                        }`}
                      >
                        {mode === 'none' ? 'Default' : mode}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <hr className="border-gilded-border/50" />

            {/* Display Options Checkboxes */}
            <div className="space-y-3.5">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono">
                Card Guidelines & Print Modes
              </h3>

              <div className="space-y-2.5">
                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    checked={cardType === 'tent'}
                    onChange={(e) => setCardType(e.target.checked ? 'tent' : 'flat')}
                    className="rounded-none border-gilded-border text-gilded-accent focus:ring-gilded-accent h-4 w-4 cursor-pointer"
                  />
                  <span>
                    Foldable Double-sided Tent Card
                    <p className="text-[9px] font-normal text-gray-400">
                      Print guest name on front & 180° rotated upside down on back
                    </p>
                  </span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    checked={showGuidelines}
                    onChange={(e) => setShowGuidelines(e.target.checked)}
                    className="rounded-none border-gilded-border text-gilded-accent focus:ring-gilded-accent h-4 w-4 cursor-pointer"
                  />
                  <span>Show dotted cut lines</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    checked={showFoldLines}
                    onChange={(e) => setShowFoldLines(e.target.checked)}
                    className="rounded-none border-gilded-border text-gilded-accent focus:ring-gilded-accent h-4 w-4 cursor-pointer"
                    disabled={cardType !== 'tent'}
                  />
                  <span className={cardType !== 'tent' ? 'opacity-40' : ''}>
                    Show middle fold-crease guideline
                  </span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    checked={showSublabels}
                    onChange={(e) => setShowSublabels(e.target.checked)}
                    className="rounded-none border-gilded-border text-gilded-accent focus:ring-gilded-accent h-4 w-4 cursor-pointer"
                  />
                  <span>Show table, seat, and social group</span>
                </label>
              </div>
            </div>

            <hr className="border-gilded-border/50" />

            {/* Filtering and Sort Block */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono">
                Filter & Sorting
              </h3>

              <div className="space-y-2">
                <div>
                  <label className="block text-[10px] text-gray-500 font-sans mb-1 font-semibold">
                    Filter by Table
                  </label>
                  <select
                    value={selectedTableFilter}
                    onChange={(e) => setSelectedTableFilter(e.target.value)}
                    className="w-full text-xs font-sans bg-slate-50 border border-gilded-border rounded-none p-2 focus:bg-white focus:ring-1 focus:ring-gilded-accent transition-colors font-semibold"
                  >
                    <option value="all">All Seated & Unseated Guests ({guests.length})</option>
                    <option value="unassigned">Unseated Guests Only ({guests.filter(g => g.tableId === null).length})</option>
                    {tables.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({guests.filter(g => g.tableId === t.id).length} guests)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-gray-500 font-sans mb-1 font-semibold">
                    Sort Order for print sheets
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-full text-xs font-sans bg-slate-50 border border-gilded-border rounded-none p-2 focus:bg-white focus:ring-1 focus:ring-gilded-accent transition-colors font-semibold"
                  >
                    <option value="table">Grouped by Table & Seat (Highly Recommended)</option>
                    <option value="alphabetical">Alphabetical order (A-Z)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT 8 COLS: PREVIEW ORCHESTRA */}
          <div className="lg:col-span-8 space-y-6">
            {/* Empty State warning */}
            {sortedGuests.length === 0 && (
              <div className="bg-white border border-gilded-border rounded-none p-16 text-center shadow-3xs">
                <Tag size={40} className="mx-auto text-gray-300 mb-3" />
                <h3 className="text-sm font-bold text-gilded-ink">No matching guests for place cards</h3>
                <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto font-sans leading-relaxed">
                  Try clearing your table filters, adding guests to your wedding plan, or loading sample data in the main dashboard!
                </p>
              </div>
            )}

            {/* LIVE GRID PREVIEW CONTAINER */}
            {sortedGuests.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-gray-500 font-mono px-1 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-600">Showing {sortedGuests.length} card{sortedGuests.length > 1 ? 's' : ''} across {totalPages} page{totalPages > 1 ? 's' : ''}</span>
                    <span className="text-gray-300">|</span>
                    <span className="text-gray-400">Font: {getFontFamilyNameLabel(fontFamily)}</span>
                  </div>

                  {/* Magnifying Controls */}
                  <div className="flex items-center gap-1.5 bg-white rounded-none border border-gilded-border p-1">
                    <button
                      onClick={() => setPreviewZoom(Math.max(50, previewZoom - 10))}
                      className="p-1 text-gray-600 hover:bg-gray-50 hover:text-gilded-accent rounded-none transition-colors cursor-pointer"
                      title="Zoom Out"
                    >
                      <ZoomOut size={13} />
                    </button>
                    <span className="text-[10px] font-bold text-gray-600 w-8 text-center select-none">
                      {previewZoom}%
                    </span>
                    <button
                      onClick={() => setPreviewZoom(Math.min(150, previewZoom + 10))}
                      className="p-1 text-gray-600 hover:bg-gray-50 hover:text-gilded-accent rounded-none transition-colors cursor-pointer"
                      title="Zoom In"
                    >
                      <ZoomIn size={13} />
                    </button>
                  </div>
                </div>

                {/* SCALED PREVIEW FRAME */}
                <div className="overflow-auto bg-slate-100 border border-gilded-border rounded-none p-6 flex flex-col items-center gap-8 shadow-inner max-h-[850px]">
                  <div
                    style={{
                      transform: `scale(${previewZoom / 100})`,
                      transformOrigin: 'top center',
                      marginBottom: `${(previewZoom / 100) * dim.h - dim.h}px`, // Adjust margin to avoid empty gap when zoomed
                    }}
                    className="flex flex-col items-center gap-8 transition-transform duration-200"
                  >
                    {Array.from({ length: totalPages }).map((_, pageIdx) => {
                      const pageGuests = sortedGuests.slice(
                        pageIdx * itemsPerPage,
                        (pageIdx + 1) * itemsPerPage
                      );

                      return (
                        <div
                          key={pageIdx}
                          style={{
                            width: `${dim.w}mm`,
                            height: `${dim.h}mm`,
                            padding: `${margin}mm`,
                          }}
                          className="bg-white border-2 border-dashed border-gilded-border rounded-none shadow-2xl relative flex flex-col justify-start"
                        >
                          {/* Page Watermark Badge */}
                          <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-gilded-faint text-gilded-accent rounded-none text-[9px] font-bold font-mono tracking-wider select-none">
                            Sheet {pageIdx + 1} of {totalPages}
                          </div>

                          {/* Cards grid */}
                          <div
                            className="grid h-full w-full"
                            style={{
                              gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
                              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                            }}
                          >
                            {Array.from({ length: itemsPerPage }).map((_, itemIdx) => {
                              const guest = pageGuests[itemIdx];

                              return (
                                <div
                                  key={itemIdx}
                                  className="relative flex flex-col justify-center items-center h-full w-full box-border"
                                  style={{
                                    border: showGuidelines ? `1px dashed ${borderColor}` : 'none',
                                    fontFamily: getFontFamilyStyle(fontFamily),
                                  }}
                                >
                                  {guest ? (
                                    cardType === 'tent' ? (
                                      // FOLDABLE TENT CARD (divided into top & bottom)
                                      <div className="w-full h-full flex flex-col">
                                        
                                        {/* Back Side (Rotated 180 degrees so when folded, both sides face up) */}
                                        <div 
                                          style={{ transform: 'rotate(180deg)', transformOrigin: 'center' }}
                                          className="h-1/2 w-full flex flex-col justify-center items-center p-1 relative border-b border-gilded-border/20 select-none"
                                        >
                                          {/* Name */}
                                          <div
                                            style={{
                                              fontSize: `${fontSize}pt`,
                                              color: fontColor,
                                              fontWeight: fontWeight === 'bold' ? 700 : fontWeight === 'medium' ? 500 : 400,
                                              textTransform: textTransform,
                                            }}
                                            className="text-center font-sans tracking-tight leading-tight px-1"
                                          >
                                            {guest.name}
                                          </div>
                                          {/* Assigned Sublabels */}
                                          {showSublabels && (
                                            <div className="text-[7.5pt] text-gray-400 mt-1 font-sans text-center truncate max-w-[90%]">
                                              {tables.find((t) => t.id === guest.tableId)?.name || 'Unassigned'}
                                            </div>
                                          )}
                                        </div>

                                        {/* Folding middle crease line */}
                                        {showFoldLines && (
                                          <div className="absolute top-1/2 left-0 w-full h-[1px] border-t border-dotted border-gilded-accent/50 z-10 pointer-events-none" />
                                        )}

                                        {/* Front Side */}
                                        <div className="h-1/2 w-full flex flex-col justify-center items-center p-1 relative">
                                          {/* Name */}
                                          <div
                                            style={{
                                              fontSize: `${fontSize}pt`,
                                              color: fontColor,
                                              fontWeight: fontWeight === 'bold' ? 700 : fontWeight === 'medium' ? 500 : 400,
                                              textTransform: textTransform,
                                            }}
                                            className="text-center font-sans tracking-tight leading-tight px-1"
                                          >
                                            {guest.name}
                                          </div>
                                          {/* Assigned Sublabels */}
                                          {showSublabels && (
                                            <div className="text-[7.5pt] text-gray-400 mt-1 font-sans text-center truncate max-w-[90%]">
                                              {tables.find((t) => t.id === guest.tableId)?.name || 'Unassigned'}
                                            </div>
                                          )}
                                        </div>

                                      </div>
                                    ) : (
                                      // FLAT PLACE CARD
                                      <div className="flex flex-col justify-center items-center p-2 w-full h-full text-center">
                                        <div
                                          style={{
                                            fontSize: `${fontSize}pt`,
                                            color: fontColor,
                                            fontWeight: fontWeight === 'bold' ? 700 : fontWeight === 'medium' ? 500 : 400,
                                            textTransform: textTransform,
                                          }}
                                          className="tracking-tight leading-tight px-1"
                                        >
                                          {guest.name}
                                        </div>

                                        {showSublabels && (
                                          <div className="text-[8pt] text-gray-400 mt-1 font-sans max-w-[90%] truncate">
                                            {(() => {
                                              const table = tables.find((t) => t.id === guest.tableId);
                                              if (!table) return 'Unassigned';
                                              const seatNum = guest.seatIndex !== null ? guest.seatIndex + 1 : null;
                                              const details = seatNum ? `${table.name} • Seat ${seatNum}` : table.name;
                                              return guest.group && guest.group !== 'Individual'
                                                ? `${details} • ${guest.group}`
                                                : details;
                                            })()}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  ) : (
                                    // EMPTY CELL GUIDELINE
                                    showGuidelines && (
                                      <span className="text-[9px] font-bold text-gray-300 font-mono select-none">
                                        Empty
                                      </span>
                                    )
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}

          </div>

        </div>
      </div>

      {/* HIDDEN PRINT WORKSPACE CONTAINER - USED STRICTLY FOR HIGH-FIDELITY HTML5 CANVAS-TO-PDF CAPTURE */}
      <div className="absolute left-[-9999px] top-0 pointer-events-none" style={{ zIndex: -100 }}>
        <div ref={printContainerRef} className="flex flex-col">
          {Array.from({ length: totalPages }).map((_, pageIdx) => {
            const pageGuests = sortedGuests.slice(
              pageIdx * itemsPerPage,
              (pageIdx + 1) * itemsPerPage
            );

            return (
              <div
                key={pageIdx}
                style={{
                  width: `${dim.w}mm`,
                  height: `${dim.h}mm`,
                  padding: `${margin}mm`,
                  boxSizing: 'border-box',
                  backgroundColor: '#ffffff',
                }}
                className="flex flex-col justify-start relative"
              >
                <div
                  className="grid h-full w-full"
                  style={{
                    gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
                    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                    boxSizing: 'border-box',
                  }}
                >
                  {Array.from({ length: itemsPerPage }).map((_, itemIdx) => {
                    const guest = pageGuests[itemIdx];

                    return (
                      <div
                        key={itemIdx}
                        className="relative flex flex-col justify-center items-center h-full w-full box-border"
                        style={{
                          border: showGuidelines ? `1px dashed ${borderColor}` : 'none',
                          fontFamily: getFontFamilyStyle(fontFamily),
                          boxSizing: 'border-box',
                        }}
                      >
                        {guest ? (
                          cardType === 'tent' ? (
                            <div className="w-full h-full flex flex-col box-border">
                              
                              {/* Back Side (Rotated 180 degrees) */}
                              <div 
                                style={{ transform: 'rotate(180deg)', transformOrigin: 'center' }}
                                className="h-1/2 w-full flex flex-col justify-center items-center p-1 relative border-b border-gray-100/40 box-border"
                              >
                                <div
                                  style={{
                                    fontSize: `${fontSize}pt`,
                                    color: fontColor,
                                    fontWeight: fontWeight === 'bold' ? 'bold' : fontWeight === 'medium' ? '500' : 'normal',
                                    textTransform: textTransform,
                                    lineHeight: '1.2',
                                  }}
                                  className="text-center font-sans tracking-tight px-1"
                                >
                                  {guest.name}
                                </div>
                                {showSublabels && (
                                  <div className="text-[7.5pt] text-gray-400 mt-1 font-sans text-center truncate max-w-[90%]">
                                    {tables.find((t) => t.id === guest.tableId)?.name || 'Unassigned'}
                                  </div>
                                )}
                              </div>

                              {/* Fold line */}
                              {showFoldLines && (
                                <div className="absolute top-1/2 left-0 w-full h-[1px] border-t border-dotted border-indigo-200 pointer-events-none" />
                              )}

                              {/* Front Side */}
                              <div className="h-1/2 w-full flex flex-col justify-center items-center p-1 relative box-border">
                                <div
                                  style={{
                                    fontSize: `${fontSize}pt`,
                                    color: fontColor,
                                    fontWeight: fontWeight === 'bold' ? 'bold' : fontWeight === 'medium' ? '500' : 'normal',
                                    textTransform: textTransform,
                                    lineHeight: '1.2',
                                  }}
                                  className="text-center font-sans tracking-tight px-1"
                                >
                                  {guest.name}
                                </div>
                                {showSublabels && (
                                  <div className="text-[7.5pt] text-gray-400 mt-1 font-sans text-center truncate max-w-[90%]">
                                    {tables.find((t) => t.id === guest.tableId)?.name || 'Unassigned'}
                                  </div>
                                )}
                              </div>

                            </div>
                          ) : (
                            <div className="flex flex-col justify-center items-center p-2 w-full h-full text-center box-border">
                              <div
                                style={{
                                  fontSize: `${fontSize}pt`,
                                  color: fontColor,
                                  fontWeight: fontWeight === 'bold' ? 'bold' : fontWeight === 'medium' ? '500' : 'normal',
                                  textTransform: textTransform,
                                  lineHeight: '1.2',
                                }}
                                className="tracking-tight px-1"
                              >
                                {guest.name}
                              </div>

                              {showSublabels && (
                                <div className="text-[8pt] text-gray-400 mt-1 font-sans max-w-[90%] truncate">
                                  {(() => {
                                    const table = tables.find((t) => t.id === guest.tableId);
                                    if (!table) return 'Unassigned';
                                    const seatNum = guest.seatIndex !== null ? guest.seatIndex + 1 : null;
                                    const details = seatNum ? `${table.name} • Seat ${seatNum}` : table.name;
                                    return guest.group && guest.group !== 'Individual'
                                      ? `${details} • ${guest.group}`
                                      : details;
                                  })()}
                                </div>
                              )}
                            </div>
                          )
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
