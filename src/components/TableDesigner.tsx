/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Trash2, Copy, Save, Edit3, Layers, Settings2, Move, Compass, 
  Smile, Crown, Accessibility, RefreshCw, Play, Check, AlertCircle, Info,
  Sparkles, Sliders, Layout, Type, MousePointer, HelpCircle
} from 'lucide-react';
import { TableTemplate, TemplateSeat, Table as SeatingTable } from '../types';

interface TableDesignerProps {
  onAddTableFromTemplate: (
    name: string,
    maxSeats: number,
    customSeats: TemplateSeat[],
    customShape?: 'Circle' | 'Rectangle' | 'Square' | 'Oval' | 'Semi-circle' | 'Quarter circle' | 'Polygon' | 'Long Banquet',
    customWidth?: number,
    customHeight?: number,
    customRadius?: number,
    customSides?: number
  ) => void;
  onBackToWorkspace?: () => void;
}

export default function TableDesigner({ onAddTableFromTemplate, onBackToWorkspace }: TableDesignerProps) {
  // Current editing template
  const [templateName, setTemplateName] = useState('My Custom Table');
  const [shape, setShape] = useState<TableTemplate['shape']>('Circle');
  
  // Dimensions (base coordinates out of 400x400 canvas)
  const [width, setWidth] = useState(180);
  const [height, setHeight] = useState(120);
  const [radius, setRadius] = useState(90);
  const [sides, setSides] = useState(6); // for Polygon

  // Seats on the canvas
  const [seats, setSeats] = useState<TemplateSeat[]>([]);
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);

  // Auto-placement helper state
  const [autoSeatCount, setAutoSeatCount] = useState(8);
  const [allowedSides, setAllowedSides] = useState<'all' | 'long' | 'short'>('all');
  const [frontSide, setFrontSide] = useState<'none' | 'Top' | 'Bottom' | 'Left' | 'Right'>('none');
  const [seatOffset, setSeatOffset] = useState(25); // distance from edge
  const [minSpacing, setMinSpacing] = useState(30); // spacing/density controller
  const [placementMode, setPlacementMode] = useState<'balanced' | 'long-sides-first' | 'cap-ends'>('balanced');

  // Saved templates list
  const [savedTemplates, setSavedTemplates] = useState<TableTemplate[]>([]);

  // Toast / notification
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Dragging state
  const canvasRef = useRef<SVGSVGElement | null>(null);
  const [draggingSeatId, setDraggingSeatId] = useState<string | null>(null);

  // Load saved templates from localStorage on mount
  useEffect(() => {
    const cached = localStorage.getItem('seating_planner_templates');
    if (cached) {
      try {
        setSavedTemplates(JSON.parse(cached));
      } catch (e) {
        console.error('Failed to load table templates:', e);
      }
    } else {
      // Default initial templates to showcase feature
      const defaults: TableTemplate[] = [
        {
          id: 'temp_oval_12',
          name: 'Grand Royal Oval',
          shape: 'Oval',
          width: 240,
          height: 160,
          seats: Array.from({ length: 12 }, (_, i) => {
            const angle = (i * 2 * Math.PI) / 12 - Math.PI / 2;
            return {
              id: `seat_${i}_${Date.now()}`,
              label: `Seat ${i + 1}`,
              x: 200 + 135 * Math.cos(angle),
              y: 200 + 95 * Math.sin(angle),
              rotation: Math.round((angle * 180) / Math.PI) + 90,
              side: 'Circle-around',
              type: i === 0 || i === 6 ? 'VIP' : 'Standard'
            };
          })
        },
        {
          id: 'temp_semi_6',
          name: 'Press Conference Arc',
          shape: 'Semi-circle',
          width: 200,
          height: 100,
          radius: 120,
          seats: Array.from({ length: 6 }, (_, i) => {
            const angle = -Math.PI + (i * Math.PI) / 5;
            return {
              id: `seat_semi_${i}_${Date.now()}`,
              label: `Speaker ${i + 1}`,
              x: 200 + 130 * Math.cos(angle),
              y: 220 + 130 * Math.sin(angle),
              rotation: Math.round((angle * 180) / Math.PI) + 90,
              side: 'Top',
              type: i === 2 || i === 3 ? 'VIP' : 'Standard'
            };
          })
        }
      ];
      setSavedTemplates(defaults);
      localStorage.setItem('seating_planner_templates', JSON.stringify(defaults));
    }
  }, []);

  // Save to localStorage whenever list changes
  const saveTemplatesToStorage = (updated: TableTemplate[]) => {
    setSavedTemplates(updated);
    localStorage.setItem('seating_planner_templates', JSON.stringify(updated));
  };

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // SVG Dimension limits/controls
  const center = 200;

  // Auto-placement logic based on selected shape
  const handleAutoPlaceSeats = () => {
    if (autoSeatCount < 1) return;

    const newSeats: TemplateSeat[] = [];

    if (shape === 'Circle') {
      const rOuter = radius + seatOffset;
      for (let i = 0; i < autoSeatCount; i++) {
        const angle = (i * 2 * Math.PI) / autoSeatCount - Math.PI / 2;
        newSeats.push({
          id: `seat_${i}_${Date.now()}`,
          label: `Seat ${i + 1}`,
          x: Math.round(center + rOuter * Math.cos(angle)),
          y: Math.round(center + rOuter * Math.sin(angle)),
          rotation: Math.round((angle * 180) / Math.PI) + 90,
          side: 'Circle-around',
          type: 'Standard'
        });
      }
    } else if (shape === 'Oval') {
      const rx = width / 2 + seatOffset;
      const ry = height / 2 + seatOffset;
      
      // Ellipse equal-distance placement (using numerical approximation)
      const sampleCount = 360;
      const points: { x: number; y: number; angle: number }[] = [];
      let totalLength = 0;
      
      for (let i = 0; i <= sampleCount; i++) {
        const theta = (i * 2 * Math.PI) / sampleCount;
        const px = rx * Math.cos(theta);
        const py = ry * Math.sin(theta);
        points.push({ x: px, y: py, angle: theta });
      }
      
      const segmentLengths: number[] = [];
      for (let i = 0; i < sampleCount; i++) {
        const dx = points[i+1].x - points[i].x;
        const dy = points[i+1].y - points[i].y;
        const len = Math.sqrt(dx * dx + dy * dy);
        segmentLengths.push(len);
        totalLength += len;
      }
      
      const targetStep = totalLength / autoSeatCount;
      
      for (let i = 0; i < autoSeatCount; i++) {
        const targetDist = i * targetStep;
        let currentDist = 0;
        let angle = -Math.PI / 2;
        for (let j = 0; j < sampleCount; j++) {
          if (currentDist + segmentLengths[j] >= targetDist) {
            const ratio = (targetDist - currentDist) / segmentLengths[j];
            angle = points[j].angle + ratio * (points[j+1].angle - points[j].angle);
            break;
          }
          currentDist += segmentLengths[j];
        }
        
        const shiftedAngle = angle - Math.PI / 2;
        const seatX = center + rx * Math.cos(shiftedAngle);
        const seatY = center + ry * Math.sin(shiftedAngle);
        const rotation = Math.round((shiftedAngle * 180) / Math.PI) + 90;
        
        newSeats.push({
          id: `seat_${i}_${Date.now()}`,
          label: `Seat ${i + 1}`,
          x: Math.round(seatX),
          y: Math.round(seatY),
          rotation,
          side: 'Circle-around',
          type: 'Standard'
        });
      }
    } else if (shape === 'Rectangle' || shape === 'Square') {
      const w = shape === 'Square' ? width : width;
      const h = shape === 'Square' ? width : height;
      const rx = w / 2;
      const ry = h / 2;
      
      let topCount = 0;
      let bottomCount = 0;
      let leftCount = 0;
      let rightCount = 0;
      
      if (placementMode === 'long-sides-first') {
        topCount = Math.floor(autoSeatCount / 2);
        bottomCount = autoSeatCount - topCount;
      } else if (placementMode === 'cap-ends') {
        if (autoSeatCount >= 2) {
          leftCount = 1;
          rightCount = 1;
          const remaining = autoSeatCount - 2;
          topCount = Math.floor(remaining / 2);
          bottomCount = remaining - topCount;
        } else {
          topCount = autoSeatCount;
        }
      } else {
        // 'balanced' mode (default)
        if (autoSeatCount === 5) {
          leftCount = 1;
          rightCount = 1;
          topCount = 1;
          bottomCount = 2;
        } else if (autoSeatCount === 6) {
          leftCount = 1;
          rightCount = 1;
          topCount = 2;
          bottomCount = 2;
        } else if (autoSeatCount === 8) {
          leftCount = 1;
          rightCount = 1;
          topCount = 3;
          bottomCount = 3;
        } else {
          const totalLen = 2 * w + 2 * h;
          const topWeight = w / totalLen;
          const leftWeight = h / totalLen;
          
          topCount = Math.round(autoSeatCount * topWeight);
          bottomCount = topCount;
          leftCount = Math.round(autoSeatCount * leftWeight);
          rightCount = leftCount;
          
          let currentTotal = topCount + bottomCount + leftCount + rightCount;
          while (currentTotal !== autoSeatCount) {
            if (currentTotal < autoSeatCount) {
              if (topCount <= bottomCount) topCount++;
              else if (leftCount <= rightCount) leftCount++;
              else bottomCount++;
            } else {
              if (topCount > bottomCount) topCount--;
              else if (leftCount > rightCount) leftCount--;
              else bottomCount--;
            }
            currentTotal = topCount + bottomCount + leftCount + rightCount;
          }
        }
      }

      // Filter by allowedSides
      if (allowedSides === 'long') {
        leftCount = 0;
        rightCount = 0;
        topCount = Math.floor(autoSeatCount / 2);
        bottomCount = autoSeatCount - topCount;
      } else if (allowedSides === 'short') {
        topCount = 0;
        bottomCount = 0;
        leftCount = Math.floor(autoSeatCount / 2);
        rightCount = autoSeatCount - leftCount;
      }

      // Front-side exclusion
      if (frontSide !== 'none') {
        if (frontSide === 'Top') topCount = 0;
        if (frontSide === 'Bottom') bottomCount = 0;
        if (frontSide === 'Left') leftCount = 0;
        if (frontSide === 'Right') rightCount = 0;
        
        const activeSidesCount = (frontSide !== 'Top' ? 1 : 0) + (frontSide !== 'Bottom' ? 1 : 0) + (frontSide !== 'Left' ? 1 : 0) + (frontSide !== 'Right' ? 1 : 0);
        if (activeSidesCount > 0) {
          const perSide = Math.floor(autoSeatCount / activeSidesCount);
          let rem = autoSeatCount % activeSidesCount;
          if (frontSide !== 'Top') { topCount = perSide + (rem > 0 ? 1 : 0); rem--; }
          if (frontSide !== 'Bottom') { bottomCount = perSide + (rem > 0 ? 1 : 0); rem--; }
          if (frontSide !== 'Left') { leftCount = perSide + (rem > 0 ? 1 : 0); rem--; }
          if (frontSide !== 'Right') { rightCount = perSide + (rem > 0 ? 1 : 0); rem--; }
        }
      }

      const distributeOnSide = (count: number, x1: number, y1: number, x2: number, y2: number, rot: number, sideName: TemplateSeat['side']) => {
        if (count <= 0) return;
        const inset = 30; // corners exclusion padding
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        const startX = x1 + (dx / length) * inset;
        const startY = y1 + (dy / length) * inset;
        const endX = x2 - (dx / length) * inset;
        const endY = y2 - (dy / length) * inset;
        
        for (let i = 0; i < count; i++) {
          const ratio = count === 1 ? 0.5 : i / (count - 1);
          const px = startX + ratio * (endX - startX);
          const py = startY + ratio * (endY - startY);
          newSeats.push({
            id: `seat_rect_${sideName}_${i}_${Date.now()}`,
            label: `Seat ${newSeats.length + 1}`,
            x: Math.round(px),
            y: Math.round(py),
            rotation: rot,
            side: sideName,
            type: 'Standard'
          });
        }
      };

      distributeOnSide(topCount, center - rx, center - ry - seatOffset, center + rx, center - ry - seatOffset, 0, 'Top');
      distributeOnSide(rightCount, center + rx + seatOffset, center - ry, center + rx + seatOffset, center + ry, 90, 'Right');
      distributeOnSide(bottomCount, center + rx, center + ry + seatOffset, center - rx, center + ry + seatOffset, 180, 'Bottom');
      distributeOnSide(leftCount, center - rx - seatOffset, center + ry, center - rx - seatOffset, center - ry, 270, 'Left');

    } else if (shape === 'Long Banquet') {
      const w = width;
      const h = height;
      const rx = w / 2;
      const ry = h / 2;
      
      let topCount = 0;
      let bottomCount = 0;
      let leftCount = 0;
      let rightCount = 0;
      
      if (placementMode === 'cap-ends') {
        if (autoSeatCount >= 2) {
          leftCount = 1;
          rightCount = 1;
          const remaining = autoSeatCount - 2;
          topCount = Math.floor(remaining / 2);
          bottomCount = remaining - topCount;
        } else {
          topCount = autoSeatCount;
        }
      } else {
        topCount = Math.floor(autoSeatCount / 2);
        bottomCount = autoSeatCount - topCount;
      }

      const distributeOnSide = (count: number, x1: number, y1: number, x2: number, y2: number, rot: number, sideName: TemplateSeat['side']) => {
        if (count <= 0) return;
        const inset = 30;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        const startX = x1 + (dx / length) * inset;
        const startY = y1 + (dy / length) * inset;
        const endX = x2 - (dx / length) * inset;
        const endY = y2 - (dy / length) * inset;
        
        for (let i = 0; i < count; i++) {
          const ratio = count === 1 ? 0.5 : i / (count - 1);
          const px = startX + ratio * (endX - startX);
          const py = startY + ratio * (endY - startY);
          newSeats.push({
            id: `seat_banquet_${sideName}_${i}_${Date.now()}`,
            label: `Seat ${newSeats.length + 1}`,
            x: Math.round(px),
            y: Math.round(py),
            rotation: rot,
            side: sideName,
            type: 'Standard'
          });
        }
      };

      distributeOnSide(topCount, center - rx, center - ry - seatOffset, center + rx, center - ry - seatOffset, 0, 'Top');
      distributeOnSide(rightCount, center + rx + seatOffset, center - ry, center + rx + seatOffset, center + ry, 90, 'Right');
      distributeOnSide(bottomCount, center + rx, center + ry + seatOffset, center - rx, center + ry + seatOffset, 180, 'Bottom');
      distributeOnSide(leftCount, center - rx - seatOffset, center + ry, center - rx - seatOffset, center - ry, 270, 'Left');

    } else if (shape === 'Semi-circle') {
      const rOuter = radius + seatOffset;
      for (let i = 0; i < autoSeatCount; i++) {
        const angle = -Math.PI + (i * Math.PI) / Math.max(1, autoSeatCount - 1);
        newSeats.push({
          id: `seat_${i}_${Date.now()}`,
          label: `Seat ${i + 1}`,
          x: Math.round(center + rOuter * Math.cos(angle)),
          y: Math.round(center + 20 + rOuter * Math.sin(angle)),
          rotation: Math.round((angle * 180) / Math.PI) + 90,
          side: 'Top',
          type: 'Standard'
        });
      }
    } else if (shape === 'Quarter circle') {
      const rOuter = radius + seatOffset;
      for (let i = 0; i < autoSeatCount; i++) {
        const angle = -Math.PI + (i * Math.PI / 2) / Math.max(1, autoSeatCount - 1);
        newSeats.push({
          id: `seat_${i}_${Date.now()}`,
          label: `Seat ${i + 1}`,
          x: Math.round(center - 50 + rOuter * Math.cos(angle)),
          y: Math.round(center + 50 + rOuter * Math.sin(angle)),
          rotation: Math.round((angle * 180) / Math.PI) + 90,
          side: 'Top',
          type: 'Standard'
        });
      }
    } else if (shape === 'Polygon') {
      const rOuter = radius + seatOffset;
      for (let i = 0; i < autoSeatCount; i++) {
        const angle = (i * 2 * Math.PI) / autoSeatCount - Math.PI / 2;
        newSeats.push({
          id: `seat_${i}_${Date.now()}`,
          label: `Seat ${i + 1}`,
          x: Math.round(center + rOuter * Math.cos(angle)),
          y: Math.round(center + rOuter * Math.sin(angle)),
          rotation: Math.round((angle * 180) / Math.PI) + 90,
          side: 'Circle-around',
          type: 'Standard'
        });
      }
    }

    setSeats(newSeats);
    setSelectedSeatId(newSeats.length > 0 ? newSeats[0].id : null);
    showToast(`Automatically placed ${autoSeatCount} seats symmetric to ${shape} shape`, 'success');
  };

  // Add a seat at exact coordinate
  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (draggingSeatId) return; // ignore click triggered by drag release
    if (!canvasRef.current) return;

    // Only place on direct canvas clicks, not on existing seats
    const target = e.target as HTMLElement;
    if (target.tagName === 'circle' && target.getAttribute('data-seat') === 'true') {
      return;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 400);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 400);

    const newSeat: TemplateSeat = {
      id: `seat_manual_${Date.now()}`,
      label: `S${seats.length + 1}`,
      x,
      y,
      rotation: 0,
      side: 'Other',
      type: 'Standard'
    };

    setSeats([...seats, newSeat]);
    setSelectedSeatId(newSeat.id);
  };

  // Dragging mechanisms
  const handleSeatMouseDown = (e: React.MouseEvent, seatId: string) => {
    e.stopPropagation();
    e.preventDefault();
    setDraggingSeatId(seatId);
    setSelectedSeatId(seatId);
  };

  const handleSeatTouchStart = (e: React.TouchEvent, seatId: string) => {
    e.stopPropagation();
    setDraggingSeatId(seatId);
    setSelectedSeatId(seatId);
  };

  // Handle document level mousemove for smooth dragging
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!draggingSeatId || !canvasRef.current) return;
      
      const rect = canvasRef.current.getBoundingClientRect();
      const x = Math.max(10, Math.min(390, Math.round(((e.clientX - rect.left) / rect.width) * 400)));
      const y = Math.max(10, Math.min(390, Math.round(((e.clientY - rect.top) / rect.height) * 400)));

      setSeats(prev => prev.map(s => s.id === draggingSeatId ? { ...s, x, y } : s));
    };

    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (!draggingSeatId || !canvasRef.current || e.touches.length === 0) return;
      const touch = e.touches[0];
      const rect = canvasRef.current.getBoundingClientRect();
      const x = Math.max(10, Math.min(390, Math.round(((touch.clientX - rect.left) / rect.width) * 400)));
      const y = Math.max(10, Math.min(390, Math.round(((touch.clientY - rect.top) / rect.height) * 400)));

      setSeats(prev => prev.map(s => s.id === draggingSeatId ? { ...s, x, y } : s));
    };

    const handleGlobalMouseUp = () => {
      if (draggingSeatId) {
        setDraggingSeatId(null);
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
    window.addEventListener('touchend', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchmove', handleGlobalTouchMove);
      window.removeEventListener('touchend', handleGlobalMouseUp);
    };
  }, [draggingSeatId]);

  // Selected seat values
  const selectedSeat = seats.find(s => s.id === selectedSeatId);

  const updateSelectedSeat = (updates: Partial<TemplateSeat>) => {
    if (!selectedSeatId) return;
    setSeats(prev => prev.map(s => s.id === selectedSeatId ? { ...s, ...updates } : s));
  };

  const handleDeleteSelectedSeat = () => {
    if (!selectedSeatId) return;
    setSeats(prev => prev.filter(s => s.id !== selectedSeatId));
    setSelectedSeatId(null);
    showToast('Seat deleted', 'info');
  };

  // Save current template to storage
  const handleSaveTemplate = () => {
    if (!templateName.trim()) {
      showToast('Template must have a valid name', 'error');
      return;
    }

    const templateToSave: TableTemplate = {
      id: `template_${Date.now()}`,
      name: templateName.trim(),
      shape,
      width,
      height,
      radius,
      sides,
      seats
    };

    const isExisting = savedTemplates.some(t => t.name.toLowerCase() === templateName.trim().toLowerCase());
    let updated: TableTemplate[] = [];

    if (isExisting) {
      updated = savedTemplates.map(t => t.name.toLowerCase() === templateName.trim().toLowerCase() ? { ...templateToSave, id: t.id } : t);
      showToast(`Updated template: ${templateName}`, 'success');
    } else {
      updated = [templateToSave, ...savedTemplates];
      showToast(`Saved new template: ${templateName}`, 'success');
    }

    saveTemplatesToStorage(updated);
  };

  const handleLoadTemplate = (t: TableTemplate) => {
    setTemplateName(t.name);
    setShape(t.shape);
    setWidth(t.width);
    setHeight(t.height);
    if (t.radius) setRadius(t.radius);
    if (t.sides) setSides(t.sides);
    setSeats(t.seats);
    setSelectedSeatId(t.seats.length > 0 ? t.seats[0].id : null);
    showToast(`Loaded template: ${t.name}`, 'info');
  };

  const handleDuplicateTemplate = (t: TableTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    const cloned: TableTemplate = {
      ...t,
      id: `template_clone_${Date.now()}`,
      name: `${t.name} (Copy)`
    };
    const updated = [cloned, ...savedTemplates];
    saveTemplatesToStorage(updated);
    showToast(`Duplicated ${t.name}`, 'success');
  };

  const handleDeleteTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedTemplates.filter(t => t.id !== id);
    saveTemplatesToStorage(updated);
    showToast('Template deleted', 'info');
  };

  // Instantiate standard seating table in app using this template
  const handleInstantiateTemplate = (t: TableTemplate, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (t.seats.length === 0) {
      showToast('Cannot use a template with zero seats', 'error');
      return;
    }
    // Call app callback to place table from custom template
    onAddTableFromTemplate(t.name, t.seats.length, t.seats, t.shape, t.width, t.height, t.radius, t.sides);
    showToast(`Created floorplan table from "${t.name}" template`, 'success');
    if (onBackToWorkspace) {
      onBackToWorkspace();
    }
  };

  // Generate SVG rendering paths for the base shapes
  const renderBaseShape = () => {
    let fill = '#EEF2FF';
    let stroke = '#4F46E5';
    let strokeWidth = 3;

    const strokeProps = {
      stroke,
      strokeWidth,
      fill,
      strokeDasharray: 'none',
      className: 'transition-all duration-300'
    };

    if (shape === 'Circle') {
      return <circle cx={center} cy={center} r={radius} {...strokeProps} />;
    }

    if (shape === 'Square') {
      return (
        <rect
          x={center - width / 2}
          y={center - width / 2}
          width={width}
          height={width}
          rx={16}
          {...strokeProps}
        />
      );
    }

    if (shape === 'Rectangle') {
      return (
        <rect
          x={center - width / 2}
          y={center - height / 2}
          width={width}
          height={height}
          rx={16}
          {...strokeProps}
        />
      );
    }

    if (shape === 'Oval') {
      return (
        <ellipse
          cx={center}
          cy={center}
          rx={width / 2}
          ry={height / 2}
          {...strokeProps}
        />
      );
    }

    if (shape === 'Semi-circle') {
      const r = radius;
      // Drawing a filled semi-circle pointing up
      const d = `M ${center - r} ${center + 20} A ${r} ${r} 0 0 1 ${center + r} ${center + 20} Z`;
      return <path d={d} {...strokeProps} />;
    }

    if (shape === 'Quarter circle') {
      const r = radius;
      // Draw quarter circle arc
      const d = `M ${center - 50} ${center + r - 50} A ${r} ${r} 0 0 1 ${center - 50 + r} ${center - 50} L ${center - 50} ${center - 50} Z`;
      return <path d={d} {...strokeProps} />;
    }

    if (shape === 'Polygon') {
      const pts: string[] = [];
      const r = radius;
      for (let i = 0; i < sides; i++) {
        const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
        const px = center + r * Math.cos(angle);
        const py = center + r * Math.sin(angle);
        pts.push(`${px},${py}`);
      }
      return <polygon points={pts.join(' ')} {...strokeProps} />;
    }

    if (shape === 'Long Banquet') {
      return (
        <rect
          x={center - width / 2}
          y={center - height / 2}
          width={width}
          height={height}
          rx={8}
          {...strokeProps}
        />
      );
    }

    return null;
  };

  // Helper color for seat type
  const getSeatTypeColor = (type: TemplateSeat['type']) => {
    switch (type) {
      case 'VIP': return 'fill-amber-400 stroke-amber-600';
      case 'Kid': return 'fill-sky-400 stroke-sky-600';
      case 'Wheelchair': return 'fill-teal-400 stroke-teal-600';
      case 'Empty/Spacer': return 'fill-slate-200 stroke-slate-400';
      default: return 'fill-indigo-600 stroke-indigo-800';
    }
  };

  // Visual text icons for seat types
  const getSeatTypeIcon = (type: TemplateSeat['type']) => {
    switch (type) {
      case 'VIP': return <Crown size={12} className="text-amber-600" />;
      case 'Kid': return <Smile size={12} className="text-sky-600" />;
      case 'Wheelchair': return <Accessibility size={12} className="text-teal-600" />;
      case 'Empty/Spacer': return <AlertCircle size={12} className="text-slate-500" />;
      default: return <Check size={12} className="text-indigo-600" />;
    }
  };

  return (
    <div className="bg-gilded-bg min-h-screen pb-16 pt-6 text-gilded-ink">
      <div className="max-w-[96%] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Banner header */}
        <div className="bg-white border border-gilded-border rounded-none p-6 mb-6 shadow-3xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="relative group inline-flex items-center gap-1.5 cursor-help">
                <h1 className="text-xl font-bold text-gilded-ink tracking-tight font-serif">
                  Dynamic Table Builder Studio
                </h1>
                <HelpCircle size={15} className="text-gray-400 group-hover:text-gilded-accent transition-colors shrink-0" />
                
                {/* Hover Description Tooltip */}
                <div className="absolute left-0 top-full mt-2 w-80 p-3 bg-gilded-ink text-gilded-bg border border-gilded-border/50 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none text-xs font-sans font-normal leading-relaxed">
                  <div className="font-mono text-[9px] uppercase tracking-wider text-gilded-accent font-bold mb-1">
                    Studio Overview
                  </div>
                  Design bespoke banquet tables, place custom geometric boundaries, place manual seat layouts, and save templates to local libraries.
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {onBackToWorkspace && (
              <button
                onClick={onBackToWorkspace}
                className="px-4 py-2 bg-white border border-gilded-border hover:bg-gilded-bg text-gilded-ink text-xs font-bold rounded-none shadow-3xs transition-all cursor-pointer"
              >
                ← Back to Workspace
              </button>
            )}
            <button
              onClick={handleSaveTemplate}
              className="px-4 py-2 bg-gilded-accent hover:bg-gilded-accent-muted text-gilded-ink text-xs font-bold rounded-none shadow-3xs hover:shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Save size={13} />
              <span>Save Template</span>
            </button>
          </div>
        </div>

        {/* Floating Toast Notification */}
        {notification && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-none border shadow-md flex items-center gap-2.5 animate-bounce font-sans text-xs font-bold ${
            notification.type === 'success' ? 'bg-gilded-accent-muted text-gilded-ink border-gilded-accent' :
            notification.type === 'error' ? 'bg-rose-50 text-rose-800 border-rose-100' :
            'bg-white text-gilded-ink border-gilded-border'
          }`}>
            {notification.type === 'success' ? <Check size={14} className="text-gilded-ink" /> : <Info size={14} />}
            <span>{notification.message}</span>
          </div>
        )}

        {/* Main Work Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT PANEL: SHAPE & DIMENSION CONTROLS */}
          <div className="space-y-6 lg:col-span-3">
            
            {/* Template Identification & Geometry Select */}
            <div className="bg-white rounded-none border border-gilded-border p-5 shadow-3xs space-y-4">
              <div>
                <h3 className="text-xs font-bold text-gilded-ink uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Type size={13} className="text-gilded-accent" />
                  Template Information
                </h3>
                <div className="mt-2.5">
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    className="w-full bg-gilded-faint hover:bg-gilded-bg/50 focus:bg-white border border-gilded-border focus:border-gilded-accent rounded-none px-3.5 py-2 text-xs font-semibold font-sans transition-all"
                    placeholder="Enter template name..."
                  />
                </div>
              </div>

              {/* Grid of visual cards as requested */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider font-mono mb-2.5">
                  Base Geometric Shape
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Circle', 'Rectangle', 'Square', 'Oval', 'Semi-circle', 'Quarter circle', 'Polygon', 'Long Banquet'] as const).map((s) => {
                    const isSelected = shape === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          setShape(s);
                          // Default sensible bounds
                          if (s === 'Circle' || s === 'Square') {
                            setHeight(width);
                          } else if (s === 'Long Banquet') {
                            setWidth(240);
                            setHeight(100);
                          }
                        }}
                        className={`p-2.5 rounded-none border text-center flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-gilded-accent bg-gilded-accent/10 font-extrabold'
                            : 'border-gilded-border/40 bg-gilded-faint hover:bg-gilded-accent/5'
                        }`}
                      >
                        {/* Mini SVG shape thumbnail */}
                        <svg width="24" height="24" viewBox="0 0 40 40" className="opacity-80">
                          {s === 'Circle' && <circle cx="20" cy="20" r="14" fill="none" stroke={isSelected ? '#C9A96E' : '#6B7280'} strokeWidth="2.5" />}
                          {s === 'Square' && <rect x="8" y="8" width="24" height="24" rx="4" fill="none" stroke={isSelected ? '#C9A96E' : '#6B7280'} strokeWidth="2.5" />}
                          {s === 'Rectangle' && <rect x="5" y="10" width="30" height="20" rx="4" fill="none" stroke={isSelected ? '#C9A96E' : '#6B7280'} strokeWidth="2.5" />}
                          {s === 'Oval' && <ellipse cx="20" cy="20" rx="16" ry="10" fill="none" stroke={isSelected ? '#C9A96E' : '#6B7280'} strokeWidth="2.5" />}
                          {s === 'Semi-circle' && <path d="M 6 24 A 14 14 0 0 1 34 24 Z" fill="none" stroke={isSelected ? '#C9A96E' : '#6B7280'} strokeWidth="2.5" />}
                          {s === 'Quarter circle' && <path d="M 10 30 A 20 20 0 0 1 30 10 L 10 10 Z" fill="none" stroke={isSelected ? '#C9A96E' : '#6B7280'} strokeWidth="2.5" />}
                          {s === 'Polygon' && <polygon points="20,6 34,16 29,32 11,32 6,16" fill="none" stroke={isSelected ? '#C9A96E' : '#6B7280'} strokeWidth="2.5" />}
                          {s === 'Long Banquet' && <rect x="3" y="12" width="34" height="16" rx="2" fill="none" stroke={isSelected ? '#C9A96E' : '#6B7280'} strokeWidth="2.5" />}
                        </svg>
                        <span className="text-[9px] text-gilded-ink font-semibold tracking-tight leading-tight text-center w-full whitespace-normal break-words">
                          {s}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Geometry Dimensions Panel */}
            <div className="bg-white rounded-none border border-gilded-border p-5 shadow-3xs space-y-4">
              <h3 className="text-xs font-bold text-gilded-ink uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Sliders size={13} className="text-gilded-accent" />
                Dimension Boundaries
              </h3>

              <div className="space-y-3 pt-1">
                {/* Width Slider (Active for rectangular, oval or square shapes) */}
                {shape !== 'Circle' && shape !== 'Semi-circle' && shape !== 'Quarter circle' && shape !== 'Polygon' && (
                  <div>
                    <div className="flex justify-between text-[10px] font-bold text-gray-500 font-mono mb-1">
                      <span>{shape === 'Square' ? 'SQUARE SIDE' : 'TABLE WIDTH'}</span>
                      <span>{width}px</span>
                    </div>
                    <input
                      type="range"
                      min="80"
                      max="280"
                      value={width}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setWidth(val);
                        if (shape === 'Square') setHeight(val);
                      }}
                      className="w-full h-1 bg-gray-100 rounded-none appearance-none cursor-pointer accent-gilded-accent"
                    />
                  </div>
                )}

                {/* Height Slider (Active for rectangles, ovals, and banquets) */}
                {(shape === 'Rectangle' || shape === 'Oval' || shape === 'Long Banquet') && (
                  <div>
                    <div className="flex justify-between text-[10px] font-bold text-gray-500 font-mono mb-1">
                      <span>TABLE HEIGHT</span>
                      <span>{height}px</span>
                    </div>
                    <input
                      type="range"
                      min="60"
                      max="240"
                      value={height}
                      onChange={(e) => setHeight(Number(e.target.value))}
                      className="w-full h-1 bg-gray-100 rounded-none appearance-none cursor-pointer accent-gilded-accent"
                    />
                  </div>
                )}

                {/* Radius Slider (Active for circular, semi or quarter shapes, and regular polygons) */}
                {(shape === 'Circle' || shape === 'Semi-circle' || shape === 'Quarter circle' || shape === 'Polygon') && (
                  <div>
                    <div className="flex justify-between text-[10px] font-bold text-gray-500 font-mono mb-1">
                      <span>TABLE RADIUS</span>
                      <span>{radius}px</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="140"
                      value={radius}
                      onChange={(e) => setRadius(Number(e.target.value))}
                      className="w-full h-1 bg-gray-100 rounded-none appearance-none cursor-pointer accent-gilded-accent"
                    />
                  </div>
                )}

                {/* Polygon Point Slider */}
                {shape === 'Polygon' && (
                  <div>
                    <div className="flex justify-between text-[10px] font-bold text-gray-500 font-mono mb-1">
                      <span>POLYGON SIDES</span>
                      <span>{sides} corners</span>
                    </div>
                    <input
                      type="range"
                      min="3"
                      max="12"
                      value={sides}
                      onChange={(e) => setSides(Number(e.target.value))}
                      className="w-full h-1 bg-gray-100 rounded-none appearance-none cursor-pointer accent-gilded-accent"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Quick Symmetrical Seat Auto-Placer */}
            <div className="bg-white border border-gilded-border rounded-none p-5 space-y-3.5 shadow-3xs">
              <div>
                <h3 className="text-xs font-bold text-gilded-ink uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Sparkles size={13} className="text-gilded-accent" />
                  Auto Seat Placer
                </h3>
                <p className="text-[10px] text-gray-500 font-medium leading-relaxed mt-1">
                  Instantly snap seats symmetrically spaced around the current table's boundaries.
                </p>
              </div>

              {/* Core controls */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-1/2">
                    <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider font-mono mb-1">
                      Chair Count
                    </label>
                    <select
                      value={autoSeatCount}
                      onChange={(e) => setAutoSeatCount(Number(e.target.value))}
                      className="w-full bg-white border border-gilded-border text-xs text-gilded-ink font-bold font-sans rounded-none px-2.5 py-1.5 focus:ring-1 focus:ring-gilded-accent cursor-pointer"
                    >
                      {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20].map((num) => (
                        <option key={num} value={num}>{num} Chairs</option>
                      ))}
                    </select>
                  </div>

                  <div className="w-1/2">
                    <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider font-mono mb-1">
                      Seat Offset
                    </label>
                    <input
                      type="range"
                      min="15"
                      max="45"
                      value={seatOffset}
                      onChange={(e) => setSeatOffset(Number(e.target.value))}
                      className="w-full h-1 bg-gray-200 rounded-none appearance-none cursor-pointer accent-gilded-accent"
                    />
                    <div className="text-[8px] font-bold text-gilded-accent font-mono text-right mt-0.5">{seatOffset}px</div>
                  </div>
                </div>

                {/* Show for Rectangular/Square/Banquet tables */}
                {(shape === 'Rectangle' || shape === 'Square' || shape === 'Long Banquet') && (
                  <div className="space-y-2 pt-1 border-t border-gilded-border">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider font-mono mb-1">
                          Allowed Sides
                        </label>
                        <select
                          value={allowedSides}
                          onChange={(e) => setAllowedSides(e.target.value as any)}
                          className="w-full bg-white border border-gilded-border text-[10px] text-gray-700 font-bold font-sans rounded-none px-2 py-1.5 focus:ring-1 focus:ring-gilded-accent cursor-pointer"
                        >
                          <option value="all">All Sides</option>
                          <option value="long">Long Sides Only</option>
                          <option value="short">Short Sides Only</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider font-mono mb-1">
                          Exclusion Side
                        </label>
                        <select
                          value={frontSide}
                          onChange={(e) => setFrontSide(e.target.value as any)}
                          className="w-full bg-white border border-gilded-border text-[10px] text-gray-700 font-bold font-sans rounded-none px-2 py-1.5 focus:ring-1 focus:ring-gilded-accent cursor-pointer"
                        >
                          <option value="none">None (Full)</option>
                          <option value="Top">Top (No seats)</option>
                          <option value="Bottom">Bottom (No seats)</option>
                          <option value="Left">Left (No seats)</option>
                          <option value="Right">Right (No seats)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider font-mono mb-1">
                        Placement Mode
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(['balanced', 'long-sides-first', 'cap-ends'] as const).map((mode) => {
                          const isActive = placementMode === mode;
                          return (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => setPlacementMode(mode)}
                              className={`py-1 px-1.5 rounded-none border text-[9px] font-bold transition-all text-center leading-none ${
                                isActive
                                  ? 'bg-gilded-accent border-gilded-accent text-gilded-ink shadow-3xs'
                                  : 'bg-white border-gilded-border text-gilded-ink hover:bg-gilded-faint'
                              }`}
                            >
                              {mode === 'balanced' ? 'Balanced' : mode === 'long-sides-first' ? 'Long Only' : 'Cap Ends'}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
                
                <button
                  type="button"
                  onClick={handleAutoPlaceSeats}
                  className="w-full mt-2 py-2 bg-gilded-accent hover:bg-gilded-accent-muted text-gilded-ink font-bold text-xs rounded-none shadow-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <RefreshCw size={12} />
                  <span>Distribute Seats</span>
                </button>
              </div>
            </div>

          </div>

          {/* CENTER PANEL: INTERACTIVE SVG EDITING WORKSPACE */}
          <div className="space-y-4 lg:col-span-6">
            
            {/* Guidelines tooltip */}
            <div className="bg-white rounded-none border border-gilded-border p-3.5 flex items-start gap-2.5 text-[11px] text-gray-500 leading-normal">
              <Info size={14} className="text-gilded-accent shrink-0 mt-0.5" />
              <div>
                <strong className="text-gilded-ink block font-sans">Visual Gestures</strong>
                Click anywhere inside the gray workspace grid to place a manual seat. Hover over any seat and drag to translate. Click a seat to select and modify.
              </div>
            </div>

            {/* Visual Canvas Container */}
            <div className="bg-white border border-gilded-border rounded-none p-4 shadow-sm flex flex-col items-center">
              <div className="relative border border-gilded-border rounded-none bg-slate-50/50 overflow-hidden w-full max-w-[400px]">
                
                {/* Blueprint grid layout background */}
                <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{
                  backgroundImage: 'radial-gradient(#2C2C2C 1.5px, transparent 1.5px)',
                  backgroundSize: '16px 16px'
                }} />

                {/* Central Workspace Canvas */}
                <svg
                  ref={canvasRef}
                  viewBox="0 0 400 400"
                  className="w-full h-auto aspect-square select-none cursor-crosshair"
                  onClick={handleCanvasClick}
                >
                  <defs>
                    {/* Chinese Restaurant Gradient */}
                    <linearGradient id="chineseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#C41E3A" />
                      <stop offset="50%" stopColor="#A61022" />
                      <stop offset="100%" stopColor="#730514" />
                    </linearGradient>
                    
                    {/* Hotel Catering Gradient */}
                    <linearGradient id="hotelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#FDFBF7" />
                      <stop offset="50%" stopColor="#F5E6CC" />
                      <stop offset="100%" stopColor="#E3D1B4" />
                    </linearGradient>

                    {/* Western Restaurant Gradient */}
                    <linearGradient id="westernGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#4A2E1B" />
                      <stop offset="50%" stopColor="#361F10" />
                      <stop offset="100%" stopColor="#221105" />
                    </linearGradient>

                    {/* Wedding Gradient */}
                    <linearGradient id="weddingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#FFF9F9" />
                      <stop offset="50%" stopColor="#FFE4E1" />
                      <stop offset="100%" stopColor="#FFD1DC" />
                    </linearGradient>
                  </defs>
                  {/* Outer coordinate rulers / visual aids */}
                  <line x1="200" y1="10" x2="200" y2="390" stroke="#E5D5B8" strokeWidth="1" strokeDasharray="3,3" />
                  <line x1="10" y1="200" x2="390" y2="200" stroke="#E5D5B8" strokeWidth="1" strokeDasharray="3,3" />

                  {/* Draw the geometric shape base */}
                  {renderBaseShape()}

                  {/* Center branding/labeling */}
                  <text
                    x="200"
                    y="200"
                    textAnchor="middle"
                    alignmentBaseline="middle"
                    className="font-mono text-[9px] fill-slate-400 font-extrabold select-none pointer-events-none"
                  >
                    {templateName || 'bespoke table'}
                  </text>

                  {/* Render Visual Seat Rings/Chairs */}
                  {seats.map((seat) => {
                    const isSelected = seat.id === selectedSeatId;
                    const isDragging = seat.id === draggingSeatId;
                    const size = isSelected ? 17 : 14;

                    return (
                      <g
                        key={seat.id}
                        transform={`translate(${seat.x}, ${seat.y}) rotate(${seat.rotation})`}
                        className="cursor-move"
                      >
                        {/* Direction Arrow Indicator on each seat to show seating direction */}
                        <polygon
                          points="-5,-16 0,-21 5,-16"
                          className={`${isSelected ? 'fill-gilded-accent' : 'fill-gilded-accent-muted/60'}`}
                        />

                        {/* Back-support arc representing a top-down chair boundary */}
                        <path
                          d={`M -13 0 A 13 13 0 0 1 13 0`}
                          fill="none"
                          stroke={isSelected ? '#C9A96E' : '#94A3B8'}
                          strokeWidth={isSelected ? '3.5' : '2'}
                        />

                        {/* Visual Chair Body */}
                        <circle
                          r={size}
                          data-seat="true"
                          className={`${getSeatTypeColor(seat.type)} transition-colors duration-200 stroke-2`}
                          onMouseDown={(e) => handleSeatMouseDown(e, seat.id)}
                          onTouchStart={(e) => handleSeatTouchStart(e, seat.id)}
                        />

                        {/* Mini text representing short label e.g., "S1" */}
                        <text
                          textAnchor="middle"
                          alignmentBaseline="middle"
                          y="1"
                          className={`font-mono text-[9px] font-bold pointer-events-none select-none fill-white`}
                        >
                          {seat.label.substring(0, 3)}
                        </text>

                        {/* Ring highlight for selected */}
                        {isSelected && (
                          <circle
                            r={size + 5}
                            fill="none"
                            stroke="#C9A96E"
                            strokeWidth="1.5"
                            strokeDasharray="2,2"
                          />
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Status footer for visual grid */}
              <div className="w-full flex justify-center items-center text-[10px] text-gray-400 font-mono mt-3.5 px-1">
                <span>Active Seats: {seats.length}</span>
              </div>
            </div>

          </div>

          {/* RIGHT PANEL: DETAIL EDIT PANEL & PRESETS */}
          <div className="space-y-6 lg:col-span-3">
            
            {/* Detailed seat visual customizer */}
            {selectedSeat ? (
              <div className="bg-white rounded-none border border-gilded-border p-5 shadow-3xs space-y-4">
                <div>
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold text-gilded-ink uppercase tracking-wider font-mono flex items-center gap-1.5">
                      <Settings2 size={13} className="text-gilded-accent" />
                      Configure Seat
                    </h3>
                    <button
                      type="button"
                      onClick={handleDeleteSelectedSeat}
                      className="text-gray-400 hover:text-rose-600 p-1 rounded-none hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Remove Seat"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">Edit individual node metrics</p>
                </div>

                <div className="space-y-3 pt-1">
                  {/* Seat Label */}
                  <div>
                    <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider font-mono mb-1">
                      Seat Identifier / Label
                    </label>
                    <input
                      type="text"
                      maxLength={8}
                      value={selectedSeat.label}
                      onChange={(e) => updateSelectedSeat({ label: e.target.value })}
                      className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-gilded-border focus:border-gilded-accent rounded-none px-3 py-1.5 text-xs font-bold font-sans transition-all"
                    />
                  </div>

                  {/* Seat Type */}
                  <div>
                    <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider font-mono mb-1">
                      Target Seat Type
                    </label>
                    <div className="grid grid-cols-1 gap-1.5">
                      {(['Standard', 'VIP', 'Kid', 'Empty/Spacer', 'Wheelchair'] as const).map((type) => {
                        const isActive = selectedSeat.type === type;
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => updateSelectedSeat({ type })}
                            className={`px-3 py-1.5 rounded-none border text-left text-xs font-semibold font-sans flex items-center justify-between transition-all cursor-pointer ${
                              isActive
                                ? 'border-gilded-accent bg-gilded-accent/10 text-gilded-ink font-bold shadow-3xs'
                                : 'border-gray-50 bg-slate-50/50 text-gray-600 hover:bg-gray-100/60'
                            }`}
                          >
                            <span className="flex items-center gap-1.5">
                              <span className={`w-2.5 h-2.5 rounded-full ${
                                type === 'VIP' ? 'bg-amber-400' :
                                type === 'Kid' ? 'bg-sky-400' :
                                type === 'Wheelchair' ? 'bg-teal-400' :
                                type === 'Empty/Spacer' ? 'bg-slate-200' :
                                'bg-gilded-accent'
                              }`} />
                              {type}
                            </span>
                            {getSeatTypeIcon(type)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Seat Side Orientation */}
                  <div>
                    <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider font-mono mb-1">
                      Logical Boundary Side
                    </label>
                    <select
                      value={selectedSeat.side}
                      onChange={(e) => updateSelectedSeat({ side: e.target.value as any })}
                      className="w-full bg-slate-50 border border-gilded-border text-xs font-semibold font-sans rounded-none px-2.5 py-1.5 focus:ring-1 focus:ring-gilded-accent cursor-pointer"
                    >
                      <option value="Circle-around">Circle Circular</option>
                      <option value="Top">Top Edge</option>
                      <option value="Bottom">Bottom Edge</option>
                      <option value="Left">Left Side</option>
                      <option value="Right">Right Side</option>
                      <option value="Other">Custom Angle / Freeform</option>
                    </select>
                  </div>

                  {/* Rotation Angle */}
                  <div>
                    <div className="flex justify-between text-[9px] font-bold text-gray-400 font-mono mb-1">
                      <span>ANGLE ROTATION</span>
                      <span>{selectedSeat.rotation}°</span>
                    </div>
                    <input
                      type="range"
                      min="-180"
                      max="180"
                      value={selectedSeat.rotation}
                      onChange={(e) => updateSelectedSeat({ rotation: Number(e.target.value) })}
                      className="w-full h-1 bg-gray-100 rounded-none appearance-none cursor-pointer accent-gilded-accent"
                    />
                  </div>

                  {/* X and Y sliders */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <div className="flex justify-between text-[9px] font-bold text-gray-400 font-mono mb-1">
                        <span>X AXIS</span>
                        <span>{selectedSeat.x}</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="390"
                        value={selectedSeat.x}
                        onChange={(e) => updateSelectedSeat({ x: Number(e.target.value) })}
                        className="w-full h-1 bg-gray-100 rounded-none appearance-none cursor-pointer accent-gilded-accent"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[9px] font-bold text-gray-400 font-mono mb-1">
                        <span>Y AXIS</span>
                        <span>{selectedSeat.y}</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="390"
                        value={selectedSeat.y}
                        onChange={(e) => updateSelectedSeat({ y: Number(e.target.value) })}
                        className="w-full h-1 bg-gray-100 rounded-none appearance-none cursor-pointer accent-gilded-accent"
                      />
                    </div>
                  </div>

                </div>
              </div>
            ) : (
              <div className="bg-white rounded-none border border-gilded-border p-5 shadow-3xs text-center py-8">
                <MousePointer size={24} className="text-slate-300 mx-auto mb-2" />
                <h4 className="text-xs font-bold text-gilded-ink font-sans">No Seat Selected</h4>
                <p className="text-[10px] text-gray-400 font-mono mt-1 px-4">
                  Select any seat node on the visual editor canvas to configure specific properties.
                </p>
              </div>
            )}

            {/* Saved Custom templates library */}
            <div className="bg-white rounded-none border border-gilded-border p-5 shadow-3xs space-y-4">
              <div>
                <h3 className="text-xs font-bold text-gilded-ink uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Layers size={13} className="text-gilded-accent" />
                  Templates Library
                </h3>
                <p className="text-[10px] text-gray-400 mt-0.5">Retrieve or duplicate saved configurations</p>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pt-1 pr-1">
                {savedTemplates.length === 0 ? (
                  <p className="text-[10px] text-gray-400 font-mono text-center py-4 italic">No custom templates saved yet</p>
                ) : (
                  savedTemplates.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => handleLoadTemplate(t)}
                      className="p-3 bg-gilded-faint hover:bg-gilded-bg rounded-none border border-gilded-border/50 hover:border-gilded-border transition-all cursor-pointer group flex flex-col justify-between gap-2"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-[11px] font-bold text-gilded-ink leading-tight truncate max-w-[130px]">
                            {t.name}
                          </h4>
                          <span className="text-[9px] text-gray-400 font-mono block mt-0.5">
                            {t.shape} • {t.seats.length} Seats
                          </span>
                        </div>

                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => handleDuplicateTemplate(t, e)}
                            className="p-1 text-gray-400 hover:text-gilded-accent hover:bg-white rounded-md border border-transparent hover:border-gilded-border"
                            title="Duplicate Template"
                          >
                            <Copy size={11} />
                          </button>
                          <button
                            onClick={(e) => handleDeleteTemplate(t.id, e)}
                            className="p-1 text-gray-400 hover:text-rose-600 hover:bg-white rounded-md border border-transparent hover:border-gilded-border"
                            title="Delete Template"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>

                      <button
                        onClick={(e) => handleInstantiateTemplate(t, e)}
                        className="w-full py-1 bg-gilded-accent hover:bg-gilded-accent-muted text-gilded-ink font-bold text-[9px] rounded-none border border-gilded-border transition-all flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Play size={8} />
                        <span>Place Table on Canvas</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
