/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Table, CanvasElement } from '../types';
import {
  Trash2,
  RotateCw,
  Square,
  Type,
  Grid,
  Maximize2,
  Layers,
  FileText,
  Download,
  Plus,
  Check,
  ChevronRight,
  Sliders,
  HelpCircle,
  Eye,
  RefreshCw,
  LayoutGrid
} from 'lucide-react';

interface LayoutDesignerProps {
  tables: Table[];
  layoutElements: CanvasElement[];
  onUpdateLayoutElements: (elements: CanvasElement[]) => void;
  onBackToWorkspace?: () => void;
}

// Standard Paper sizes in pixels (assuming 72 or 96 DPI approximations)
const PAPER_SIZES = {
  A4: { width: 842, height: 595, label: 'A4 Landscape (842 x 595)' },
  A3: { width: 1191, height: 842, label: 'A3 Landscape (1191 x 842)' },
};

// Helper function to calculate the least bounding box of a custom table shape and seats
const getCustomTableBounds = (table: Table) => {
  let minX = 200;
  let maxX = 200;
  let minY = 200;
  let maxY = 200;

  const cShape = table.customShape || 'Circle';
  const cWidth = table.customWidth || 180;
  const cHeight = table.customHeight || 120;
  const cRadius = table.customRadius || 90;

  if (cShape === 'Circle' || cShape === 'Polygon' || cShape === 'Semi-circle') {
    minX = Math.min(minX, 200 - cRadius);
    maxX = Math.max(maxX, 200 + cRadius);
    minY = Math.min(minY, 200 - cRadius);
    maxY = Math.max(maxY, 200 + cRadius);
  } else if (cShape === 'Square') {
    minX = Math.min(minX, 200 - cWidth / 2);
    maxX = Math.max(maxX, 200 + cWidth / 2);
    minY = Math.min(minY, 200 - cWidth / 2);
    maxY = Math.max(maxY, 200 + cWidth / 2);
  } else if (cShape === 'Rectangle' || cShape === 'Oval' || cShape === 'Long Banquet') {
    minX = Math.min(minX, 200 - cWidth / 2);
    maxX = Math.max(maxX, 200 + cWidth / 2);
    minY = Math.min(minY, 200 - cHeight / 2);
    maxY = Math.max(maxY, 200 + cHeight / 2);
  } else if (cShape === 'Quarter circle') {
    minX = Math.min(minX, 200 - 50);
    maxX = Math.max(maxX, 200 - 50 + cRadius);
    minY = Math.min(minY, 200 - 50);
    maxY = Math.max(maxY, 200 - 50 + cRadius);
  }

  if (table.customSeats && table.customSeats.length > 0) {
    table.customSeats.forEach(s => {
      minX = Math.min(minX, s.x - 15);
      maxX = Math.max(maxX, s.x + 15);
      minY = Math.min(minY, s.y - 15);
      maxY = Math.max(maxY, s.y + 15);
    });
  }

  return {
    width: Math.max(20, maxX - minX),
    height: Math.max(20, maxY - minY),
    minX,
    minY
  };
};

// Helper function to calculate tight adaptive bounding box for polygons based on sides
const getPolygonBounds = (width: number, height: number, sides: number) => {
  const s = Math.max(3, sides);
  const rx = width / 2;
  const ry = height / 2;
  const cx = width / 2;
  const cy = height / 2;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const pts: string[] = [];

  for (let i = 0; i < s; i++) {
    const angle = (i * 2 * Math.PI) / s - Math.PI / 2;
    const px = cx + rx * Math.cos(angle);
    const py = cy + ry * Math.sin(angle);
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
    pts.push(`${px},${py}`);
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    pts,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY)
  };
};

export default function LayoutDesigner({ tables, layoutElements, onUpdateLayoutElements, onBackToWorkspace }: LayoutDesignerProps) {
  // Canvas State
  const [paperSize, setPaperSize] = useState<'A3' | 'A4'>('A4');
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  const [gridSize, setGridSize] = useState<number>(20);
  const [elements, setElements] = useState<CanvasElement[]>(() => {
    return layoutElements && layoutElements.length > 0 ? layoutElements : [
      { id: 'wall-1', type: 'wall', x: 50, y: 50, width: 742, height: 10, rotation: 0, scale: 1 },
      { id: 'wall-2', type: 'wall', x: 50, y: 50, width: 10, height: 495, rotation: 0, scale: 1 },
      { id: 'wall-3', type: 'wall', x: 50, y: 535, width: 742, height: 10, rotation: 0, scale: 1 },
      { id: 'wall-4', type: 'wall', x: 782, y: 50, width: 10, height: 495, rotation: 0, scale: 1 },
      { id: 'door-1', type: 'door', x: 400, y: 535, width: 60, height: 10, rotation: 0, scale: 1 },
      { id: 'text-stage', type: 'text', x: 350, y: 100, width: 140, height: 40, rotation: 0, scale: 1, textData: '★ PRINCIPAL STAGE ★' }
    ];
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [sidebarTab, setSidebarTab] = useState<'library' | 'tables' | 'properties'>('library');
  const [libraryPage, setLibraryPage] = useState<'elements' | 'geometry'>('elements');

  // Dragging states
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [elementStartPos, setElementStartPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // References
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Sync state to parent
  useEffect(() => {
    onUpdateLayoutElements(elements);
  }, [elements, onUpdateLayoutElements]);

  // Synchronize custom table dimensions and auto-clean orphaned table proxies
  useEffect(() => {
    let changed = false;
    const validTableIds = new Set(tables.map(t => t.id));

    // 1. Filter out orphaned table proxies whose reference table was deleted
    const filtered = elements.filter(el => {
      if (el.type === 'table_proxy' && el.tableReferenceId) {
        if (!validTableIds.has(el.tableReferenceId)) {
          changed = true;
          return false; // remove orphaned table_proxy
        }
      }
      return true;
    });

    // 2. Synchronize dimensions for custom tables
    const updated = filtered.map(el => {
      if (el.type === 'table_proxy') {
        const table = tables.find(t => t.id === el.tableReferenceId);
        if (table && table.shape === 'custom') {
          const bounds = getCustomTableBounds(table);
          if (el.width !== bounds.width || el.height !== bounds.height) {
            changed = true;
            return {
              ...el,
              width: bounds.width,
              height: bounds.height
            };
          }
        }
      }
      return el;
    });

    if (changed) {
      setElements(updated);
    }
  }, [tables, elements]);


  // Dimensions based on orientation
  const baseWidth = paperSize === 'A3' ? PAPER_SIZES.A3.width : PAPER_SIZES.A4.width;
  const baseHeight = paperSize === 'A3' ? PAPER_SIZES.A3.height : PAPER_SIZES.A4.height;

  const canvasWidth = orientation === 'landscape' ? baseWidth : baseHeight;
  const canvasHeight = orientation === 'landscape' ? baseHeight : baseWidth;

  const activeElement = elements.find(el => el.id === selectedId);

  // Add items
  const addElement = (type: CanvasElement['type'], extraProps: Partial<CanvasElement> = {}) => {
    const id = `${type}_${Date.now()}`;
    const newEl: CanvasElement = {
      id,
      type,
      x: Math.round(canvasWidth / 2 - 50),
      y: Math.round(canvasHeight / 2 - 25),
      width: type === 'wall' ? 120 : type === 'text' ? 150 : 50,
      height: type === 'wall' ? 10 : type === 'text' ? 40 : 50,
      rotation: 0,
      scale: 1,
      ...extraProps
    };

    setElements(prev => [...prev, newEl]);
    setSelectedId(id);
    setSidebarTab('properties');
  };

  // Place a Table Proxy on the Canvas
  const placeTableProxy = (table: Table) => {
    // Check if table is already placed
    const alreadyPlaced = elements.some(el => el.type === 'table_proxy' && el.tableReferenceId === table.id);
    if (alreadyPlaced) {
      alert(`"${table.name}" is already placed on the canvas layout.`);
      return;
    }

    // Determine dimensions based on table capacity & shape
    let w = Math.min(180, Math.max(60, 80 + Math.max(0, (table.maxSeats - 6) * 6)));
    let h = w;

    if (table.shape === 'custom') {
      const bounds = getCustomTableBounds(table);
      w = bounds.width;
      h = bounds.height;
    }

    addElement('table_proxy', {
      tableReferenceId: table.id,
      width: w,
      height: h,
      textData: table.name
    });
  };

  // Drag operations
  const handleElementMouseDown = (e: React.MouseEvent<SVGElement>, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(id);
    setIsDragging(true);

    const clientX = e.clientX;
    const clientY = e.clientY;
    setDragStart({ x: clientX, y: clientY });

    const el = elements.find(item => item.id === id);
    if (el) {
      setElementStartPos({ x: el.x, y: el.y });
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging || !selectedId) return;

    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;

    setElements(prev => prev.map(el => {
      if (el.id !== selectedId) return el;

      let newX = elementStartPos.x + dx;
      let newY = elementStartPos.y + dy;

      if (snapToGrid) {
        newX = Math.round(newX / gridSize) * gridSize;
        newY = Math.round(newY / gridSize) * gridSize;
      }

      // Constrain inside bounds
      newX = Math.max(0, Math.min(canvasWidth - el.width, newX));
      newY = Math.max(0, Math.min(canvasHeight - el.height, newY));

      return {
        ...el,
        x: newX,
        y: newY
      };
    }));
  };

  const handleCanvasMouseUp = () => {
    setIsDragging(false);
  };

  // Update properties of active element
  const updateActiveElement = (updates: Partial<CanvasElement>) => {
    if (!selectedId) return;
    setElements(prev => prev.map(el => {
      if (el.id !== selectedId) return el;

      const updated = { ...el, ...updates };

      // Ensure positive values and prevent going below zero
      if (updated.width !== undefined) updated.width = Math.max(5, updated.width);
      if (updated.height !== undefined) updated.height = Math.max(5, updated.height);
      if (updated.scale !== undefined) updated.scale = Math.max(0.1, updated.scale);

      return updated;
    }));
  };

  // Duplicate active element
  const duplicateActive = () => {
    if (!activeElement) return;
    const clone: CanvasElement = {
      ...activeElement,
      id: `${activeElement.type}_clone_${Date.now()}`,
      x: Math.min(canvasWidth - activeElement.width, activeElement.x + 20),
      y: Math.min(canvasHeight - activeElement.height, activeElement.y + 20),
    };
    setElements(prev => [...prev, clone]);
    setSelectedId(clone.id);
  };

  // Remove active element
  const deleteActive = () => {
    if (!selectedId) return;
    setElements(prev => prev.filter(el => el.id !== selectedId));
    setSelectedId(null);
  };

  // Render Table nested vector drawing
  const renderTableVector = (el: CanvasElement, table: Table) => {
    const scale = el.scale || 1.0;
    const shape = table.shape || 'round';
    const color = table.color || '#C9A96E';
    const fill = `${color}1A`; // 10% opacity

    const w = el.width * scale;
    const h = el.height * scale;
    const cx = w / 2;
    const cy = h / 2;
    const maxSeats = table.maxSeats || 8;

    // Render seats as little circles
    const seats: React.ReactNode[] = [];

    if (shape === 'custom') {
      const bounds = getCustomTableBounds(table);
      const cShape = table.customShape || 'Circle';
      const cWidth = table.customWidth || 180;
      const cHeight = table.customHeight || 120;
      const cRadius = table.customRadius || 90;
      const cSides = table.customSides || 6;

      const strokeProps = {
        stroke: color,
        strokeWidth: 2.5 * scale,
        fill: fill,
      };

      const renderShapeEl = () => {
        if (cShape === 'Circle') {
          return <circle cx={200} cy={200} r={cRadius} {...strokeProps} />;
        }
        if (cShape === 'Square') {
          return <rect x={200 - cWidth / 2} y={200 - cWidth / 2} width={cWidth} height={cWidth} rx={16} {...strokeProps} />;
        }
        if (cShape === 'Rectangle') {
          return <rect x={200 - cWidth / 2} y={200 - cHeight / 2} width={cWidth} height={cHeight} rx={16} {...strokeProps} />;
        }
        if (cShape === 'Oval') {
          return <ellipse cx={200} cy={200} rx={cWidth / 2} ry={cHeight / 2} {...strokeProps} />;
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
          return <rect x={200 - cWidth / 2} y={200 - cHeight / 2} width={cWidth} height={cHeight} rx={8} {...strokeProps} />;
        }
        return null;
      };

      if (table.customSeats && table.customSeats.length > 0) {
        table.customSeats.forEach((s, idx) => {
          const sx = (s.x - bounds.minX) * scale;
          const sy = (s.y - bounds.minY) * scale;
          seats.push(
            <circle key={`seat-custom-${idx}`} cx={sx} cy={sy} r={4 * scale} fill="#FAF7F2" stroke={color} strokeWidth="1" />
          );
        });
      }

      return (
        <g>
          <g transform={`scale(${scale}) translate(${-bounds.minX}, ${-bounds.minY})`}>
            {renderShapeEl()}
          </g>
          {seats}
          <text
            x={(200 - bounds.minX) * scale}
            y={(200 - bounds.minY) * scale + 3}
            textAnchor="middle"
            fontSize={Math.max(8, 10 * scale)}
            fontFamily="serif"
            fontWeight="bold"
            fill="#2C2C2C"
            className="select-none"
          >
            {table.name}
          </text>
        </g>
      );
    }

    if (shape === 'round') {
      const radius = Math.min(w, h) * 0.35;
      // Draw Table Circle
      seats.push(
        <circle key="table-body" cx={cx} cy={cy} r={radius} fill={fill} stroke={color} strokeWidth="1.5" />
      );
      // Draw Seats around table
      for (let i = 0; i < maxSeats; i++) {
        const angle = (i * 2 * Math.PI) / maxSeats - Math.PI / 2;
        const seatDist = radius * 1.35;
        const sx = cx + seatDist * Math.cos(angle);
        const sy = cy + seatDist * Math.sin(angle);
        seats.push(
          <circle key={`seat-${i}`} cx={sx} cy={sy} r={4 * scale} fill="#FAF7F2" stroke={color} strokeWidth="1" />
        );
      }
    } else if (shape === 'seminar') {
      // Draw a grid representing rows facing a podium direction
      const rows = table.seminarRows || 1;
      const seatsPerRow = table.seminarSeatsPerRow || 8;

      // Draw rectangular stage/podium boundary
      seats.push(
        <rect key="table-body" x={w * 0.1} y={h * 0.25} width={w * 0.8} height={h * 0.5} rx={4} fill={fill} stroke={color} strokeWidth="1.5" />
      );

      // Render dots for students/attendees
      const cellW = (w * 0.8) / seatsPerRow;
      const cellH = (h * 0.5) / rows;
      for (let r = 0; r < rows; r++) {
        for (let s = 0; s < seatsPerRow; s++) {
          const sx = w * 0.1 + (s + 0.5) * cellW;
          const sy = h * 0.25 + (r + 0.5) * cellH;
          seats.push(
            <circle key={`seat-student-${r}-${s}`} cx={sx} cy={sy} r={3.5 * scale} fill="#FAF7F2" stroke={color} strokeWidth="1" />
          );
        }
      }
    } else {
      // Rectangle/Square/Banquet
      const rectW = w * 0.7;
      const rectH = h * 0.5;
      seats.push(
        <rect
          key="table-body"
          x={cx - rectW / 2}
          y={cy - rectH / 2}
          width={rectW}
          height={rectH}
          rx={shape === 'square' ? 6 : 4}
          fill={fill}
          stroke={color}
          strokeWidth="1.5"
        />
      );

      // Simple seat dots distributed on perimeter
      const pad = 10 * scale;
      const wOuter = rectW + pad * 2;
      const hOuter = rectH + pad * 2;
      const P = 2 * wOuter + 2 * hOuter;

      for (let i = 0; i < maxSeats; i++) {
        let d = (i * P) / maxSeats;
        d = (d + wOuter / 2) % P;

        let sxRel = 0;
        let syRel = 0;

        if (d < wOuter) {
          sxRel = d;
          syRel = 0;
        } else if (d < wOuter + hOuter) {
          sxRel = wOuter;
          syRel = d - wOuter;
        } else if (d < 2 * wOuter + hOuter) {
          sxRel = wOuter - (d - wOuter - hOuter);
          syRel = hOuter;
        } else {
          sxRel = 0;
          syRel = hOuter - (d - 2 * wOuter - hOuter);
        }

        const sx = cx - wOuter / 2 + sxRel;
        const sy = cy - hOuter / 2 + syRel;

        seats.push(
          <circle key={`seat-rect-${i}`} cx={sx} cy={sy} r={3.5 * scale} fill="#FAF7F2" stroke={color} strokeWidth="1" />
        );
      }
    }

    return (
      <g>
        {seats}
        {/* Table text identification */}
        <text
          x={cx}
          y={cy + 3}
          textAnchor="middle"
          fontSize={Math.max(8, 10 * scale)}
          fontFamily="serif"
          fontWeight="bold"
          fill="#2C2C2C"
          className="select-none"
        >
          {table.name}
        </text>
      </g>
    );
  };

  // Export current layout canvas configuration as json file
  const exportLayoutJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
      paperSize,
      orientation,
      elements,
      gridSize,
      snapToGrid
    }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `room_layout_${paperSize.toLowerCase()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Render SVG Grid Patterns
  const renderGridPattern = () => {
    return (
      <defs>
        <pattern id="minorGrid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
          <path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} fill="none" stroke="#E2E8F0" strokeWidth="0.5" />
        </pattern>
        <pattern id="majorGrid" width={gridSize * 5} height={gridSize * 5} patternUnits="userSpaceOnUse">
          <rect width={gridSize * 5} height={gridSize * 5} fill="url(#minorGrid)" />
          <path d={`M ${gridSize * 5} 0 L 0 0 0 ${gridSize * 5}`} fill="none" stroke="#CBD5E1" strokeWidth="1" />
        </pattern>
      </defs>
    );
  };

  // Count elements
  const tableProxiesCount = elements.filter(e => e.type === 'table_proxy').length;

  return (
    <div className="flex flex-col h-full min-h-[85vh] bg-[#FBFBFA]" id="layout-designer-root">

      {/* Top Banner Ribbon */}
      <div className="flex flex-wrap items-center justify-between border-b border-gray-100 bg-white px-6 py-3 shadow-3xs gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-50 rounded-lg text-amber-800 border border-amber-100">
            <Layers size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold font-serif text-[#2C2C2C]">Room Architectural Planner</h1>
            <p className="text-[11px] font-mono text-gray-400">Assemble wall bounds, entrance doors, windows, and position functional seating grids</p>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {onBackToWorkspace && (
            <button
              onClick={onBackToWorkspace}
              className="px-3.5 py-1.5 text-xs font-serif font-semibold border border-gray-200 text-[#2C2C2C] hover:bg-gray-50 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <ChevronRight size={13} className="rotate-180" />
              <span>Back to Workspace</span>
            </button>
          )}

          <button
            onClick={() => setShowHelp(!showHelp)}
            className="p-1.5 text-xs font-serif text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors flex items-center gap-1 cursor-pointer"
            title="Show Guide"
          >
            <HelpCircle size={15} />
            <span className="hidden sm:inline">User Guide</span>
          </button>

          <button
            onClick={exportLayoutJson}
            className="p-1.5 text-xs bg-[#2C2C2C] text-white hover:bg-gray-800 transition-all flex items-center gap-1.5 cursor-pointer"
            title="Download Plan JSON Data"
          >
            <Download size={14} />
            <span>Export Layout Data</span>
          </button>
        </div>
      </div>

      {/* Main split dashboard view */}
      <div className="flex flex-1 flex-col lg:flex-row overflow-hidden">

        {/* Left Side: Controls & Elements Asset Library */}
        <aside className="w-full lg:w-80 bg-white border-r border-gray-100 flex flex-col flex-shrink-0 select-none">
          {/* Side Tabs */}
          <div className="flex border-b border-gray-100">
            <button
              onClick={() => {
                setSidebarTab('library');
                setLibraryPage('elements');
              }}
              className={`flex-1 py-3 text-xs font-bold font-sans text-center border-b-2 transition-all cursor-pointer ${sidebarTab === 'library'
                  ? 'border-amber-700 text-amber-900 bg-amber-50/20'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
                }`}
            >
              Architectural Elements
            </button>
            <button
              onClick={() => setSidebarTab('tables')}
              className={`flex-1 py-3 text-xs font-bold font-sans text-center border-b-2 transition-all cursor-pointer relative ${sidebarTab === 'tables'
                  ? 'border-amber-700 text-amber-900 bg-amber-50/20'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
                }`}
            >
              Tables ({tables.length - tableProxiesCount} unplaced)
            </button>
            <button
              onClick={() => setSidebarTab('properties')}
              className={`flex-1 py-3 text-xs font-bold font-sans text-center border-b-2 transition-all cursor-pointer ${sidebarTab === 'properties'
                  ? 'border-amber-700 text-amber-900 bg-amber-50/20'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
                }`}
              disabled={!selectedId}
              title={!selectedId ? 'Select an item to view settings' : ''}
            >
              Item Properties
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {sidebarTab === 'library' && libraryPage === 'elements' && (
              <div className="space-y-4">
                <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-500 leading-relaxed font-mono">
                  Click on an element below to instantly drop it onto the center of your room planner canvas.
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => addElement('wall')}
                    className="flex flex-col items-center justify-center p-3 border border-gray-100 rounded-lg hover:border-amber-600/50 hover:bg-amber-50/10 group transition-all text-center cursor-pointer"
                    id="add-wall-btn"
                  >
                    <div className="w-12 h-2.5 bg-slate-400 group-hover:bg-slate-500 transition-colors rounded mb-2 shadow-xs" />
                    <span className="text-xs font-serif font-medium text-gray-700">Structural Wall</span>
                  </button>

                  <button
                    onClick={() => addElement('door')}
                    className="flex flex-col items-center justify-center p-3 border border-gray-100 rounded-lg hover:border-amber-600/50 hover:bg-amber-50/10 group transition-all text-center cursor-pointer"
                    id="add-door-btn"
                  >
                    <div className="w-10 h-10 border-l border-b border-amber-800 rounded-bl-full border-dashed mb-2 opacity-80" />
                    <span className="text-xs font-serif font-medium text-gray-700">Swinging Door</span>
                  </button>

                  <button
                    onClick={() => addElement('window')}
                    className="flex flex-col items-center justify-center p-3 border border-gray-100 rounded-lg hover:border-amber-600/50 hover:bg-amber-50/10 group transition-all text-center cursor-pointer"
                    id="add-window-btn"
                  >
                    <div className="w-12 h-3 border-y-2 border-sky-400 bg-sky-50 rounded mb-2 shadow-xs" />
                    <span className="text-xs font-serif font-medium text-gray-700">Glass Window</span>
                  </button>

                  <button
                    onClick={() => addElement('text')}
                    className="flex flex-col items-center justify-center p-3 border border-gray-100 rounded-lg hover:border-amber-600/50 hover:bg-amber-50/10 group transition-all text-center cursor-pointer"
                    id="add-text-btn"
                  >
                    <Type size={20} className="text-amber-800 mb-2 opacity-80 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-serif font-medium text-gray-700">Room Label / Stage</span>
                  </button>

                  <button
                    onClick={() => setLibraryPage('geometry')}
                    className="flex flex-col items-center justify-center p-3 border border-gray-100 rounded-lg hover:border-amber-600/50 hover:bg-amber-50/10 group transition-all text-center cursor-pointer col-span-2"
                    id="add-geometry-btn"
                  >
                    <div className="flex gap-1.5 items-center justify-center mb-2 text-amber-850 opacity-80 group-hover:scale-110 transition-transform">
                      <Square size={16} />
                      <span className="w-3.5 h-3.5 rounded-full border border-amber-800" />
                    </div>
                    <span className="text-xs font-serif font-medium text-gray-700">Geometry Group</span>
                  </button>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono mb-3">Room Canvas Settings</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] text-gray-500 font-mono mb-1">Canvas Grid Blueprint Format</label>
                      <select
                        value={paperSize}
                        onChange={(e) => setPaperSize(e.target.value as 'A3' | 'A4')}
                        className="w-full border border-gray-200 rounded-md p-1.5 text-xs bg-white focus:ring-1 focus:ring-amber-600 outline-none"
                      >
                        <option value="A4">A4 Layout Size ({PAPER_SIZES.A4.width}px x {PAPER_SIZES.A4.height}px)</option>
                        <option value="A3">A3 Heavy Blueprint ({PAPER_SIZES.A3.width}px x {PAPER_SIZES.A3.height}px)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-gray-500 font-mono mb-1">Sheet Orientation</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          onClick={() => setOrientation('landscape')}
                          className={`py-1 text-center text-xs font-serif rounded border ${orientation === 'landscape'
                              ? 'bg-amber-700 text-white border-amber-700'
                              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 cursor-pointer'
                            }`}
                        >
                          Landscape
                        </button>
                        <button
                          onClick={() => setOrientation('portrait')}
                          className={`py-1 text-center text-xs font-serif rounded border ${orientation === 'portrait'
                              ? 'bg-amber-700 text-white border-amber-700'
                              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 cursor-pointer'
                            }`}
                        >
                          Portrait
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-1 border-t border-gray-50 mt-2">
                      <div className="flex items-center gap-1.5">
                        <Grid size={14} className="text-gray-400" />
                        <span className="text-xs font-medium text-gray-600">Snap to grid</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={snapToGrid}
                        onChange={(e) => setSnapToGrid(e.target.checked)}
                        className="w-4 h-4 text-amber-700 border-gray-300 rounded focus:ring-amber-500 cursor-pointer"
                      />
                    </div>

                    {snapToGrid && (
                      <div className="animate-fadeIn">
                        <div className="flex justify-between items-center text-[10px] font-mono text-gray-400 mb-1">
                          <span>Grid size limit</span>
                          <span>{gridSize}px</span>
                        </div>
                        <input
                          type="range"
                          min="5"
                          max="40"
                          step="5"
                          value={gridSize}
                          onChange={(e) => setGridSize(Number(e.target.value))}
                          className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-700"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {sidebarTab === 'library' && libraryPage === 'geometry' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setLibraryPage('elements')}
                    className="flex items-center gap-1 text-[11px] font-bold text-amber-800 font-mono border border-amber-200 hover:border-amber-500 rounded px-2 py-0.5 bg-white cursor-pointer"
                  >
                    ← Back
                  </button>
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono">
                    Geometry Groups
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => addElement('geometry_rect', { width: 150, height: 100, customCornerRadius: 0, textData: 'Rectangle' })}
                    className="flex flex-col items-center justify-center p-3 border border-gray-100 rounded-lg hover:border-amber-600/50 hover:bg-amber-50/10 group transition-all text-center cursor-pointer"
                  >
                    <div className="w-12 h-8 border-2 border-amber-800/80 bg-amber-50/20 rounded-none mb-2" />
                    <span className="text-xs font-serif font-medium text-gray-700">Rectangle</span>
                  </button>

                  <button
                    onClick={() => addElement('geometry_square', { width: 100, height: 100, customCornerRadius: 0, textData: 'Square' })}
                    className="flex flex-col items-center justify-center p-3 border border-gray-100 rounded-lg hover:border-amber-600/50 hover:bg-amber-50/10 group transition-all text-center cursor-pointer"
                  >
                    <div className="w-10 h-10 border-2 border-amber-800/80 bg-amber-50/20 rounded-none mb-2" />
                    <span className="text-xs font-serif font-medium text-gray-700">Square</span>
                  </button>

                  <button
                    onClick={() => addElement('geometry_circle', { width: 100, height: 100, customCornerRadius: 0, textData: 'Circle' })}
                    className="flex flex-col items-center justify-center p-3 border border-gray-100 rounded-lg hover:border-amber-600/50 hover:bg-amber-50/10 group transition-all text-center cursor-pointer"
                  >
                    <div className="w-10 h-10 border-2 border-amber-800/80 bg-amber-50/20 rounded-full mb-2" />
                    <span className="text-xs font-serif font-medium text-gray-700">Circle</span>
                  </button>

                  <button
                    onClick={() => addElement('geometry_oval', { width: 140, height: 90, customCornerRadius: 0, textData: 'Oval' })}
                    className="flex flex-col items-center justify-center p-3 border border-gray-100 rounded-lg hover:border-amber-600/50 hover:bg-amber-50/10 group transition-all text-center cursor-pointer"
                  >
                    <div className="w-14 h-9 border-2 border-amber-800/80 bg-amber-50/20 rounded-full mb-2" />
                    <span className="text-xs font-serif font-medium text-gray-700">Oval</span>
                  </button>

                  <button
                    onClick={() => addElement('geometry_polygon', { width: 120, height: 120, customSides: 6, textData: 'Polygon' })}
                    className="flex flex-col items-center justify-center p-3 border border-gray-100 rounded-lg hover:border-amber-600/50 hover:bg-amber-50/10 group transition-all text-center cursor-pointer col-span-2"
                  >
                    <div className="w-10 h-10 flex items-center justify-center mb-2">
                      <svg width="40" height="40" viewBox="0 0 40 40" className="stroke-amber-800 fill-amber-50/20">
                        <polygon points="20,2 38,11 38,29 20,38 2,29 2,11" strokeWidth="2" />
                      </svg>
                    </div>
                    <span className="text-xs font-serif font-medium text-gray-700">Polygon</span>
                  </button>
                </div>
              </div>
            )}

            {sidebarTab === 'tables' && (
              <div className="space-y-4">
                <div className="p-3 bg-amber-55/10 text-[11px] text-amber-900 rounded-lg font-mono leading-normal border border-amber-100/50">
                  Select seated tables generated in your workspace to deploy as active layout proxies. Moving them here positions the physical tables in space!
                </div>

                {tables.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 font-serif text-sm">
                    No tables exist in workspace yet. Add tables first in Seating Workspace.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tables.map(table => {
                      const isPlaced = elements.some(el => el.type === 'table_proxy' && el.tableReferenceId === table.id);
                      return (
                        <div
                          key={table.id}
                          className={`flex items-center justify-between p-2.5 rounded-lg border transition-all ${isPlaced
                              ? 'bg-gray-50 border-gray-100 opacity-60'
                              : 'bg-white border-gray-200 hover:border-amber-600'
                            }`}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: table.color || '#4F46E5' }}
                            />
                            <div>
                              <p className="text-xs font-bold text-gray-800 font-sans">{table.name}</p>
                              <p className="text-[10px] text-gray-400 font-mono">Shape: {table.shape || 'round'} • {table.maxSeats} seats</p>
                            </div>
                          </div>

                          {!isPlaced ? (
                            <button
                              onClick={() => placeTableProxy(table)}
                              className="px-2 py-1 text-[10px] bg-amber-50 text-amber-800 border border-amber-100 hover:bg-amber-100 rounded font-bold font-mono transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Plus size={10} />
                              <span>Deploy</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-gray-400 font-bold font-mono flex items-center gap-1">
                              <Check size={11} className="text-emerald-600" />
                              <span>Placed</span>
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {sidebarTab === 'properties' && (
              <div className="space-y-4">
                {activeElement ? (
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between border-b border-gray-50 pb-1.5">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-800 bg-amber-50 px-2 py-0.5 rounded">
                        {activeElement.type} Settings
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={duplicateActive}
                          className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-900 transition-colors cursor-pointer"
                          title="Duplicate Element"
                        >
                          <Maximize2 size={13} className="rotate-45" />
                        </button>
                        <button
                          onClick={deleteActive}
                          className="p-1 hover:bg-red-50 rounded text-gray-500 hover:text-red-600 transition-colors cursor-pointer"
                          title="Delete Element"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Properties Fields */}
                    <div className="space-y-3">
                      {/* Name/Text */}
                      {(activeElement.type === 'text' || activeElement.type === 'table_proxy' || activeElement.type.startsWith('geometry_')) && (
                        <div>
                          <label className="block text-[11px] text-gray-400 font-mono mb-1">Display Title / Tag</label>
                          <input
                            type="text"
                            value={activeElement.textData || ''}
                            onChange={(e) => updateActiveElement({ textData: e.target.value })}
                            className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-xs bg-white focus:ring-1 focus:ring-amber-600 outline-none"
                            placeholder="Enter text..."
                          />
                        </div>
                      )}

                      {/* Color selection property */}
                      {(activeElement.type === 'wall' ||
                        activeElement.type === 'door' ||
                        activeElement.type === 'window' ||
                        activeElement.type === 'text' ||
                        activeElement.type.startsWith('geometry_')) && (
                          <div>
                            <label className="block text-[11px] text-gray-400 font-mono mb-1.5">Theme Color</label>
                            <div className="flex flex-wrap gap-2 items-center">
                              {[
                                { hex: '#64748B', label: 'Slate' },
                                { hex: '#DC2626', label: 'Red' },
                                { hex: '#D97706', label: 'Amber' },
                                { hex: '#16A34A', label: 'Green' },
                                { hex: '#2563EB', label: 'Blue' },
                                { hex: '#7C3AED', label: 'Purple' },
                                { hex: '#DB2777', label: 'Pink' },
                                { hex: '#2C2C2C', label: 'Dark' }
                              ].map((colorObj) => (
                                <button
                                  key={colorObj.hex}
                                  type="button"
                                  onClick={() => updateActiveElement({ color: colorObj.hex })}
                                  className={`w-6 h-6 rounded-full border transition-all cursor-pointer ${activeElement.color === colorObj.hex
                                      ? 'ring-2 ring-amber-750 ring-offset-1 scale-110'
                                      : 'border-gray-200 hover:scale-105'
                                    }`}
                                  style={{ backgroundColor: colorObj.hex }}
                                  title={colorObj.label}
                                />
                              ))}
                              <input
                                type="color"
                                value={activeElement.color || '#64748B'}
                                onChange={(e) => updateActiveElement({ color: e.target.value })}
                                className="w-7 h-7 rounded border border-gray-200 p-0 cursor-pointer overflow-hidden"
                              />
                            </div>
                          </div>
                        )}

                      {/* Coordinates */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] text-gray-400 font-mono mb-1">Position X</label>
                          <input
                            type="number"
                            value={activeElement.x}
                            onChange={(e) => updateActiveElement({ x: Number(e.target.value) })}
                            className="w-full border border-gray-200 rounded px-2.5 py-1 text-xs bg-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-gray-400 font-mono mb-1">Position Y</label>
                          <input
                            type="number"
                            value={activeElement.y}
                            onChange={(e) => updateActiveElement({ y: Number(e.target.value) })}
                            className="w-full border border-gray-200 rounded px-2.5 py-1 text-xs bg-white font-mono"
                          />
                        </div>
                      </div>

                      {/* Dimension Bounds */}
                      {activeElement.type === 'geometry_square' || activeElement.type === 'geometry_circle' ? (
                        <div>
                          <label className="block text-[11px] text-gray-400 font-mono mb-1">Size (Diameter / Side)</label>
                          <input
                            type="number"
                            value={activeElement.width}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              updateActiveElement({ width: val, height: val });
                            }}
                            className="w-full border border-gray-200 rounded px-2.5 py-1 text-xs bg-white font-mono"
                            min="5"
                          />
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] text-gray-400 font-mono mb-1">Element Width</label>
                            <input
                              type="number"
                              value={activeElement.width}
                              onChange={(e) => updateActiveElement({ width: Number(e.target.value) })}
                              className="w-full border border-gray-200 rounded px-2.5 py-1 text-xs bg-white font-mono"
                              min="5"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-gray-400 font-mono mb-1">Element Height</label>
                            <input
                              type="number"
                              value={activeElement.height}
                              onChange={(e) => updateActiveElement({ height: Number(e.target.value) })}
                              className="w-full border border-gray-200 rounded px-2.5 py-1 text-xs bg-white font-mono"
                              min="5"
                            />
                          </div>
                        </div>
                      )}

                      {/* Corner Radius (for applicable geometries) */}
                      {(activeElement.type === 'geometry_rect' || activeElement.type === 'geometry_square') && (
                        <div>
                          <div className="flex justify-between items-center text-[11px] text-gray-400 font-mono mb-1">
                            <span>Corner Radius</span>
                            <span>{activeElement.customCornerRadius || 0}px</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0"
                              max={Math.min(activeElement.width, activeElement.height) / 2}
                              step="1"
                              value={activeElement.customCornerRadius || 0}
                              onChange={(e) => updateActiveElement({ customCornerRadius: Number(e.target.value) })}
                              className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-700"
                            />
                          </div>
                        </div>
                      )}

                      {/* Polygon Sides */}
                      {activeElement.type === 'geometry_polygon' && (
                        <div>
                          <div className="flex justify-between items-center text-[11px] text-gray-400 font-mono mb-1">
                            <span>Polygon Sides</span>
                            <span>{activeElement.customSides || 6} sides</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="3"
                              max="12"
                              step="1"
                              value={activeElement.customSides || 6}
                              onChange={(e) => updateActiveElement({ customSides: Number(e.target.value) })}
                              className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-700"
                            />
                          </div>
                        </div>
                      )}

                      {/* Rotation slider */}
                      <div>
                        <div className="flex justify-between items-center text-[11px] text-gray-400 font-mono mb-1">
                          <span>Rotation angle</span>
                          <span>{activeElement.rotation}°</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="-180"
                            max="180"
                            step="15"
                            value={activeElement.rotation}
                            onChange={(e) => updateActiveElement({ rotation: Number(e.target.value) })}
                            className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-700"
                          />
                          <button
                            type="button"
                            onClick={() => updateActiveElement({ rotation: (activeElement.rotation + 45) % 360 })}
                            className="p-1 border border-gray-200 rounded hover:bg-gray-50 text-gray-500 cursor-pointer"
                            title="Rotate 45° clockwise"
                          >
                            <RotateCw size={11} />
                          </button>
                        </div>
                      </div>

                      {/* Scale Factor */}
                      <div>
                        <div className="flex justify-between items-center text-[11px] text-gray-400 font-mono mb-1">
                          <span>Geometry Scale</span>
                          <span>{(activeElement.scale || 1.0).toFixed(2)}x</span>
                        </div>
                        <input
                          type="range"
                          min="0.2"
                          max="2.5"
                          step="0.05"
                          value={activeElement.scale || 1.0}
                          onChange={(e) => updateActiveElement({ scale: Number(e.target.value) })}
                          className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-700"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-400 font-serif text-sm">
                    No active element selected.<br />Click on any element in the canvas artboard to configure properties.
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Right Side: Interactive Artboard Canvas Space */}
        <main className="flex-1 overflow-auto p-6 flex flex-col items-center justify-start bg-slate-100 select-none">

          {/* User Help Guide Box */}
          {showHelp && (
            <div className="w-full max-w-4xl bg-white border border-amber-200 p-4 rounded-xl mb-4 shadow-sm text-xs text-[#2C2C2C] leading-relaxed space-y-2 animate-fadeIn">
              <div className="flex justify-between items-center border-b border-gray-100 pb-1.5 mb-1">
                <span className="font-bold text-sm font-serif text-amber-800">Architectural Layout Designer Guide</span>
                <button onClick={() => setShowHelp(false)} className="text-gray-400 hover:text-gray-600 font-bold font-mono">×</button>
              </div>
              <p>This layout designer helps you model structural floor environments around your tables. Add walls, swinging doors, and labels, then deploy your seated tables inside the layout bounds.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                <div>
                  <strong className="block text-amber-900 font-semibold mb-0.5">Drag and Drop:</strong>
                  <span>Click and hold any architectural element inside the canvas boundary to move it freely.</span>
                </div>
                <div>
                  <strong className="block text-amber-900 font-semibold mb-0.5">Precise Property Inputs:</strong>
                  <span>Selecting an item activates the "Item Properties" tab where you can customize its position, rotation, label, and scale.</span>
                </div>
                <div>
                  <strong className="block text-amber-900 font-semibold mb-0.5">Table Sync:</strong>
                  <span>All round/rectangular tables already seated can be deployed onto the blueprint with active seats rendered nested inside.</span>
                </div>
              </div>
            </div>
          )}

          {/* Sizing Status Label */}
          <div className="mb-3 flex items-center justify-between w-full max-w-[95%]">
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
              Artboard Size: <strong className="text-slate-700">{paperSize} ({orientation})</strong> • Grid snap: <strong className="text-slate-700">{snapToGrid ? `${gridSize}px` : 'OFF'}</strong>
            </span>
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
              Total elements: <strong className="text-slate-700">{elements.length}</strong> ({tableProxiesCount} tables)
            </span>
          </div>

          {/* Artboard paper viewport layer wrapper */}
          <div
            className="bg-white shadow-xl border border-slate-300 relative transition-all duration-300 overflow-visible shrink-0"
            style={{
              width: `${canvasWidth}px`,
              height: `${canvasHeight}px`,
            }}
            ref={canvasContainerRef}
          >
            {/* Standard SVG Graphics Layer */}
            <svg
              width={canvasWidth}
              height={canvasHeight}
              viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
              className="absolute inset-0 cursor-default"
              ref={svgRef}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
              onClick={() => setSelectedId(null)}
            >
              {/* Grid Overlays */}
              {renderGridPattern()}
              <rect width={canvasWidth} height={canvasHeight} fill="url(#majorGrid)" pointerEvents="none" />

              {/* Render each element on layout */}
              {elements.map((el) => {
                const isSelected = el.id === selectedId;
                const r = el.rotation || 0;
                const scale = el.scale || 1.0;

                // Dynamic bounds for polygons
                const isPolygon = el.type === 'geometry_polygon';
                const polyBounds = isPolygon ? getPolygonBounds(el.width, el.height, el.customSides || 6) : null;

                const boxX = polyBounds ? polyBounds.minX * scale - 2 : -2;
                const boxY = polyBounds ? polyBounds.minY * scale - 2 : -2;
                const boxWidth = polyBounds ? polyBounds.width * scale + 4 : el.width * scale + 4;
                const boxHeight = polyBounds ? polyBounds.height * scale + 4 : el.height * scale + 4;

                const rotateX = polyBounds ? ((polyBounds.minX + polyBounds.maxX) / 2) * scale : (el.width * scale) / 2;
                const rotateStartY = polyBounds ? polyBounds.minY * scale : 0;
                const rotateTargetY = polyBounds ? polyBounds.minY * scale - 15 : -15;

                // Rotated group transforms
                const transformStr = `translate(${el.x}, ${el.y}) rotate(${r}, ${(el.width * scale) / 2}, ${(el.height * scale) / 2})`;

                return (
                  <g
                    key={el.id}
                    transform={transformStr}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedId(el.id);
                      setSidebarTab('properties');
                    }}
                    onMouseDown={(e) => handleElementMouseDown(e, el.id)}
                    className="cursor-move group"
                  >
                    {/* Bounding hover highlight outline */}
                    <rect
                      x={boxX}
                      y={boxY}
                      width={boxWidth}
                      height={boxHeight}
                      fill="none"
                      stroke={isSelected ? '#D97706' : 'transparent'}
                      strokeWidth={isSelected ? '2' : '1'}
                      strokeDasharray={isSelected ? '0' : '4,4'}
                      className="group-hover:stroke-amber-600/60 transition-colors pointer-events-none"
                    />

                    {/* Specific structural styles (scaled) */}
                    {el.type === 'wall' && (
                      <g transform={`scale(${scale})`}>
                        <rect
                          x={0}
                          y={0}
                          width={el.width}
                          height={el.height}
                          fill={el.color || '#64748B'}
                          stroke={el.color || '#475569'}
                          strokeWidth="1"
                          rx={2}
                        />
                      </g>
                    )}

                    {el.type === 'door' && (
                      <g transform={`scale(${scale})`}>
                        {/* Swing dashed arc */}
                        <path
                          d={`M 0 0 A ${el.width} ${el.width} 0 0 1 ${el.width} ${el.width}`}
                          fill="none"
                          stroke={el.color || '#92400E'}
                          strokeWidth="1.5"
                          strokeDasharray="3,3"
                        />
                        {/* Gate post line */}
                        <line
                          x1={0}
                          y1={0}
                          x2={0}
                          y2={el.width}
                          stroke={el.color || '#B45309'}
                          strokeWidth="3.5"
                        />
                        {/* Wall edge proxies */}
                        <rect x={-4} y={-4} width={8} height={8} fill={el.color || '#475569'} />
                        <rect x={el.width - 4} y={el.width - 4} width={8} height={8} fill={el.color || '#475569'} />
                      </g>
                    )}

                    {el.type === 'window' && (
                      <g transform={`scale(${scale})`}>
                        <rect
                          x={0}
                          y={0}
                          width={el.width}
                          height={el.height}
                          fill={el.color ? `${el.color}1A` : '#E0F2FE'}
                          stroke={el.color || '#38BDF8'}
                          strokeWidth="2"
                        />
                        <line
                          x1={0}
                          y1={el.height / 2}
                          x2={el.width}
                          y2={el.height / 2}
                          stroke={el.color || '#0284C7'}
                          strokeWidth="1"
                        />
                      </g>
                    )}

                    {el.type === 'text' && (
                      <g transform={`scale(${scale})`}>
                        <rect
                          x={0}
                          y={0}
                          width={el.width}
                          height={el.height}
                          fill="#FAF7F2"
                          stroke={el.color || '#C9A96E'}
                          strokeWidth="1"
                          strokeDasharray="2,2"
                          rx={4}
                        />
                        <text
                          x={el.width / 2}
                          y={el.height / 2 + 4}
                          textAnchor="middle"
                          fontSize="11"
                          fontFamily="serif"
                          fontWeight="bold"
                          fill={el.color || '#78350F'}
                          className="select-none"
                        >
                          {el.textData || 'Double click to edit label'}
                        </text>
                      </g>
                    )}

                    {/* Geometry Group Rendering */}
                    {el.type === 'geometry_rect' && (
                      <g transform={`scale(${scale})`}>
                        <rect
                          x={0}
                          y={0}
                          width={el.width}
                          height={el.height}
                          rx={el.customCornerRadius || 0}
                          ry={el.customCornerRadius || 0}
                          fill={el.color ? `${el.color}1A` : '#D977061A'}
                          stroke={el.color || '#D97706'}
                          strokeWidth="2"
                        />
                        <text
                          x={el.width / 2}
                          y={el.height / 2 + 4}
                          textAnchor="middle"
                          fontSize="11"
                          fontFamily="serif"
                          fontWeight="bold"
                          fill={el.color || '#78350F'}
                          className="select-none"
                        >
                          {el.textData || ''}
                        </text>
                      </g>
                    )}

                    {el.type === 'geometry_square' && (
                      <g transform={`scale(${scale})`}>
                        <rect
                          x={0}
                          y={0}
                          width={el.width}
                          height={el.height}
                          rx={el.customCornerRadius || 0}
                          ry={el.customCornerRadius || 0}
                          fill={el.color ? `${el.color}1A` : '#D977061A'}
                          stroke={el.color || '#D97706'}
                          strokeWidth="2"
                        />
                        <text
                          x={el.width / 2}
                          y={el.height / 2 + 4}
                          textAnchor="middle"
                          fontSize="11"
                          fontFamily="serif"
                          fontWeight="bold"
                          fill={el.color || '#78350F'}
                          className="select-none"
                        >
                          {el.textData || ''}
                        </text>
                      </g>
                    )}

                    {el.type === 'geometry_circle' && (
                      <g transform={`scale(${scale})`}>
                        <circle
                          cx={el.width / 2}
                          cy={el.height / 2}
                          r={el.width / 2}
                          fill={el.color ? `${el.color}1A` : '#D977061A'}
                          stroke={el.color || '#D97706'}
                          strokeWidth="2"
                        />
                        <text
                          x={el.width / 2}
                          y={el.height / 2 + 4}
                          textAnchor="middle"
                          fontSize="11"
                          fontFamily="serif"
                          fontWeight="bold"
                          fill={el.color || '#78350F'}
                          className="select-none"
                        >
                          {el.textData || ''}
                        </text>
                      </g>
                    )}

                    {el.type === 'geometry_oval' && (
                      <g transform={`scale(${scale})`}>
                        <ellipse
                          cx={el.width / 2}
                          cy={el.height / 2}
                          rx={el.width / 2}
                          ry={el.height / 2}
                          fill={el.color ? `${el.color}1A` : '#D977061A'}
                          stroke={el.color || '#D97706'}
                          strokeWidth="2"
                        />
                        <text
                          x={el.width / 2}
                          y={el.height / 2 + 4}
                          textAnchor="middle"
                          fontSize="11"
                          fontFamily="serif"
                          fontWeight="bold"
                          fill={el.color || '#78350F'}
                          className="select-none"
                        >
                          {el.textData || ''}
                        </text>
                      </g>
                    )}

                    {el.type === 'geometry_polygon' && (() => {
                      const pb = polyBounds || getPolygonBounds(el.width, el.height, el.customSides || 6);
                      return (
                        <g transform={`scale(${scale})`}>
                          <polygon
                            points={pb.pts.join(' ')}
                            fill={el.color ? `${el.color}1A` : '#D977061A'}
                            stroke={el.color || '#D97706'}
                            strokeWidth="2"
                          />
                          <text
                            x={el.width / 2}
                            y={el.height / 2 + 4}
                            textAnchor="middle"
                            fontSize="11"
                            fontFamily="serif"
                            fontWeight="bold"
                            fill={el.color || '#78350F'}
                            className="select-none"
                          >
                            {el.textData || ''}
                          </text>
                        </g>
                      );
                    })()}

                    {el.type === 'table_proxy' && (
                      <g>
                        {(() => {
                          const table = tables.find(t => t.id === el.tableReferenceId);
                          if (table) {
                            return renderTableVector(el, table);
                          } else {
                            // Fallback missing representation
                            return (
                              <g>
                                <circle cx={el.width / 2} cy={el.height / 2} r={el.width * 0.4} fill="#FEE2E2" stroke="#EF4444" strokeWidth="2" />
                                <text x={el.width / 2} y={el.height / 2 + 3} textAnchor="middle" fontSize="10" fill="#B91C1C" fontWeight="bold">
                                  Missing Ref
                                </text>
                              </g>
                            );
                          }
                        })()}
                      </g>
                    )}

                    {/* Rotate control visual pointer */}
                    {isSelected && (
                      <line
                        x1={rotateX}
                        y1={rotateStartY}
                        x2={rotateX}
                        y2={rotateTargetY}
                        stroke="#D97706"
                        strokeWidth="1.5"
                      />
                    )}
                    {isSelected && (
                      <circle
                        cx={rotateX}
                        cy={rotateTargetY}
                        r={4}
                        fill="#D97706"
                        className="cursor-alias"
                      />
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="mt-4 text-center max-w-xl text-slate-400 text-[10px] font-mono leading-relaxed">
            Note: All coordinate metrics and translations scale to preserve correct physical distance proportions when exporting PDF blueprints. Use high DPI view zoom if necessary.
          </div>
        </main>
      </div>
    </div>
  );
}
