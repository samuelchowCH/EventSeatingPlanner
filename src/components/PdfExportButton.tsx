/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import { FileDown, Printer, LayoutGrid, Check, FileText, ListOrdered, Calendar, Tag, RefreshCw } from 'lucide-react';
import { Guest, Table, ExportLayoutType } from '../types';
import { captureElementToPng, captureElementToJpeg } from '../utils/domImageExporter';

const hexToRgb = (hex: string): [number, number, number] => {
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex.substring(0, 1).repeat(2), 16);
    const g = parseInt(cleanHex.substring(1, 2).repeat(2), 16);
    const b = parseInt(cleanHex.substring(2, 3).repeat(2), 16);
    return [isNaN(r) ? 17 : r, isNaN(g) ? 24 : g, isNaN(b) ? 39 : b];
  }
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return [isNaN(r) ? 17 : r, isNaN(g) ? 24 : g, isNaN(b) ? 39 : b];
};

interface PdfExportButtonProps {
  guests: Guest[];
  tables: Table[];
  floorPlanRef: React.RefObject<HTMLDivElement | null>;
  activeTab?: 'events' | 'floorplan' | 'tentcards' | 'designer' | 'style' | 'layout' | 'invitations';
  setActiveTab?: (tab: 'events' | 'floorplan' | 'tentcards' | 'designer' | 'style' | 'layout' | 'invitations') => void;
  exportTentCardsRef?: React.RefObject<(() => void) | null>;
  isExportingTentCards?: boolean;
  exportTentCardsProgress?: string;
}

export default function PdfExportButton({
  guests,
  tables,
  floorPlanRef,
  activeTab,
  setActiveTab,
  exportTentCardsRef,
  isExportingTentCards,
  exportTentCardsProgress,
}: PdfExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [layoutType, setLayoutType] = useState<ExportLayoutType>('floorplan');
  const [paperSize, setPaperSize] = useState<'a4' | 'letter'>('a4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('landscape');
  const [showOptionsModal, setShowOptionsModal] = useState(false);

  const triggerPDFGeneration = async () => {
    setIsExporting(true);
    let tabSwitched = false;
    const originalTab = activeTab;

    try {
      if ((layoutType === 'floorplan' || layoutType === 'jpeg-images') && activeTab !== 'floorplan' && setActiveTab) {
        setActiveTab('floorplan');
        tabSwitched = true;
        await new Promise((resolve) => setTimeout(resolve, 800));
      }

      const doc = new jsPDF({
        orientation: orientation,
        unit: 'mm',
        format: paperSize,
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      const today = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      if (layoutType === 'floorplan') {
        if (floorPlanRef.current) {
          const originalScrollTop = floorPlanRef.current.scrollTop;
          const originalScrollLeft = floorPlanRef.current.scrollLeft;
          floorPlanRef.current.scrollTop = 0;
          floorPlanRef.current.scrollLeft = 0;

          if (tables.length === 0) {
            throw new Error("No tables found in this seating plan. Please create tables first before exporting visual floor plan sheets.");
          }

          const rawElements = Array.from(floorPlanRef.current.children) as HTMLElement[];
          const tableElements = rawElements.filter((el) => {
            if (el.classList.contains('pointer-events-none')) return false;
            if (el.innerText && el.innerText.includes('No banquet tables')) return false;
            return el.offsetHeight > 80;
          });

          if (tableElements.length === 0) {
            throw new Error("No table visualizer cards are currently rendered in the floor plan view.");
          }

          for (let i = 0; i < tableElements.length; i++) {
            const tableElement = tableElements[i];
            if (i > 0) {
              doc.addPage();
            }

            let imgData = '';
            let imgWidth = 400;
            let imgHeight = 400;
            try {
              document.body.classList.add('is-exporting');
              tableElement.classList.add('is-exporting');

              const captured = await captureElementToPng(tableElement, { pixelRatio: 2 });
              imgData = captured.dataUrl;
              imgWidth = captured.width;
              imgHeight = captured.height;
            } catch (e) {
              console.error(`Could not render visual table layout for table index ${i}`, e);
              throw e;
            } finally {
              document.body.classList.remove('is-exporting');
              tableElement.classList.remove('is-exporting');
            }

            const margin = 10;
            const contentWidth = pageWidth - margin * 2;
            const contentHeight = pageHeight - margin * 2 - 20;

            const ratio = imgWidth / imgHeight;
            let renderWidth = contentWidth;
            let renderHeight = contentWidth / ratio;

            if (renderHeight > contentHeight) {
              renderHeight = contentHeight;
              renderWidth = contentHeight * ratio;
            }

            const x = (pageWidth - renderWidth) / 2;
            const y = 28 + (contentHeight - renderHeight) / 2;
            const tableMeta = tables[i] || { name: `Table ${i + 1}` };

            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(16);
            const fColorRgb = hexToRgb((tableMeta as any).fontColor || '#1f2937');
            doc.setTextColor(fColorRgb[0], fColorRgb[1], fColorRgb[2]);
            doc.text(`Visual Layout - ${tableMeta.name}`, pageWidth / 2, 12, { align: 'center' });

            doc.setFont('Helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(107, 114, 128);
            doc.text(`Generated on ${today} | Table ${i + 1} of ${tables.length}`, pageWidth / 2, 18, { align: 'center' });

            doc.setLineWidth(0.3);
            doc.setDrawColor(229, 231, 235);
            doc.line(15, 22, pageWidth - 15, 22);

            doc.addImage(imgData, 'PNG', x, y, renderWidth, renderHeight);

            doc.setFontSize(8);
            doc.setTextColor(156, 163, 175);
          }

          floorPlanRef.current.scrollTop = originalScrollTop;
          floorPlanRef.current.scrollLeft = originalScrollLeft;
        } else {
          throw new Error("Visual canvas target is not loaded.");
        }
      }

      else if (layoutType === 'jpeg-images') {
        if (floorPlanRef.current) {
          const originalScrollTop = floorPlanRef.current.scrollTop;
          const originalScrollLeft = floorPlanRef.current.scrollLeft;
          floorPlanRef.current.scrollTop = 0;
          floorPlanRef.current.scrollLeft = 0;

          if (tables.length === 0) {
            throw new Error("No tables found in this seating plan. Please create tables first before exporting visual floor plan images.");
          }

          const rawElements = Array.from(floorPlanRef.current.children) as HTMLElement[];
          const tableElements = rawElements.filter((el) => {
            if (el.classList.contains('pointer-events-none')) return false;
            if (el.innerText && el.innerText.includes('No banquet tables')) return false;
            return el.offsetHeight > 80;
          });

          if (tableElements.length === 0) {
            throw new Error("No table visualizer cards are currently rendered in the floor plan view.");
          }

          for (let i = 0; i < tableElements.length; i++) {
            const tableElement = tableElements[i];
            const tableMeta = tables[i] || { name: `Table ${i + 1}` };

            let imgData = '';
            try {
              document.body.classList.add('is-exporting');
              tableElement.classList.add('is-exporting');

              const captured = await captureElementToJpeg(tableElement, { pixelRatio: 2.5, quality: 0.95 });
              imgData = captured.dataUrl;
            } catch (e) {
              console.error(`Could not render visual table layout for table index ${i}`, e);
              throw e;
            } finally {
              document.body.classList.remove('is-exporting');
              tableElement.classList.remove('is-exporting');
            }

            const link = document.createElement('a');
            link.download = `${tableMeta.name.replace(/[\s#]+/g, '_')}_Layout.jpg`;
            link.href = imgData;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            if (i < tableElements.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, 250));
            }
          }

          // Restore scroll position
          floorPlanRef.current.scrollTop = originalScrollTop;
          floorPlanRef.current.scrollLeft = originalScrollLeft;

          setIsExporting(false);
          setShowOptionsModal(false);
          return;
        } else {
          throw new Error("Visual canvas target is not loaded.");
        }
      }

      else if (layoutType === 'table-cards') {
        // Option 2: Elegant Table Seating Cards Report (One page or section per table)
        // Set up in Portrait orientation as it's more standard for report layouts
        const tDoc = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: paperSize,
        });
        const pW = tDoc.internal.pageSize.getWidth();
        const pH = tDoc.internal.pageSize.getHeight();

        tables.forEach((table, tableIdx) => {
          if (tableIdx > 0) {
            tDoc.addPage();
          }

          const tableGuests = guests
            .filter((g) => g.tableId === table.id)
            .sort((a, b) => (a.seatIndex ?? 0) - (b.seatIndex ?? 0));

          // Draw an elegant classical border
          tDoc.setLineWidth(0.4);
          tDoc.setDrawColor(229, 231, 235); // light gray
          tDoc.rect(12, 12, pW - 24, pH - 24);
          tDoc.rect(13.5, 13.5, pW - 27, pH - 27);

          // Table Header
          tDoc.setFont('Times', 'italic');
          tDoc.setFontSize(16);
          tDoc.setTextColor(107, 114, 128);
          tDoc.text("Seating Assignments", pW / 2, 28, { align: 'center' });

          tDoc.setFont('Times', 'bold');
          tDoc.setFontSize(32);
          const fColorRgb = hexToRgb(table.fontColor || '#111827');
          tDoc.setTextColor(fColorRgb[0], fColorRgb[1], fColorRgb[2]);
          tDoc.text(table.name, pW / 2, 42, { align: 'center' });

          // Colored visual bar matching the table theme
          const tColorRgb = hexToRgb(table.color || '#4F46E5');
          tDoc.setFillColor(tColorRgb[0], tColorRgb[1], tColorRgb[2]);
          tDoc.rect(pW / 2 - 25, 48, 50, 1.5, 'F');

          tDoc.setFont('Helvetica', 'normal');
          tDoc.setFontSize(9);
          tDoc.setTextColor(156, 163, 175);
          tDoc.text(`${tableGuests.length} Guests seated | Max Capacity: ${table.maxSeats}`, pW / 2, 55, { align: 'center' });

          // Printable list of guests
          let startY = 70;
          tDoc.setFont('Helvetica', 'bold');
          tDoc.setFontSize(10);
          tDoc.setTextColor(75, 85, 99);

          // Draw table header columns
          tDoc.text("Seat", 25, startY);
          tDoc.text("Guest Name", 45, startY);
          tDoc.text("Affiliation / Group", 120, startY);

          tDoc.setLineWidth(0.2);
          tDoc.setDrawColor(209, 213, 219);
          tDoc.line(22, startY + 2, pW - 22, startY + 2);

          // List details
          let currentY = startY + 11;

          // Pre-populate empty seats too so physical hosts know of unseated chairs!
          for (let sIdx = 0; sIdx < table.maxSeats; sIdx++) {
            const guest = tableGuests.find((g) => g.seatIndex === sIdx);

            tDoc.setFont('Helvetica', 'bold');
            tDoc.setFontSize(11);
            tDoc.setTextColor(17, 24, 39);
            tDoc.text(`${sIdx + 1}`, 27, currentY);

            if (guest) {
              tDoc.setFont('Helvetica', 'bold');
              tDoc.text(guest.name, 45, currentY);

              tDoc.setFont('Helvetica', 'normal');
              tDoc.setFontSize(10);
              tDoc.setTextColor(107, 114, 128);
              tDoc.text(guest.group || 'Individual', 120, currentY);
            } else {
              tDoc.setFont('Helvetica', 'italic');
              tDoc.setTextColor(156, 163, 175);
              tDoc.text("-- Vacant Seat --", 45, currentY);
              tDoc.text("-", 120, currentY);
            }

            // Divider line
            tDoc.setDrawColor(243, 244, 246);
            tDoc.line(22, currentY + 4, pW - 22, currentY + 4);

            currentY += 12;
          }

          // Footer info on each page
          tDoc.setFont('Times', 'normal');
          tDoc.setFontSize(9);
          tDoc.setTextColor(156, 163, 175);
          tDoc.text(`Printed for ${today} event`, pW / 2, pH - 15, { align: 'center' });
        });

        // Save PDF
        tDoc.save(`Seating_Table_Sheets_${today.replace(/[\s,]+/g, '_')}.pdf`);
        setIsExporting(false);
        setShowOptionsModal(false);
        return;
      }
      else if (layoutType === 'alphabetical') {
        // Option 3: Alphabetical Guest List with assigned table numbers
        const aDoc = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: paperSize,
        });
        const pW = aDoc.internal.pageSize.getWidth();
        const pH = aDoc.internal.pageSize.getHeight();

        const sortedGuests = [...guests].sort((a, b) => a.name.localeCompare(b.name));

        // Let's do columns!
        let currentY = 32;
        let pNum = 1;

        const drawPageTemplate = (docObj: jsPDF, page: number) => {
          docObj.setFont('Times', 'italic');
          docObj.setFontSize(13);
          docObj.setTextColor(107, 114, 128);
          docObj.text("Event Check-In Directory", pW / 2, 14, { align: 'center' });

          docObj.setFont('Helvetica', 'bold');
          docObj.setFontSize(22);
          docObj.setTextColor(17, 24, 39);
          docObj.text("Alphabetical Seating Finder", pW / 2, 23, { align: 'center' });

          docObj.setLineWidth(0.5);
          docObj.setDrawColor(31, 41, 55);
          docObj.line(15, 27, pW - 15, 27);

          // Footer
          docObj.setFont('Helvetica', 'normal');
          docObj.setFontSize(8);
          docObj.setTextColor(156, 163, 175);
          docObj.text(`Page ${page} | Printed on ${today}`, pW - 15, pH - 10, { align: 'right' });
          docObj.text("Round Table Seating Planner Dashboard", 15, pH - 10);
        };

        drawPageTemplate(aDoc, pNum);

        // Columns layout parameters
        const columnWidth = (pW - 30 - 6) / 2; // 2 columns with 6mm gap
        const col1X = 15;
        const col2X = 15 + columnWidth + 6;

        let col = 1;
        let lastLetter = '';

        sortedGuests.forEach((guest, index) => {
          const firstLetter = guest.name.charAt(0).toUpperCase();

          // If letter shifts, print a category header
          const letterHeaderRequired = firstLetter !== lastLetter;
          const safetyMargin = letterHeaderRequired ? 16 : 8;

          // Check for page overflow
          if (currentY + safetyMargin > pH - 18) {
            if (col === 1) {
              // Move to second column
              col = 2;
              currentY = 32;
            } else {
              // Create a new page
              aDoc.addPage();
              pNum++;
              drawPageTemplate(aDoc, pNum);
              col = 1;
              currentY = 32;
              lastLetter = ''; // force redraw letter header if splitting
            }
          }

          const targetX = col === 1 ? col1X : col2X;

          if (firstLetter !== lastLetter) {
            currentY += 2;
            aDoc.setFont('Helvetica', 'bold');
            aDoc.setFontSize(13);
            aDoc.setTextColor(79, 70, 229); // Indigo
            aDoc.text(firstLetter, targetX, currentY);

            aDoc.setLineWidth(0.2);
            aDoc.setDrawColor(199, 210, 254);
            aDoc.line(targetX, currentY + 1.5, targetX + columnWidth, currentY + 1.5);

            currentY += 7;
            lastLetter = firstLetter;
          }

          // Guest Text
          aDoc.setFont('Helvetica', 'bold');
          aDoc.setFontSize(10.5);
          aDoc.setTextColor(17, 24, 39);

          // Truncate name dynamically only if it's too long for the column space
          let displayName = guest.name;
          if (aDoc.getTextWidth(displayName) > columnWidth - 32) {
            while (displayName.length > 3 && aDoc.getTextWidth(displayName + '...') > columnWidth - 32) {
              displayName = displayName.substring(0, displayName.length - 1);
            }
            displayName += '...';
          }
          aDoc.text(displayName, targetX, currentY);

          // Table assigned text
          aDoc.setFont('Helvetica', 'normal');
          aDoc.setFontSize(9.5);
          aDoc.setTextColor(75, 85, 99);
          const tableAssigned = tables.find(t => t.id === guest.tableId);
          const assignText = tableAssigned
            ? `${tableAssigned.name} (S${Number(guest.seatIndex ?? 0) + 1})`
            : "UNASSIGNED";

          aDoc.setFont('Helvetica', tableAssigned ? 'bold' : 'italic');
          aDoc.setTextColor(tableAssigned ? 55 : 185, tableAssigned ? 65 : 28, tableAssigned ? 81 : 28);
          aDoc.text(assignText, targetX + columnWidth - 30, currentY, { align: 'right' });

          // Subtext for group
          if (guest.group && guest.group !== 'Individual') {
            currentY += 4;
            aDoc.setFont('Helvetica', 'italic');
            aDoc.setFontSize(8.5);
            aDoc.setTextColor(156, 163, 175);
            aDoc.text(guest.group, targetX, currentY);
          }

          // Row spacing
          currentY += 6;
        });

        aDoc.save(`Seating_Guest_Directory_${today.replace(/[\s,]+/g, '_')}.pdf`);
        setIsExporting(false);
        setShowOptionsModal(false);
        return;
      }



      // Finish export & Save
      doc.save(`Seating_Plan_${layoutType}_${today.replace(/[\s,]+/g, '_')}.pdf`);
      setIsExporting(false);
      setShowOptionsModal(false);
    } catch (err: any) {
      console.error('[PdfExportButton Error]:', err);
      const errMsg = err?.message || 'Error printing PDF. Try exporting tables individually or matching simpler browser layout.';
      alert(`PDF Export Failed: ${errMsg}`);
      setIsExporting(false);
    } finally {
      if (tabSwitched && setActiveTab && originalTab) {
        setActiveTab(originalTab);
      }
    }
  };

  return (
    <div>
      <button
        onClick={() => {
          if (activeTab === 'tentcards') {
            if (exportTentCardsRef && exportTentCardsRef.current) {
              exportTentCardsRef.current();
            }
          } else {
            setShowOptionsModal(true);
          }
        }}
        disabled={(activeTab === 'tentcards' ? isExportingTentCards : isExporting) || guests.length === 0}
        className="inline-flex items-center gap-1.5 px-4.5 py-2.5 bg-gilded-ink border border-gilded-ink text-white font-mono uppercase tracking-widest hover:bg-gilded-accent transition-colors cursor-pointer select-none text-xs rounded-none"
      >
        {activeTab === 'tentcards' && isExportingTentCards ? (
          <RefreshCw size={16} className="animate-spin" />
        ) : (
          <Printer size={16} />
        )}
        <span>
          {activeTab === 'tentcards'
            ? (isExportingTentCards ? (exportTentCardsProgress || 'Exporting...') : 'Export')
            : (isExporting ? 'Exporting...' : 'Export')}
        </span>
      </button>

      {showOptionsModal && (
        <div className="fixed inset-0 bg-gilded-ink/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-[#FAF7F2] border-2 border-gilded-accent shadow-2xl p-6 max-w-md w-full relative">

            <button
              onClick={() => setShowOptionsModal(false)}
              className="absolute top-4 right-4 text-gilded-ink hover:text-gilded-accent p-1 cursor-pointer"
            >
              ✕
            </button>

            <h3 className="text-xl font-serif font-medium text-gilded-ink mb-1 tracking-wide">
              Print Seating Documents
            </h3>
            <p className="text-[10px] text-gilded-ink/50 font-mono uppercase tracking-wider mb-5">
              Choose your professional printable export format
            </p>

            <div className="space-y-3.5">
              {/* Layout Formats Choices */}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1 border border-gilded-border p-1.5 bg-gilded-bg/50">
                <label className="block text-[10px] font-semibold text-gilded-ink/60 uppercase tracking-widest font-mono mb-1 px-1">
                  Document Style
                </label>

                {/* Style 1: Visual Floorplan */}
                <div
                  onClick={() => {
                    setLayoutType('floorplan');
                    setOrientation('landscape');
                  }}
                  className={`flex items-start gap-3 p-3 border cursor-pointer select-none transition-all ${layoutType === 'floorplan'
                      ? 'border-gilded-accent bg-white text-gilded-ink shadow-sm'
                      : 'border-gilded-border hover:border-gilded-accent/40 text-gilded-ink bg-white/70'
                    }`}
                >
                  <div className="p-2 bg-gilded-bg border border-gilded-border shrink-0 text-gilded-accent">
                    <LayoutGrid size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold font-sans">Visual Floorplan Sheet</h4>
                    <p className="text-[10px] text-gilded-ink/70 mt-0.5 leading-relaxed font-sans">
                      A visual diagram showing all round tables placed side-by-side. Best for event organizers, decorators, and venue layout positioning.
                    </p>
                  </div>
                </div>

                {/* Style 2: Table Cards Sheets */}
                <div
                  onClick={() => {
                    setLayoutType('table-cards');
                    setOrientation('portrait');
                  }}
                  className={`flex items-start gap-3 p-3 border cursor-pointer select-none transition-all ${layoutType === 'table-cards'
                      ? 'border-gilded-accent bg-white text-gilded-ink shadow-sm'
                      : 'border-gilded-border hover:border-gilded-accent/40 text-gilded-ink bg-white/70'
                    }`}
                >
                  <div className="p-2 bg-gilded-bg border border-gilded-border shrink-0 text-gilded-accent">
                    <ListOrdered size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold font-sans">Specific Table Guides</h4>
                    <p className="text-[10px] text-gilded-ink/70 mt-0.5 leading-relaxed font-sans">
                      A multi-page clean classical booklet (one page per table) listing guest names at each seat number. Ideal for stands or table place cards!
                    </p>
                  </div>
                </div>

                {/* Style 3: Alphabetical Guest Matrix */}
                <div
                  onClick={() => {
                    setLayoutType('alphabetical');
                    setOrientation('portrait');
                  }}
                  className={`flex items-start gap-3 p-3 border cursor-pointer select-none transition-all ${layoutType === 'alphabetical'
                      ? 'border-gilded-accent bg-white text-gilded-ink shadow-sm'
                      : 'border-gilded-border hover:border-gilded-accent/40 text-gilded-ink bg-white/70'
                    }`}
                >
                  <div className="p-2 bg-gilded-bg border border-gilded-border shrink-0 text-gilded-accent">
                    <FileText size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold font-sans">A-Z Guest Master List</h4>
                    <p className="text-[10px] text-gilded-ink/70 mt-0.5 leading-relaxed font-sans">
                      An alphabetical sorting of all guests listing their designated table number. Essential check-in manifest for entrance greeting hosts!
                    </p>
                  </div>
                </div>

                {/* Style 4: Export as JPEGs */}
                <div
                  onClick={() => {
                    setLayoutType('jpeg-images');
                  }}
                  className={`flex items-start gap-3 p-3 border cursor-pointer select-none transition-all ${layoutType === 'jpeg-images'
                      ? 'border-gilded-accent bg-white text-gilded-ink shadow-sm'
                      : 'border-gilded-border hover:border-gilded-accent/40 text-gilded-ink bg-white/70'
                    }`}
                >
                  <div className="p-2 bg-gilded-bg border border-gilded-border shrink-0 text-gilded-accent">
                    <Calendar size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold font-sans">Export as High-Res JPEGs</h4>
                    <p className="text-[10px] text-gilded-ink/70 mt-0.5 leading-relaxed font-sans">
                      Download each table layout diagram as a dedicated, ultra-sharp JPEG image file. Fixes multi-page cropping and is perfect for sharing on chat or printing separately!
                    </p>
                  </div>
                </div>
              </div>

              {/* Advanced Paper Formats selections */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[10px] font-semibold text-gilded-ink/50 uppercase tracking-wider font-mono mb-1">
                    Paper Standard
                  </label>
                  <select
                    value={paperSize}
                    onChange={(e) => setPaperSize(e.target.value as 'a4' | 'letter')}
                    className="w-full text-xs font-sans bg-white border border-gilded-border p-2 focus:ring-1 focus:ring-gilded-accent focus:border-gilded-accent outline-hidden"
                  >
                    <option value="a4">A4 International</option>
                    <option value="letter">US Letter Standard</option>
                  </select>
                </div>

                {layoutType === 'floorplan' && (
                  <div>
                    <label className="block text-[10px] font-semibold text-gilded-ink/50 uppercase tracking-wider font-mono mb-1">
                      Render Orientation
                    </label>
                    <select
                      value={orientation}
                      onChange={(e) => setOrientation(e.target.value as 'portrait' | 'landscape')}
                      className="w-full text-xs font-sans bg-white border border-gilded-border p-2 focus:ring-1 focus:ring-gilded-accent focus:border-gilded-accent outline-hidden"
                    >
                      <option value="landscape">Landscape (Best for wide plans)</option>
                      <option value="portrait">Portrait</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-6 pt-4 border-t border-gilded-border flex items-center justify-end gap-2.5">
              <button
                onClick={() => setShowOptionsModal(false)}
                className="px-4 py-2 border border-gilded-border text-gilded-ink/60 font-mono text-xs uppercase tracking-wider hover:bg-gilded-bg"
              >
                Cancel
              </button>
              <button
                onClick={triggerPDFGeneration}
                disabled={guests.length === 0 || isExporting}
                className="px-4.5 py-2.5 bg-gilded-accent text-white text-xs font-mono uppercase tracking-widest hover:bg-gilded-accent/90 hover:shadow-xs transition-all disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
              >
                <FileDown size={14} />
                <span>
                  {isExporting
                    ? (layoutType === 'jpeg-images' ? 'Downloading...' : 'Generating...')
                    : (layoutType === 'jpeg-images' ? 'Download JPEGs' : 'Download PDF')}
                </span>
              </button>
            </div>

            {guests.length === 0 && (
              <p className="text-[10px] font-mono text-center text-red-600 mt-2 bg-red-50 py-1 border border-red-100">
                You must import or add guests first before exporting.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
