/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Settings, Trash2, XCircle, Users, Check, HelpCircle, Utensils, Move, RefreshCw } from 'lucide-react';
import { Guest, Table } from '../types';

interface TableVisualizerProps {
  table: Table;
  guests: Guest[];
  unassignedGuests: Guest[];
  selectedGuestForMoving: Guest | null;
  onSelectGuestForMoving: (guest: Guest | null) => void;
  onSeatGuest: (guestId: string, tableId: string, seatIndex: number) => void;
  onUnseatGuest: (guestId: string) => void;
  onSwapGuests: (guestAId: string, guestBId: string) => void;
  onUpdateTable: (tableId: string, updates: Partial<Table>) => void;
  onDeleteTable: (tableId: string) => void;
  onUpdateGuest: (guestId: string, updates: Partial<Guest>) => void;
  onClearTableGuests: (tableId: string) => void;
  onResetTableGuestPositions: (tableId: string) => void;
  onBatchApplySettings?: (sourceTableId: string, settings: Partial<Table>) => void;
}

export default function TableVisualizer({
  table,
  guests,
  unassignedGuests,
  selectedGuestForMoving,
  onSelectGuestForMoving,
  onSeatGuest,
  onUnseatGuest,
  onSwapGuests,
  onUpdateTable,
  onDeleteTable,
  onUpdateGuest,
  onClearTableGuests,
  onResetTableGuestPositions,
  onBatchApplySettings,
}: TableVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(600);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect) {
          setContainerWidth(Math.floor(entry.contentRect.width));
        }
      }
    });

    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
    };
  }, []);

  const [showOptions, setShowOptions] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'clear' | 'reset' | 'delete' | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(table.name);
  const [editCapacity, setEditCapacity] = useState(table.maxSeats);
  const [editColor, setEditColor] = useState(table.color);
  const [editShape, setEditShape] = useState<'round' | 'rectangle' | 'square' | 'banquet' | 'banana' | 'nano' | 'custom' | 'seminar'>(table.shape || 'round');
  const [editFontColor, setEditFontColor] = useState(table.fontColor || '#1e293b');
  const [editFontSize, setEditFontSize] = useState(table.fontSize || 16);
  const [editScale, setEditScale] = useState(table.scale || 1.0);
  const [editSeminarRows, setEditSeminarRows] = useState(table.seminarRows || 4);
  const [editSeminarSeatsPerRow, setEditSeminarSeatsPerRow] = useState(table.seminarSeatsPerRow || 8);
  const [editSeminarDirection, setEditSeminarDirection] = useState<'Top' | 'Bottom' | 'Left' | 'Right'>(table.seminarDirection || 'Top');
  const [editGridCellSize, setEditGridCellSize] = useState(table.gridCellSize || 64);
  const [editShowSeatNumbers, setEditShowSeatNumbers] = useState(table.showSeatNumbers !== false);
  const [showQuickSelectIndex, setShowQuickSelectIndex] = useState<number | null>(null);

  const [isFineTuning, setIsFineTuning] = useState(false);
  const [localDragOffsets, setLocalDragOffsets] = useState<Record<string, { x: number; y: number }>>({});

  const handleGuestMouseDown = (e: React.MouseEvent, guestId: string, currentOffsetX = 0, currentOffsetY = 0) => {
    if (!isFineTuning) return;
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      setLocalDragOffsets(prev => ({
        ...prev,
        [guestId]: {
          x: currentOffsetX + dx,
          y: currentOffsetY + dy
        }
      }));
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      const finalDx = upEvent.clientX - startX;
      const finalDy = upEvent.clientY - startY;
      const finalX = currentOffsetX + finalDx;
      const finalY = currentOffsetY + finalDy;

      onUpdateGuest(guestId, { offsetX: finalX, offsetY: finalY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleGuestTouchStart = (e: React.TouchEvent, guestId: string, currentOffsetX = 0, currentOffsetY = 0) => {
    if (!isFineTuning) return;
    e.stopPropagation();

    const touch = e.touches[0];
    const startX = touch.clientX;
    const startY = touch.clientY;

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (moveEvent.touches.length === 0) return;
      const currentTouch = moveEvent.touches[0];
      const dx = currentTouch.clientX - startX;
      const dy = currentTouch.clientY - startY;

      setLocalDragOffsets(prev => ({
        ...prev,
        [guestId]: {
          x: currentOffsetX + dx,
          y: currentOffsetY + dy
        }
      }));
    };

    const handleTouchEnd = () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);

      setLocalDragOffsets(prev => {
        const finalOffset = prev[guestId] || { x: currentOffsetX, y: currentOffsetY };
        onUpdateGuest(guestId, { offsetX: finalOffset.x, offsetY: finalOffset.y });
        return prev;
      });
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);
  };

  const [localNameOffset, setLocalNameOffset] = useState<{ x: number; y: number } | null>(null);
  const [localPodiumOffset, setLocalPodiumOffset] = useState<{ x: number; y: number } | null>(null);

  const handleNameMouseDown = (e: React.MouseEvent) => {
    if (!isFineTuning) return;
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const currentOffsetX = table.nameOffsetX || 0;
    const currentOffsetY = table.nameOffsetY || 0;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      setLocalNameOffset({
        x: currentOffsetX + dx,
        y: currentOffsetY + dy
      });
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      const finalDx = upEvent.clientX - startX;
      const finalDy = upEvent.clientY - startY;
      const finalX = currentOffsetX + finalDx;
      const finalY = currentOffsetY + finalDy;

      onUpdateTable(table.id, { nameOffsetX: finalX, nameOffsetY: finalY });
      setLocalNameOffset(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleNameTouchStart = (e: React.TouchEvent) => {
    if (!isFineTuning) return;
    e.stopPropagation();

    const touch = e.touches[0];
    const startX = touch.clientX;
    const startY = touch.clientY;
    const currentOffsetX = table.nameOffsetX || 0;
    const currentOffsetY = table.nameOffsetY || 0;

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (moveEvent.touches.length === 0) return;
      const currentTouch = moveEvent.touches[0];
      const dx = currentTouch.clientX - startX;
      const dy = currentTouch.clientY - startY;
      setLocalNameOffset({
        x: currentOffsetX + dx,
        y: currentOffsetY + dy
      });
    };

    const handleTouchEnd = () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);

      setLocalNameOffset(prev => {
        const finalOffset = prev || { x: currentOffsetX, y: currentOffsetY };
        onUpdateTable(table.id, { nameOffsetX: finalOffset.x, nameOffsetY: finalOffset.y });
        return null;
      });
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);
  };

  const handlePodiumMouseDown = (e: React.MouseEvent) => {
    if (!isFineTuning) return;
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const currentOffsetX = table.podiumOffsetX || 0;
    const currentOffsetY = table.podiumOffsetY || 0;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      setLocalPodiumOffset({
        x: currentOffsetX + dx,
        y: currentOffsetY + dy
      });
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      const finalDx = upEvent.clientX - startX;
      const finalDy = upEvent.clientY - startY;
      const finalX = currentOffsetX + finalDx;
      const finalY = currentOffsetY + finalDy;

      onUpdateTable(table.id, { podiumOffsetX: finalX, podiumOffsetY: finalY });
      setLocalPodiumOffset(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handlePodiumTouchStart = (e: React.TouchEvent) => {
    if (!isFineTuning) return;
    e.stopPropagation();

    const touch = e.touches[0];
    const startX = touch.clientX;
    const startY = touch.clientY;
    const currentOffsetX = table.podiumOffsetX || 0;
    const currentOffsetY = table.podiumOffsetY || 0;

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (moveEvent.touches.length === 0) return;
      const currentTouch = moveEvent.touches[0];
      const dx = currentTouch.clientX - startX;
      const dy = currentTouch.clientY - startY;
      setLocalPodiumOffset({
        x: currentOffsetX + dx,
        y: currentOffsetY + dy
      });
    };

    const handleTouchEnd = () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);

      setLocalPodiumOffset(prev => {
        const finalOffset = prev || { x: currentOffsetX, y: currentOffsetY };
        onUpdateTable(table.id, { podiumOffsetX: finalOffset.x, podiumOffsetY: finalOffset.y });
        return null;
      });
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);
  };

  // Filter guests seated at this specific table
  const tableGuests = guests.filter((g) => g.tableId === table.id);

  // Group by seat position (key is seatIndex)
  const seatMap = new Map<number, Guest>();
  tableGuests.forEach((g) => {
    if (g.seatIndex !== null) {
      seatMap.set(g.seatIndex, g);
    }
  });

  // Calculate coordinates dynamically based on seat capacity and shape
  const maxSeats = table.maxSeats;
  const shape = table.shape || 'round';

  // Base circular parameters
  const baseRadius = 65 + Math.max(0, (maxSeats - 6) * 5); // 65px base radius for 6-seater, grows larger

  // Shape specific parameters
  const baseRectW = 110 + Math.max(0, (maxSeats - 6) * 15);
  const baseRectH = 75;

  const baseSqSize = 85 + Math.max(0, (maxSeats - 4) * 15);

  const baseBanquetW = 150 + Math.max(0, (maxSeats - 8) * 20);
  const baseBanquetH = 65;

  // Let the container be square, uniform and beautifully scaled at 350px so they occupy a much more optimal portion of the card
  const calculatedBoxSize = 350;
  const tempBoxSize = 350;
  const margin = 8;

  let dynamicScale = 1;
  if (shape !== 'custom') {
    let wOuter = baseRadius * 2;
    let hOuter = baseRadius * 2;

    if (shape === 'rectangle') {
      wOuter = baseRectW + 40;
      hOuter = baseRectH + 40;
    } else if (shape === 'square') {
      wOuter = baseSqSize + 40;
      hOuter = baseSqSize + 40;
    } else if (shape === 'banquet') {
      wOuter = baseBanquetW + 40;
      hOuter = baseBanquetH + 40;
    } else if (shape === 'banana') {
      wOuter = baseRadius * 2 * 1.3 + 40;
      hOuter = baseRadius * 2 * 0.9 + 40;
    } else if (shape === 'nano') {
      wOuter = baseRadius * 2 * 1.4 + 40;
      hOuter = baseRadius * 2 * 0.9 + 40;
    }

    // Precise mathematical boundary padding to ensure names (140px wide, 32px high) never overflow
    const maxWAllowed = tempBoxSize - 2 * margin - 140; // 140px for full width of guest name tag
    const maxHAllowed = tempBoxSize - 2 * margin - 32;  // 32px for full height of guest name tag

    const scaleW = maxWAllowed / wOuter;
    const scaleH = maxHAllowed / hOuter;

    dynamicScale = Math.min(1.2, scaleW, scaleH);
    if (shape === 'round') {
      // For round table, cap the radius to ensure it is proportional but beautifully large
      dynamicScale = Math.min(1.2, 95 / baseRadius);
    }
  }

  // Final scaled parameters
  const radius = baseRadius * dynamicScale;
  const rectW = baseRectW * dynamicScale;
  const rectH = baseRectH * dynamicScale;
  const sqSize = baseSqSize * dynamicScale;
  const banquetW = baseBanquetW * dynamicScale;
  const banquetH = baseBanquetH * dynamicScale;

  const renderCustomTableShape = () => {
    const cShape = table.customShape || 'Circle';
    const cWidth = table.customWidth || 180;
    const cHeight = table.customHeight || 120;
    const cRadius = table.customRadius || 90;
    const cSides = table.customSides || 6;
    const strokeColor = table.color || '#4F46E5';
    const strokeWidth = (table as any).strokeWidth || 2.5;
    const fillColor = (table as any).fillColor || `${strokeColor}0D`; // 5% opacity background

    const strokeProps = {
      stroke: strokeColor,
      strokeWidth,
      fill: fillColor,
      className: 'transition-all duration-300'
    };

    if (cShape === 'Circle') {
      return <circle cx={200} cy={200} r={cRadius} {...strokeProps} />;
    }

    if (cShape === 'Square') {
      return (
        <rect
          x={200 - cWidth / 2}
          y={200 - cWidth / 2}
          width={cWidth}
          height={cWidth}
          rx={16}
          {...strokeProps}
        />
      );
    }

    if (cShape === 'Rectangle') {
      return (
        <rect
          x={200 - cWidth / 2}
          y={200 - cHeight / 2}
          width={cWidth}
          height={cHeight}
          rx={16}
          {...strokeProps}
        />
      );
    }

    if (cShape === 'Oval') {
      return (
        <ellipse
          cx={200}
          cy={200}
          rx={cWidth / 2}
          ry={cHeight / 2}
          {...strokeProps}
        />
      );
    }

    if (cShape === 'Semi-circle') {
      const d = `M ${200 - cRadius} ${200 + 20} A ${cRadius} ${cRadius} 0 0 1 ${200 + cRadius} ${200 + 20} Z`;
      return <path d={d} {...strokeProps} />;
    }

    if (cShape === 'Quarter circle') {
      const d = `M ${200 - 50} ${200 + cRadius - 50} A ${cRadius} ${cRadius} 0 0 1 ${200 - 50 + cRadius} ${200 - 50} L ${200 - 50} ${200 - 50} Z`;
      return <path d={d} {...strokeProps} />;
    }

    if (cShape === 'Polygon') {
      const pts: string[] = [];
      for (let i = 0; i < cSides; i++) {
        const angle = (i * 2 * Math.PI) / cSides - Math.PI / 2;
        const px = 200 + cRadius * Math.cos(angle);
        const py = 200 + cRadius * Math.sin(angle);
        pts.push(`${px},${py}`);
      }
      return <polygon points={pts.join(' ')} {...strokeProps} />;
    }

    if (cShape === 'Long Banquet') {
      return (
        <rect
          x={200 - cWidth / 2}
          y={200 - cHeight / 2}
          width={cWidth}
          height={cHeight}
          rx={8}
          {...strokeProps}
        />
      );
    }

    return null;
  };

  const boxSize = calculatedBoxSize;
  const center = boxSize / 2;
  const tableScale = table.scale || 1.0;

  // Compute dynamic scale for custom template shapes to keep seats within the bounds of card
  let customScale = 0.55;
  if (shape === 'custom') {
    const centerVal = boxSize / 2;
    const margin = 8;
    const W_c = 140; // Max chair width (guest name tag width)
    const H_c = 40;  // Max chair height

    let maxAllowedScale = 0.55;

    (table.customSeats || []).forEach(s => {
      // Constraints on x
      if (s.x > 200) {
        const limit = (boxSize - margin - centerVal - W_c / 2) / (s.x - 200);
        if (limit > 0 && limit < maxAllowedScale) {
          maxAllowedScale = limit;
        }
      } else if (s.x < 200) {
        const limit = (centerVal - W_c / 2 - margin) / (200 - s.x);
        if (limit > 0 && limit < maxAllowedScale) {
          maxAllowedScale = limit;
        }
      }

      // Constraints on y
      if (s.y > 200) {
        const limit = (boxSize - margin - centerVal - H_c / 2) / (s.y - 200);
        if (limit > 0 && limit < maxAllowedScale) {
          maxAllowedScale = limit;
        }
      } else if (s.y < 200) {
        const limit = (centerVal - H_c / 2 - margin) / (200 - s.y);
        if (limit > 0 && limit < maxAllowedScale) {
          maxAllowedScale = limit;
        }
      }
    });

    customScale = Math.max(0.15, maxAllowedScale) * tableScale;
  }

  const getSeatCoords = (index: number) => {
    if (shape === 'seminar') {
      const rows = table.seminarRows || 3;
      const seatsPerRow = table.seminarSeatsPerRow || 6;
      const dir = table.seminarDirection || 'Top';

      const rowIdx = Math.floor(index / seatsPerRow);
      const seatIdxInRow = index % seatsPerRow;

      const gridW = 270 * tableScale;
      const gridH = 190 * tableScale;
      const startX = center - gridW / 2;
      const startY = center - gridH / 2;

      let x = 0;
      let y = 0;

      if (dir === 'Top') {
        const xSpacing = seatsPerRow > 1 ? gridW / (seatsPerRow - 1) : 0;
        x = startX + seatIdxInRow * xSpacing;
        const ySpacing = rows > 1 ? (gridH - 60) / (rows - 1) : 0;
        y = (startY + 60) + rowIdx * ySpacing;
      } else if (dir === 'Bottom') {
        const xSpacing = seatsPerRow > 1 ? gridW / (seatsPerRow - 1) : 0;
        x = startX + seatIdxInRow * xSpacing;
        const ySpacing = rows > 1 ? (gridH - 60) / (rows - 1) : 0;
        y = startY + (rows - 1 - rowIdx) * ySpacing;
      } else if (dir === 'Left') {
        const xSpacing = rows > 1 ? (gridW - 60) / (rows - 1) : 0;
        x = (startX + 60) + rowIdx * xSpacing;
        const ySpacing = seatsPerRow > 1 ? gridH / (seatsPerRow - 1) : 0;
        y = startY + seatIdxInRow * ySpacing;
      } else { // 'Right'
        const xSpacing = rows > 1 ? (gridW - 60) / (rows - 1) : 0;
        x = startX + (rows - 1 - rowIdx) * xSpacing;
        const ySpacing = seatsPerRow > 1 ? gridH / (seatsPerRow - 1) : 0;
        y = startY + seatIdxInRow * ySpacing;
      }

      return { x, y };
    }

    if (shape === 'custom') {
      const s = table.customSeats?.[index] || { x: 200, y: 200 };
      return {
        x: center + customScale * (s.x - 200),
        y: center + customScale * (s.y - 200)
      };
    }

    if (shape === 'banana') {
      const startAngle = -Math.PI * 1.1; // slight wrap-around
      const endAngle = Math.PI * 0.1;
      const angle = startAngle + (index / (maxSeats - 1)) * (endAngle - startAngle);
      const x = center + (radius * 1.25 * tableScale + radius * 1.25 * 0.15) * Math.cos(angle);
      const y = center + (radius * 0.85 * tableScale + radius * 0.85 * 0.15) * Math.sin(angle) + 15;
      return { x, y };
    }

    if (shape === 'nano') {
      const angle = (index * 2 * Math.PI) / maxSeats - Math.PI / 2;
      const x = center + (radius * 1.4 * tableScale + radius * 1.4 * 0.15) * Math.cos(angle);
      const y = center + (radius * 0.85 * tableScale + radius * 0.85 * 0.15) * Math.sin(angle);
      return { x, y };
    }

    if (shape === 'round') {
      // 0-th seat is at the top (12 o'clock), rotating clockwise
      const angle = (index * 2 * Math.PI) / maxSeats - Math.PI / 2;
      // Fixed distance from table shape boundary: (radius * 0.625 * tableScale) + constant_gap
      // The constant_gap when tableScale = 1.0 is radius * 0.375.
      const seatDistance = (radius * 0.625 * tableScale) + (radius * 0.375);
      const x = center + seatDistance * Math.cos(angle);
      const y = center + seatDistance * Math.sin(angle);
      return { x, y };
    }

    // For rectangle, square, and banquet: distribute along outer perimeter
    let currentW = rectW * tableScale;
    let currentH = rectH * tableScale;
    if (shape === 'square') {
      currentW = sqSize * tableScale;
      currentH = sqSize * tableScale;
    } else if (shape === 'banquet') {
      currentW = banquetW * tableScale;
      currentH = banquetH * tableScale;
    }

    const pad = 24 * dynamicScale; // distance from center element edge to seat center (maintained constant)
    const wOuter = currentW + pad * 2;
    const hOuter = currentH + pad * 2;
    const P = 2 * wOuter + 2 * hOuter;

    // Distribute indices evenly along perimeter, starting from the middle of the top edge
    let d = (index * P) / maxSeats;
    d = (d + wOuter / 2) % P;

    let xRel = 0;
    let yRel = 0;

    if (d < wOuter) {
      // Top edge
      xRel = d;
      yRel = 0;
    } else if (d < wOuter + hOuter) {
      // Right edge
      xRel = wOuter;
      yRel = d - wOuter;
    } else if (d < 2 * wOuter + hOuter) {
      // Bottom edge
      xRel = wOuter - (d - wOuter - hOuter);
      yRel = hOuter;
    } else {
      // Left edge
      xRel = 0;
      yRel = hOuter - (d - 2 * wOuter - hOuter);
    }

    return {
      x: center - wOuter / 2 + xRel,
      y: center - hOuter / 2 + yRel,
    };
  };

  const handleSeatClick = (seatIndex: number, guestAtSeat: Guest | undefined) => {
    // Case 1: We have a guest selected from the sidebar or another seat
    if (selectedGuestForMoving) {
      if (guestAtSeat) {
        // Swap them!
        onSwapGuests(selectedGuestForMoving.id, guestAtSeat.id);
      } else {
        // Seat them at this empty seat!
        onSeatGuest(selectedGuestForMoving.id, table.id, seatIndex);
      }
      onSelectGuestForMoving(null);
      setShowQuickSelectIndex(null);
    }
    // Case 2: No active guest selection, but we clicked a seat
    else {
      if (guestAtSeat) {
        // Select this guest to move or swap
        onSelectGuestForMoving(guestAtSeat);
      } else {
        // Open quick selection popup for empty seat
        setShowQuickSelectIndex(showQuickSelectIndex === seatIndex ? null : seatIndex);
      }
    }
  };

  const handleQuickSelectGuest = (guestId: string, seatIndex: number) => {
    onSeatGuest(guestId, table.id, seatIndex);
    setShowQuickSelectIndex(null);
  };

  const handleSaveEdit = () => {
    onUpdateTable(table.id, {
      name: editName,
      maxSeats: editShape === 'seminar' ? editSeminarRows * editSeminarSeatsPerRow : Number(editCapacity),
      color: editColor,
      shape: editShape,
      fontColor: editFontColor,
      fontSize: Number(editFontSize),
      scale: editShape === 'seminar' ? 1.0 : Number(editScale),
      seminarRows: editShape === 'seminar' ? editSeminarRows : undefined,
      seminarSeatsPerRow: editShape === 'seminar' ? editSeminarSeatsPerRow : undefined,
      seminarDirection: editShape === 'seminar' ? editSeminarDirection : undefined,
      gridCellSize: editShape === 'seminar' ? editGridCellSize : undefined,
      showSeatNumbers: editShowSeatNumbers,
    });
    setIsEditing(false);
    setShowOptions(false);
  };

  const handleBatchApply = () => {
    const settings = {
      maxSeats: Number(editCapacity),
      color: editColor,
      shape: editShape,
      fontColor: editFontColor,
      fontSize: Number(editFontSize),
      scale: Number(editScale),
      showSeatNumbers: editShowSeatNumbers,
    };
    onUpdateTable(table.id, {
      name: editName,
      ...settings,
    });
    if (onBatchApplySettings) {
      onBatchApplySettings(table.id, settings);
    }
    setIsEditing(false);
    setShowOptions(false);
  };

  const colorPresets = [
    '#C9A96E', // Gilded Gold
    '#2C2C2C', // Deep Ink
    '#6B5E4F', // Warm Taupe
    '#738276', // Sage Green
    '#3E4A56', // Deep Steel
    '#8A7968', // Warm Clay
    '#A87E60', // Bronze
    '#4F46E5', // Classic Indigo
  ];

  return (
    <div
      ref={containerRef}
      className={`relative bg-white rounded-none border border-gilded-border p-6 shadow-xs hover:shadow-md transition-all flex flex-col items-center justify-between ${shape === 'seminar'
          ? 'w-full max-w-full min-h-fit md:min-h-[420px] overflow-visible py-8 px-10'
          : 'w-full max-w-2xl min-h-[420px] aspect-[297/210] overflow-hidden'
        }`}
    >

      {/* Table Header and Settings */}
      <div data-html2canvas-ignore="true" className="w-full flex items-center justify-between mb-3 border-b border-gilded-border pb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-serif font-medium text-gilded-ink tracking-tight">
            {table.name}
          </h3>
          <span data-html2canvas-ignore="true" className="inline-flex items-center justify-center text-[10px] bg-gilded-faint text-gilded-ink/80 font-mono px-2.5 py-0 h-5 rounded-none border border-gilded-border leading-none uppercase tracking-wider">
            {tableGuests.length}/{table.maxSeats} Seats
          </span>
        </div>

        <div className="flex items-center gap-1.5" data-html2canvas-ignore="true">
          <button
            onClick={() => setIsFineTuning(!isFineTuning)}
            className={`p-1 rounded-lg border transition-all cursor-pointer flex items-center justify-center ${isFineTuning
                ? 'bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100 shadow-3xs'
                : 'bg-white border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50'
              }`}
            title={isFineTuning ? "Disable fine-tuning layout" : "Enable fine-tuning layout (drag guest names directly)"}
          >
            <Move size={14} className={isFineTuning ? 'animate-pulse' : ''} />
          </button>

          <div className="relative">
            <button
              onClick={() => {
                setShowOptions(!showOptions);
                setIsEditing(false);
                setConfirmAction(null);
              }}
              className="p-1 hover:bg-gray-50 rounded-lg text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
            >
              <MoreVertical size={16} />
            </button>

            {showOptions && (
              <div className="absolute right-0 top-7 w-60 bg-white border border-gray-100 rounded-xl shadow-lg z-30 p-3 text-left max-h-[340px] overflow-y-auto scrollbar-thin">
                {!isEditing ? (
                  <div className="space-y-1.5 text-xs">
                    <button
                      onClick={() => {
                        setEditName(table.name);
                        setEditCapacity(table.maxSeats);
                        setEditColor(table.color);
                        setEditShape(table.shape || 'round');
                        setEditFontColor(table.fontColor || '#1e293b');
                        setEditFontSize(table.fontSize || 16);
                        setEditScale(table.scale || 1.0);
                        setEditSeminarRows(table.seminarRows || 4);
                        setEditSeminarSeatsPerRow(table.seminarSeatsPerRow || 8);
                        setEditSeminarDirection(table.seminarDirection || 'Top');
                        setEditGridCellSize(table.gridCellSize || 64);
                        setEditShowSeatNumbers(table.showSeatNumbers !== false);
                        setIsEditing(true);
                      }}
                      className="w-full text-left p-2 hover:bg-gray-50 rounded-lg text-gray-700 font-sans flex items-center gap-2 cursor-pointer"
                    >
                      <Settings size={14} className="text-gray-400" />
                      {table.shape === 'seminar' ? 'Edit Seating Settings' : 'Edit Table Settings'}
                    </button>

                    {confirmAction === 'clear' ? (
                      <div className="flex items-center justify-between p-1.5 bg-amber-50 rounded-lg border border-amber-100 animate-fadeIn">
                        <span className="text-[10px] text-amber-800 font-bold font-sans">Unseat all guests?</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              onClearTableGuests(table.id);
                              setConfirmAction(null);
                              setShowOptions(false);
                            }}
                            className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-[10px] font-bold cursor-pointer"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setConfirmAction(null)}
                            className="px-2 py-0.5 bg-white hover:bg-gray-100 text-gray-500 rounded border border-gray-200 text-[10px] cursor-pointer"
                          >
                            No
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmAction('clear')}
                        disabled={tableGuests.length === 0}
                        className="w-full text-left p-2 hover:bg-gray-50 rounded-lg text-gray-700 font-sans flex items-center gap-2 disabled:opacity-40 cursor-pointer"
                      >
                        <XCircle size={14} className="text-gray-400" />
                        Clear Seated Guests
                      </button>
                    )}

                    {confirmAction === 'reset' ? (
                      <div className="flex items-center justify-between p-1.5 bg-indigo-50 rounded-lg border border-indigo-100 animate-fadeIn">
                        <span className="text-[10px] text-indigo-800 font-bold font-sans">Reset layout drag?</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              onResetTableGuestPositions(table.id);
                              setLocalDragOffsets({});
                              setConfirmAction(null);
                              setShowOptions(false);
                            }}
                            className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-bold cursor-pointer"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setConfirmAction(null)}
                            className="px-2 py-0.5 bg-white hover:bg-gray-100 text-gray-500 rounded border border-gray-200 text-[10px] cursor-pointer"
                          >
                            No
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmAction('reset')}
                        disabled={tableGuests.every(g => g.offsetX === undefined && g.offsetY === undefined)}
                        className="w-full text-left p-2 hover:bg-gray-50 rounded-lg text-gray-700 font-sans flex items-center gap-2 disabled:opacity-30 cursor-pointer"
                      >
                        <RefreshCw size={14} className="text-gray-400" />
                        Reset Guest Positions
                      </button>
                    )}

                    <hr className="my-1 border-gray-50" />

                    {confirmAction === 'delete' ? (
                      <div className="flex items-center justify-between p-1.5 bg-red-50 rounded-lg border border-red-100 animate-fadeIn">
                        <span className="text-[10px] text-red-800 font-bold font-sans">Delete table?</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              onDeleteTable(table.id);
                              setConfirmAction(null);
                              setShowOptions(false);
                            }}
                            className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold cursor-pointer"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setConfirmAction(null)}
                            className="px-2 py-0.5 bg-white hover:bg-gray-100 text-gray-500 rounded border border-gray-200 text-[10px] cursor-pointer"
                          >
                            No
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmAction('delete')}
                        className="w-full text-left p-2 text-red-600 hover:bg-red-50 rounded-lg font-sans flex items-center gap-2 font-medium cursor-pointer"
                      >
                        <Trash2 size={14} />
                        Delete Table
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="p-2 space-y-3 text-xs">
                    {editShape === 'seminar' ? (
                      /* LECTURE MODE: EDIT SEATING SETTINGS */
                      <>
                        <div>
                          <label className="block text-gray-500 mb-1 font-medium">Segment Name</label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-2 py-1 focus:ring-1 focus:ring-indigo-500 text-xs font-sans"
                          />
                        </div>

                        <div className="space-y-2 p-2 bg-indigo-50/50 border border-indigo-100 rounded-lg">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] text-gray-500 mb-0.5 font-medium">Grid Rows</label>
                              <select
                                value={editSeminarRows}
                                onChange={(e) => setEditSeminarRows(Number(e.target.value))}
                                className="w-full border border-gray-200 bg-white rounded px-1.5 py-0.5 text-xs font-sans"
                              >
                                {[2, 3, 4, 5, 6, 7, 8].map(r => (
                                  <option key={r} value={r}>{r} Rows</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] text-gray-500 mb-0.5 font-medium">Seats / Row</label>
                              <select
                                value={editSeminarSeatsPerRow}
                                onChange={(e) => setEditSeminarSeatsPerRow(Number(e.target.value))}
                                className="w-full border border-gray-200 bg-white rounded px-1.5 py-0.5 text-xs font-sans"
                              >
                                {[4, 5, 6, 7, 8, 9, 10, 12, 14, 16].map(s => (
                                  <option key={s} value={s}>{s} Seats</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-0.5 font-medium">Target Stage Position</label>
                            <select
                              value={editSeminarDirection}
                              onChange={(e) => setEditSeminarDirection(e.target.value as any)}
                              className="w-full border border-gray-200 bg-white rounded px-1.5 py-0.5 text-xs font-sans"
                            >
                              <option value="Top">Stage is at Top</option>
                              <option value="Bottom">Stage is at Bottom</option>
                              <option value="Left">Stage is at Left</option>
                              <option value="Right">Stage is at Right</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-gray-500 font-medium">Grid Cell Size</label>
                            <span className="text-[10px] font-mono text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{editGridCellSize}px</span>
                          </div>
                          <input
                            type="range"
                            min="32"
                            max="120"
                            value={editGridCellSize}
                            onChange={(e) => setEditGridCellSize(Number(e.target.value))}
                            className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                          />
                        </div>

                        <div>
                          <label className="block text-gray-500 mb-1 font-medium">Color Palette</label>
                          <div className="grid grid-cols-5 gap-1.5 pt-1">
                            {colorPresets.map((c) => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => setEditColor(c)}
                                className={`w-5 h-5 rounded-full border transition-all ${editColor === c ? 'ring-2 ring-indigo-500 border-white scale-110' : 'border-gray-200'
                                  }`}
                                style={{ backgroundColor: c }}
                              />
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-gray-500 mb-1 font-medium">Font Color</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={editFontColor}
                              onChange={(e) => setEditFontColor(e.target.value)}
                              className="w-8 h-8 rounded border border-gray-200 cursor-pointer p-0 bg-transparent flex-shrink-0"
                            />
                            <input
                              type="text"
                              value={editFontColor}
                              onChange={(e) => setEditFontColor(e.target.value)}
                              className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs font-mono uppercase"
                              placeholder="#1E293B"
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-gray-500 font-medium">Font Size</label>
                            <span className="text-[10px] font-mono text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{editFontSize}px</span>
                          </div>
                          <input
                            type="range"
                            min="10"
                            max="24"
                            value={editFontSize}
                            onChange={(e) => setEditFontSize(Number(e.target.value))}
                            className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                          />
                        </div>

                        <div className="flex items-center gap-2 py-1">
                          <input
                            type="checkbox"
                            id="editShowSeatNumbersSeminar"
                            checked={editShowSeatNumbers}
                            onChange={(e) => setEditShowSeatNumbers(e.target.checked)}
                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                          />
                          <label htmlFor="editShowSeatNumbersSeminar" className="text-gray-700 font-medium select-none cursor-pointer">
                            Show seat numbers
                          </label>
                        </div>

                        <div className="flex items-center justify-end gap-1.5 pt-2">
                          <button
                            onClick={() => setIsEditing(false)}
                            className="px-2 py-1 text-gray-500 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSaveEdit}
                            className="px-2.5 py-1 text-white bg-indigo-600 font-medium rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-1"
                          >
                            <Check size={12} />
                            Save
                          </button>
                        </div>
                      </>
                    ) : (
                      /* DINING MODE: EDIT TABLE SETTINGS */
                      <>
                        <div>
                          <label className="block text-gray-500 mb-1 font-medium">Table Name</label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-2 py-1 focus:ring-1 focus:ring-indigo-500 text-xs font-sans"
                          />
                        </div>

                        <div>
                          <label className="block text-gray-500 mb-1 font-medium">Capacity (Seats)</label>
                          <select
                            value={editCapacity}
                            onChange={(e) => setEditCapacity(Number(e.target.value))}
                            className="w-full border border-gray-200 rounded-lg px-2 py-1 focus:ring-1 focus:ring-indigo-500 text-xs font-sans bg-white"
                          >
                            {[4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16].map((num) => (
                              <option key={num} value={num}>{num} Seats</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-gray-500 mb-1 font-medium">Table Shape</label>
                          <select
                            value={editShape}
                            onChange={(e) => setEditShape(e.target.value as any)}
                            className="w-full border border-gray-200 rounded-lg px-2 py-1 focus:ring-1 focus:ring-indigo-500 text-xs font-sans bg-white"
                          >
                            <option value="round">Round Table</option>
                            <option value="rectangle">Rectangle Table</option>
                            <option value="square">Square Table</option>
                            <option value="banquet">Long Banquet Table</option>
                            <option value="custom">Bespoke Custom Template</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-gray-500 mb-1 font-medium">Color Palette</label>
                          <div className="grid grid-cols-5 gap-1.5 pt-1">
                            {colorPresets.map((c) => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => setEditColor(c)}
                                className={`w-5 h-5 rounded-full border transition-all ${editColor === c ? 'ring-2 ring-indigo-500 border-white scale-110' : 'border-gray-200'
                                  }`}
                                style={{ backgroundColor: c }}
                              />
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-gray-500 mb-1 font-medium">Font Color</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={editFontColor}
                              onChange={(e) => setEditFontColor(e.target.value)}
                              className="w-8 h-8 rounded border border-gray-200 cursor-pointer p-0 bg-transparent flex-shrink-0"
                            />
                            <input
                              type="text"
                              value={editFontColor}
                              onChange={(e) => setEditFontColor(e.target.value)}
                              className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs font-mono uppercase"
                              placeholder="#1E293B"
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-gray-500 font-medium">Font Size</label>
                            <span className="text-[10px] font-mono text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{editFontSize}px</span>
                          </div>
                          <input
                            type="range"
                            min="10"
                            max="24"
                            value={editFontSize}
                            onChange={(e) => setEditFontSize(Number(e.target.value))}
                            className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-gray-500 font-medium">Table Scale</label>
                            <span className="text-[10px] font-mono text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{editScale.toFixed(1)}x</span>
                          </div>
                          <input
                            type="range"
                            min="0.5"
                            max="2.5"
                            step="0.1"
                            value={editScale}
                            onChange={(e) => setEditScale(Number(e.target.value))}
                            className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                          />
                        </div>

                        <div className="flex items-center gap-2 py-1">
                          <input
                            type="checkbox"
                            id="editShowSeatNumbersDining"
                            checked={editShowSeatNumbers}
                            onChange={(e) => setEditShowSeatNumbers(e.target.checked)}
                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                          />
                          <label htmlFor="editShowSeatNumbersDining" className="text-gray-700 font-medium select-none cursor-pointer">
                            Show seat numbers
                          </label>
                        </div>

                        <div className="flex items-center justify-end gap-1.5 pt-2">
                          <button
                            onClick={() => setIsEditing(false)}
                            className="px-2 py-1 text-gray-500 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSaveEdit}
                            className="px-2.5 py-1 text-white bg-indigo-600 font-medium rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-1"
                          >
                            <Check size={12} />
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={handleBatchApply}
                            className="px-2.5 py-1 text-white bg-emerald-600 font-medium rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-1"
                            title="Apply these style & capacity settings to all other tables"
                          >
                            <RefreshCw size={12} />
                            Batch Apply
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Circular Layout Canvas Representation */}
      <div
        className={`relative select-none print-layout-target flex items-center justify-center ${shape === 'seminar' ? 'w-full h-auto min-h-[280px] p-2' : ''
          }`}
        style={shape === 'seminar' ? {} : { width: boxSize, height: boxSize }}
      >
        {/* Center Table Element */}
        {shape === 'banana' ? (
          <>
            <svg
              className="absolute pointer-events-none overflow-visible transition-all duration-300"
              width={350}
              height={350}
              viewBox="0 0 350 350"
              style={{
                left: 0,
                top: 0,
                transform: `scale(${tableScale})`,
                transformOrigin: 'center',
              }}
            >
              <path
                d={`M ${center - radius * 1.25} ${center - 10} 
                    Q ${center} ${center + radius * 0.8} ${center + radius * 1.25} ${center - 10}
                    Q ${center} ${center + radius * 0.2} ${center - radius * 1.25} ${center - 10} Z`}
                stroke={table.color || '#4F46E5'}
                strokeWidth={2.5}
                fill={`${table.color || '#4F46E5'}0D`}
                className="transition-all duration-300"
              />
            </svg>
            <div
              className="absolute flex items-center justify-center text-center overflow-visible pointer-events-none"
              style={{
                width: 150 * tableScale,
                height: 70 * tableScale,
                left: center - (150 * tableScale) / 2,
                top: center - (70 * tableScale) / 2 + 5 * tableScale,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                className="font-bold font-sans break-words text-center leading-tight block w-full"
                style={{
                  color: table.fontColor || '#1e293b',
                  fontSize: `${(table.fontSize || 16) * Math.min(1.5, tableScale)}px`,
                  margin: 0,
                  padding: 0,
                }}
              >
                {table.name}
              </span>
            </div>
          </>
        ) : shape === 'custom' ? (
          <>
            {/* SVG Custom Table Shape */}
            <svg
              className="absolute pointer-events-none overflow-visible"
              width={400 * customScale}
              height={400 * customScale}
              style={{
                left: center - (400 * customScale) / 2,
                top: center - (400 * customScale) / 2,
                width: `${400 * customScale}px`,
                height: `${400 * customScale}px`,
              }}
              viewBox="0 0 400 400"
            >
              {renderCustomTableShape()}
            </svg>
            {/* Centered Table Details Overlay */}
            <div
              className="absolute flex items-center justify-center text-center overflow-visible pointer-events-none"
              style={{
                width: 150,
                height: 70,
                left: center - 75,
                top: (table.customShape === 'Semi-circle' ? center + customScale * 20 : table.customShape === 'Quarter circle' ? center - customScale * 20 : center) - 35,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                className="font-bold font-sans break-words text-center leading-tight block w-full"
                style={{
                  color: table.fontColor || '#1e293b',
                  fontSize: `${table.fontSize || 16}px`,
                  margin: 0,
                  padding: 0,
                }}
              >
                {table.name}
              </span>
            </div>
          </>
        ) : shape === 'seminar' ? (
          <>
            {/* Unified Academic Grid Table representation */}
            {(() => {
              const rows = table.seminarRows || 3;
              const seatsPerRow = table.seminarSeatsPerRow || 6;
              const dir = table.seminarDirection || 'Top';

              const nameX = (localNameOffset?.x ?? table.nameOffsetX ?? 0);
              const nameY = (localNameOffset?.y ?? table.nameOffsetY ?? 0);
              const podiumX = (localPodiumOffset?.x ?? table.podiumOffsetX ?? 0);
              const podiumY = (localPodiumOffset?.y ?? table.podiumOffsetY ?? 0);

              // 1. Find the longest word length and longest name length
              const longestNameLength = tableGuests.length > 0
                ? Math.max(...tableGuests.map(g => g.name.length))
                : 8;

              const longestWordLength = tableGuests.length > 0
                ? Math.max(...tableGuests.flatMap(g => g.name.split(/\s+/).map(w => w.length)))
                : 6;

              // Helper to calculate the perfect adaptive font size for each guest in a seminar cell
              const getGuestFontSize = (name: string, cellSize: number) => {
                const words = name.split(/\s+/);
                const longestWord = Math.max(...words.map(w => w.length));

                // Base size scales with cell size
                let baseSize = 10;
                if (cellSize < 52) {
                  baseSize = 7.5;
                } else if (cellSize < 68) {
                  baseSize = 8;
                } else if (cellSize < 84) {
                  baseSize = 9;
                }

                // Char width limits to guarantee no word overflow or cut-offs
                // Average character width is ~0.53 * font-size
                const maxCharWidth = (cellSize - 3) / longestWord;
                const charSizeLimit = maxCharWidth / 0.53;

                return Math.max(7, Math.min(baseSize, Math.floor(charSizeLimit * 10) / 10));
              };

              // 2. Minimum cell width to fit guest names correctly with very tight padding
              const minCellWidthForNames = Math.max(32, Math.round((longestWordLength * 4.5 + 4) * tableScale));

              // 3. Ideal cellSize and ideal gap/margin size
              // Shrunk ideal cell sizes so they are naturally more compact, preventing excessive white space and over-stretching
              const idealCellSize = table.gridCellSize || (Math.min(100, Math.max(48, longestNameLength * 4.2 + 8)) * tableScale);
              const idealGapSize = 4 * (table.gridCellSize ? 1.0 : tableScale);

              // 4. Calculate available container width and adjust limits responsively
              const padX = containerWidth < 640 ? 32 : containerWidth < 768 ? 48 : 80;
              const maxGridWidth = Math.max(260, containerWidth - padX - 24);
              const isHorizontalDir = dir === 'Left' || dir === 'Right';

              let adjustedMaxGridWidth = maxGridWidth;
              if (isHorizontalDir) {
                adjustedMaxGridWidth -= (26 * tableScale + 24);
              }

              // 5. Calculate total width with ideal size and scale down if it exceeds the limit
              const totalIdealWidth = seatsPerRow * idealCellSize + (seatsPerRow - 1) * idealGapSize;

              let calculatedCellSize = idealCellSize;
              let calculatedGapSize = idealGapSize;

              if (totalIdealWidth > adjustedMaxGridWidth) {
                const minGapSize = 1; // minimum gap we want to maintain
                const widthWithMinGap = seatsPerRow * idealCellSize + (seatsPerRow - 1) * minGapSize;

                if (widthWithMinGap <= adjustedMaxGridWidth && seatsPerRow > 1) {
                  // Gaps can be shrunk to perfectly fit the table within the boundary
                  calculatedGapSize = Math.max(minGapSize, (adjustedMaxGridWidth - seatsPerRow * idealCellSize) / (seatsPerRow - 1));
                  calculatedCellSize = idealCellSize;
                } else {
                  // Gaps must be set to minimum, and we shrink cells too
                  calculatedGapSize = seatsPerRow > 1 ? minGapSize : 0;
                  const spaceForCells = adjustedMaxGridWidth - (seatsPerRow - 1) * calculatedGapSize;
                  const targetCellSize = spaceForCells / seatsPerRow;

                  // Never exceed targetCellSize to strictly prevent overflow of the canvas!
                  calculatedCellSize = targetCellSize;
                }
              }

              calculatedCellSize = Math.max(32, Math.round(calculatedCellSize));
              calculatedGapSize = Math.max(0, Math.round(calculatedGapSize));

              return (
                <div
                  className="relative flex items-center justify-center gap-6 transition-all duration-300 mx-auto my-4"
                  style={{
                    flexDirection: dir === 'Top' ? 'column' : dir === 'Bottom' ? 'column-reverse' : dir === 'Left' ? 'row' : 'row-reverse',
                    width: 'max-content',
                    height: 'max-content',
                  }}
                >
                  {/* Gilded Academic Stage/Podium */}
                  <div
                    className={`border shadow-xs rounded-lg flex flex-col items-center justify-center text-center transition-all bg-[#FAF7F2] border-[#C9A96E]/50 font-mono z-20 shrink-0 ${isFineTuning
                        ? 'cursor-grab active:cursor-grabbing hover:scale-105 border-dashed border-[#C9A96E] ring-2 ring-amber-200/50'
                        : ''
                      }`}
                    style={{
                      width: (dir === 'Left' || dir === 'Right') ? 26 * tableScale : 160 * tableScale,
                      height: (dir === 'Left' || dir === 'Right') ? 160 * tableScale : 26 * tableScale,
                      boxShadow: '0 2px 4px rgba(201, 169, 110, 0.08)',
                      transform: `translate(${podiumX}px, ${podiumY}px)`,
                    }}
                    onMouseDown={handlePodiumMouseDown}
                    onTouchStart={handlePodiumTouchStart}
                  >
                    <div className="flex flex-col items-center justify-center pointer-events-none select-none">
                      <span className="text-[8px] sm:text-[9px] uppercase tracking-widest font-bold text-[#C9A96E]">
                        ★ Podium
                      </span>
                    </div>
                  </div>

                  {/* Interactive Table Form Grid of Seats */}
                  <div
                    className={`rounded-xl transition-all duration-300 z-10 ${shape === 'seminar' ? 'overflow-visible' : 'overflow-hidden'
                      }`}
                    style={{
                      display: 'grid',
                      gridTemplateRows: `repeat(${rows}, ${calculatedCellSize}px)`,
                      gridTemplateColumns: `repeat(${seatsPerRow}, ${calculatedCellSize}px)`,
                      gap: `${calculatedGapSize}px`,
                      border: '2px solid #C9A96E',
                      backgroundColor: '#FAF7F2',
                      boxShadow: '0 4px 12px rgba(201, 169, 110, 0.1)',
                      width: 'max-content',
                      height: 'max-content',
                    }}
                  >
                    {Array.from({ length: rows * seatsPerRow }).map((_, seatIdx) => {
                      const guest = seatMap.get(seatIdx);
                      const isSelected = selectedGuestForMoving && guest && selectedGuestForMoving.id === guest.id;
                      const isSwapTarget = selectedGuestForMoving && guest && selectedGuestForMoving.id !== guest.id;
                      const isAssignTarget = selectedGuestForMoving && !guest;

                      const handleDragStart = (e: React.DragEvent) => {
                        if (isFineTuning) {
                          e.preventDefault();
                          return;
                        }
                        if (guest) {
                          e.dataTransfer.setData('text/plain', guest.id);
                          e.dataTransfer.effectAllowed = 'move';
                          onSelectGuestForMoving(guest);
                        }
                      };

                      const handleDragOver = (e: React.DragEvent) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                      };

                      const handleDrop = (e: React.DragEvent) => {
                        e.preventDefault();
                        const draggedGuestId = e.dataTransfer.getData('text/plain');
                        if (!draggedGuestId) return;

                        if (guest) {
                          onSwapGuests(draggedGuestId, guest.id);
                        } else {
                          onSeatGuest(draggedGuestId, table.id, seatIdx);
                        }
                        onSelectGuestForMoving(null);
                      };

                      return (
                        <div
                          key={seatIdx}
                          draggable={!!guest && !isFineTuning}
                          onDragStart={handleDragStart}
                          onDragOver={handleDragOver}
                          onDrop={handleDrop}
                          onClick={() => !isFineTuning && handleSeatClick(seatIdx, guest)}
                          className={`relative group/chair flex items-center justify-center border-dashed border-[#C9A96E]/20 transition-all duration-200 cursor-pointer ${guest
                              ? isSelected
                                ? 'bg-[#C9A96E] text-white'
                                : isSwapTarget
                                  ? 'bg-amber-50 text-amber-800 border-2 border-gilded-accent'
                                  : 'bg-transparent text-[#2C2C2C] hover:bg-[#FAF7F2]/90'
                              : isAssignTarget
                                ? 'bg-amber-50/50 border-[#C9A96E] hover:bg-amber-50'
                                : 'bg-transparent text-gray-400 hover:bg-[#C9A96E]/5'
                            }`}
                          style={{
                            borderWidth: '0.5px',
                            zIndex: showQuickSelectIndex === seatIdx ? 40 : 'auto',
                          }}
                        >
                          {/* Seat Number Box: Centered at the bottom */}
                          {table.showSeatNumbers !== false && (
                            <div
                              className="absolute bottom-1 left-1/2 -translate-x-1/2 px-1 py-0.5 rounded border border-[#C9A96E]/30 bg-[#FAF7F2]/95 text-[7px] font-mono font-bold leading-none select-none text-[#2C2C2C]/70 group-hover/chair:border-[#C9A96E]/60 transition-colors pointer-events-none"
                              style={{ zIndex: 5 }}
                            >
                              {seatIdx + 1}
                            </div>
                          )}

                          {guest ? (
                            <div className="flex flex-col items-center justify-center p-0.5 pb-4 w-full h-full relative">
                              <span
                                className="font-semibold leading-tight tracking-tight block text-center w-full px-0.5 select-none uppercase font-sans whitespace-normal break-words overflow-visible"
                                style={{
                                  fontSize: `${getGuestFontSize(guest.name, calculatedCellSize) * ((table.fontSize || 16) / 16)}px`
                                }}
                              >
                                {guest.name}
                              </span>

                              {/* Hover Tooltip */}
                              <div
                                className="absolute bottom-full mb-2 hidden group-hover/chair:block bg-slate-900/95 backdrop-blur-xs text-white text-[10px] py-1.5 px-2.5 rounded-lg whitespace-nowrap z-50 shadow-md font-sans origin-bottom"
                                style={{ transform: 'none' }}
                              >
                                <p className="font-semibold text-xs leading-tight">{guest.name}</p>
                                {guest.group && (
                                  <p className="text-slate-300 font-mono text-[9px] mt-0.5">Group: {guest.group}</p>
                                )}
                                {guest.notes && (
                                  <p className="text-amber-300 font-mono text-[9px] flex items-center gap-1 mt-0.5">
                                    <Utensils size={9} /> Diet: {guest.notes}
                                  </p>
                                )}
                                <p className="text-gray-400 text-[8px] mt-1 font-mono">Double-click to unseat</p>
                              </div>



                              {/* Quick Unseat button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUnseatGuest(guest.id);
                                }}
                                className="absolute top-1 right-1 hidden group-hover/chair:flex w-3.5 h-3.5 bg-red-500 text-white rounded-full items-center justify-center border border-white hover:bg-red-600 shadow-sm"
                                style={{ zIndex: 10 }}
                              >
                                <span className="text-[8px] leading-none select-none font-bold">×</span>
                              </button>
                            </div>
                          ) : (
                            /* Plus Button: Upper Center */
                            <div
                              className="flex items-center justify-center transition-transform group-hover/chair:scale-125"
                              style={{ paddingBottom: '4px' }}
                            >
                              <span className="text-[13px] font-bold text-[#C9A96E]/85 select-none leading-none">
                                +
                              </span>
                            </div>
                          )}

                          {/* Quick Select Panel inside cell */}
                          {showQuickSelectIndex === seatIdx && unassignedGuests.length > 0 && (
                            <div
                              className="absolute top-full mt-1 left-1/2 -translate-x-1/2 w-48 bg-white border border-[#C9A96E]/20 rounded-xl shadow-xl z-50 p-2 text-left"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center justify-between border-b border-gray-50 pb-1.5 mb-1.5">
                                <span className="text-[9px] uppercase tracking-wider font-mono font-bold text-gray-400">Seat {seatIdx + 1} Guests</span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowQuickSelectIndex(null);
                                  }}
                                  className="text-gray-400 hover:text-gray-600 text-xs font-bold font-mono"
                                >
                                  ×
                                </button>
                              </div>
                              <div className="max-h-36 overflow-y-auto space-y-1 scrollbar-thin">
                                {unassignedGuests.map((g) => (
                                  <button
                                    key={g.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onSeatGuest(g.id, table.id, seatIdx);
                                      setShowQuickSelectIndex(null);
                                    }}
                                    className="w-full text-left px-2 py-1 text-[11px] text-[#2C2C2C] hover:bg-amber-55/10 hover:text-[#C9A96E] font-medium transition-colors rounded-md truncate block"
                                  >
                                    {g.name}
                                    {g.group && <span className="text-[8px] text-gray-400 ml-1">({g.group})</span>}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </>
        ) : (
          <div
            className={`absolute border shadow-xs flex flex-col items-center justify-center text-center transition-all duration-300 overflow-visible ${shape === 'round' || shape === 'nano'
                ? 'rounded-full'
                : shape === 'square'
                  ? 'rounded-2xl'
                  : shape === 'rectangle'
                    ? 'rounded-2xl'
                    : 'rounded-xl'
              }`}
            style={{
              width: shape === 'round'
                ? radius * 1.25 * tableScale
                : shape === 'nano'
                  ? radius * 2.2 * tableScale
                  : shape === 'square'
                    ? sqSize * tableScale
                    : shape === 'rectangle'
                      ? rectW * tableScale
                      : banquetW * tableScale,
              height: shape === 'round'
                ? radius * 1.25 * tableScale
                : shape === 'nano'
                  ? radius * 1.1 * tableScale
                  : shape === 'square'
                    ? sqSize * tableScale
                    : shape === 'rectangle'
                      ? rectH * tableScale
                      : banquetH * tableScale,
              left: center - (shape === 'round'
                ? radius * 1.25 * tableScale
                : shape === 'nano'
                  ? radius * 2.2 * tableScale
                  : shape === 'square'
                    ? sqSize * tableScale
                    : shape === 'rectangle'
                      ? rectW * tableScale
                      : banquetW * tableScale) / 2,
              top: center - (shape === 'round'
                ? radius * 1.25 * tableScale
                : shape === 'nano'
                  ? radius * 1.1 * tableScale
                  : shape === 'square'
                    ? sqSize * tableScale
                    : shape === 'rectangle'
                      ? rectH * tableScale
                      : banquetH * tableScale) / 2,
              backgroundColor: (table as any).fillColor || `${table.color}0D`, // 5% opacity background
              borderColor: table.color,
              borderWidth: (table as any).strokeWidth !== undefined ? `${(table as any).strokeWidth}px` : '2.5px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxSizing: 'border-box',
              padding: '12px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                width: '100%',
                height: '100%',
                margin: 0,
                padding: 0,
              }}
            >
              <span
                className="font-bold font-sans break-words leading-tight animate-fadeIn"
                style={{
                  color: table.fontColor || '#1e293b',
                  fontSize: `${table.fontSize || 16}px`,
                  margin: 0,
                  padding: 0,
                  width: '100%',
                  display: 'block',
                  textAlign: 'center',
                }}
              >
                {table.name}
              </span>
            </div>
          </div>
        )}

        {/* Outer Circular Chairs */}
        {(shape as string) !== 'seminar' && Array.from({ length: maxSeats }).map((_, seatIdx) => {
          const guest = seatMap.get(seatIdx);
          const coords = getSeatCoords(seatIdx);
          const isSelected = selectedGuestForMoving && guest && selectedGuestForMoving.id === guest.id;
          const isSwapTarget = selectedGuestForMoving && guest && selectedGuestForMoving.id !== guest.id;
          const isAssignTarget = selectedGuestForMoving && !guest;

          // Drag and drop events
          const handleDragStart = (e: React.DragEvent) => {
            if (isFineTuning) {
              e.preventDefault();
              return;
            }
            if (guest) {
              e.dataTransfer.setData('text/plain', guest.id);
              e.dataTransfer.effectAllowed = 'move';
              onSelectGuestForMoving(guest);
            }
          };

          const handleDragOver = (e: React.DragEvent) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          };

          const handleDrop = (e: React.DragEvent) => {
            e.preventDefault();
            const draggedGuestId = e.dataTransfer.getData('text/plain');
            if (!draggedGuestId) return;

            if (guest) {
              onSwapGuests(draggedGuestId, guest.id);
            } else {
              onSeatGuest(draggedGuestId, table.id, seatIdx);
            }
            onSelectGuestForMoving(null);
          };

          const chairWidth = guest ? 140 : 40;
          const chairHeight = guest ? 32 : 40;

          const dragX = guest ? (localDragOffsets[guest.id]?.x !== undefined ? localDragOffsets[guest.id].x : (guest.offsetX || 0)) : 0;
          const dragY = guest ? (localDragOffsets[guest.id]?.y !== undefined ? localDragOffsets[guest.id].y : (guest.offsetY || 0)) : 0;

          // Compute rotation in degrees for alignment
          let seatRotation = 0;
          if (shape === 'round') {
            const angle = (seatIdx * 2 * Math.PI) / maxSeats - Math.PI / 2;
            seatRotation = Math.round((angle * 180) / Math.PI) + 90;
          } else {
            // Rectangle, square, banquet
            let currentW = rectW;
            let currentH = rectH;
            if (shape === 'square') {
              currentW = sqSize;
              currentH = sqSize;
            } else if (shape === 'banquet') {
              currentW = banquetW;
              currentH = banquetH;
            }
            const pad = 20;
            const wOuter = currentW + pad * 2;
            const hOuter = currentH + pad * 2;
            const P = 2 * wOuter + 2 * hOuter;
            let d = (seatIdx * P) / maxSeats;
            d = (d + wOuter / 2) % P;
            if (d < wOuter) {
              seatRotation = 0;
            } else if (d < wOuter + hOuter) {
              seatRotation = 90;
            } else if (d < 2 * wOuter + hOuter) {
              seatRotation = 180;
            } else {
              seatRotation = 270;
            }
          }

          return (
            <div
              key={seatIdx}
              style={{
                position: 'absolute',
                left: coords.x - chairWidth / 2 + dragX,
                top: coords.y - chairHeight / 2 + dragY,
                width: chairWidth,
                height: chairHeight,
                transform: guest ? 'none' : `rotate(${seatRotation}deg)`,
              }}
              className={`z-10 transition-transform duration-200 ${!guest ? 'empty-chair-container' : ''}`}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <div
                draggable={!!guest && !isFineTuning}
                onDragStart={handleDragStart}
                onClick={() => !isFineTuning && handleSeatClick(seatIdx, guest)}
                onMouseDown={(e) => guest && handleGuestMouseDown(e, guest.id, guest.offsetX || 0, guest.offsetY || 0)}
                onTouchStart={(e) => guest && handleGuestTouchStart(e, guest.id, guest.offsetX || 0, guest.offsetY || 0)}
                style={{
                  color: guest && !isSelected ? (table.fontColor || '#1e293b') : undefined
                }}
                className={`w-full h-full flex items-center justify-center text-center transition-all duration-200 relative group/chair ${guest
                    ? `${isFineTuning
                      ? 'cursor-grab active:cursor-grabbing hover:scale-105 select-none'
                      : 'cursor-pointer'
                    } ${isSelected
                      ? 'bg-gilded-accent text-white rounded-none border border-transparent scale-105 shadow-sm'
                      : isSwapTarget
                        ? 'bg-amber-50 text-amber-800 border-2 border-dashed border-gilded-accent rounded-none scale-105'
                        : 'bg-transparent border-none hover:text-gilded-accent'
                    }`
                    : `rounded-none cursor-pointer ${isAssignTarget
                      ? 'bg-gilded-faint text-gilded-accent border-2 border-dashed border-gilded-accent scale-105'
                      : 'bg-white text-gilded-ink/40 border border-dashed border-gilded-border hover:bg-gilded-faint hover:border-gilded-accent'
                    }`
                  }`}
              >
                {/* Seat Number Tooltip & Dot Indicator */}
                {table.showSeatNumbers !== false && !guest && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-none bg-gilded-bg border border-gilded-border text-[8px] font-bold font-mono text-gilded-ink/60 flex items-center justify-center group-hover/chair:scale-110 transition-transform">
                    {seatIdx + 1}
                  </span>
                )}

                {guest ? (
                  <div className="flex flex-col items-center justify-center p-0.5 w-full h-full relative overflow-visible">
                    <span 
                      style={{
                        fontSize: `${11 * ((table.fontSize || 16) / 16)}px`
                      }}
                      className="font-semibold leading-normal tracking-tight block text-center w-full px-1 select-none uppercase font-sans overflow-visible whitespace-nowrap"
                    >
                      {guest.name}
                    </span>

                    {/* Popover Hover for guest name on PC */}
                    <div
                      style={{ transform: guest ? 'none' : `rotate(${-seatRotation}deg)` }}
                      className="absolute bottom-full mb-2 hidden group-hover/chair:block bg-slate-900/95 backdrop-blur-xs text-white text-[10px] py-1.5 px-2.5 rounded-lg whitespace-nowrap z-50 shadow-md font-sans origin-bottom"
                    >
                      <p className="font-semibold text-xs leading-tight">{guest.name}</p>
                      {guest.group && (
                        <p className="text-slate-300 font-mono text-[9px] mt-0.5">Group: {guest.group}</p>
                      )}
                      {guest.notes && (
                        <p className="text-amber-300 font-mono text-[9px] flex items-center gap-1 mt-0.5">
                          <Utensils size={9} /> Diet: {guest.notes}
                        </p>
                      )}
                      <p className="text-gray-400 text-[8px] mt-1 font-mono">Double-click to unseat</p>
                    </div>



                    {/* Floating quick unseat button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUnseatGuest(guest.id);
                      }}
                      onDoubleClick={(e) => e.stopPropagation()}
                      className="absolute -bottom-1 -left-1 hidden group-hover/chair:flex w-4 h-4 bg-red-500 text-white rounded-full items-center justify-center border border-white hover:bg-red-600"
                    >
                      <span className="text-[9px] leading-none select-none font-bold">×</span>
                    </button>
                  </div>
                ) : (
                  <div className="text-[11px] font-light text-gray-400 select-none font-sans font-medium">
                    +
                  </div>
                )}
              </div>

              {/* Quick Select Panel for empty seat */}
              {showQuickSelectIndex === seatIdx && unassignedGuests.length > 0 && (
                <div className="absolute top-11 left-1/2 -translate-x-1/2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl z-50 p-2 text-left">
                  <div className="flex items-center justify-between border-b border-gray-50 pb-1.5 mb-1.5">
                    <span className="text-[9px] uppercase tracking-wider font-mono font-bold text-gray-400">Seat {seatIdx + 1} Guests</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowQuickSelectIndex(null);
                      }}
                      className="text-gray-400 hover:text-gray-600 text-[10px]"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-0.5 scrollbar-thin text-[10px]">
                    {unassignedGuests.slice(0, 15).map((u) => (
                      <button
                        key={u.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickSelectGuest(u.id, seatIdx);
                        }}
                        className="w-full text-left p-1.5 hover:bg-indigo-50 rounded-lg text-gray-700 truncate block border border-transparent hover:border-indigo-100"
                      >
                        <span className="font-medium">{u.name}</span>
                        {u.group && <span className="text-gray-400 text-[8px] font-mono block">({u.group})</span>}
                      </button>
                    ))}
                    {unassignedGuests.length > 15 && (
                      <p className="text-[8px] text-gray-400 italic text-center py-1 border-t border-gray-50">
                        + {unassignedGuests.length - 15} more in panel
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>


    </div>
  );
}
