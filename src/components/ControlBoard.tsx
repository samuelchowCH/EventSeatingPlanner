/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */



/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, HardDrive, RefreshCw, Layers, Check, LayoutGrid, Award, GraduationCap } from 'lucide-react';
import { Table, Guest, TableTemplate, TemplateSeat } from '../types';

interface ControlBoardProps {
  tables: Table[];
  guests: Guest[];
  onAddTable: (
    name: string,
    maxSeats: number,
    shape: 'round' | 'rectangle' | 'square' | 'banquet' | 'banana' | 'nano' | 'custom' | 'seminar',
    customSeats?: TemplateSeat[],
    customShape?: 'Circle' | 'Rectangle' | 'Square' | 'Oval' | 'Semi-circle' | 'Quarter circle' | 'Polygon' | 'Long Banquet',
    customWidth?: number,
    customHeight?: number,
    customRadius?: number,
    customSides?: number,
    seminarRows?: number,
    seminarSeatsPerRow?: number,
    seminarDirection?: 'Top' | 'Bottom' | 'Left' | 'Right'
  ) => void;
  onNavigateToDesigner?: () => void;

  // Arena and Seminar mode states passed from App
  arenaMode: 'dining' | 'lecture';
  onChangeArenaMode: (mode: 'dining' | 'lecture') => void;
  seminarRows: number;
  onChangeSeminarRows: (rows: number) => void;
  seminarSeatsPerRow: number;
  onChangeSeminarSeatsPerRow: (seats: number) => void;
  seminarDirection: 'Top' | 'Bottom' | 'Left' | 'Right';
  onChangeSeminarDirection: (dir: 'Top' | 'Bottom' | 'Left' | 'Right') => void;
  isSeminarModeActive: boolean;
  onChangeSeminarModeActive: (active: boolean) => void;
}

export default function ControlBoard({
  tables,
  guests,
  onAddTable,
  onNavigateToDesigner,
  arenaMode,
  onChangeArenaMode,
  seminarRows,
  onChangeSeminarRows,
  seminarSeatsPerRow,
  onChangeSeminarSeatsPerRow,
  seminarDirection,
  onChangeSeminarDirection,
  isSeminarModeActive,
  onChangeSeminarModeActive,
}: ControlBoardProps) {
  const [newTableName, setNewTableName] = useState('');
  const [selectedShape, setSelectedShape] = useState<'round' | 'rectangle' | 'square' | 'banquet' | 'custom'>('round');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [templates, setTemplates] = useState<TableTemplate[]>([]);
  const [newTableCapacity, setNewTableCapacity] = useState(8);

  // Load templates from localStorage
  useEffect(() => {
    const cached = localStorage.getItem('seating_planner_templates');
    if (cached) {
      try {
        setTemplates(JSON.parse(cached));
      } catch (e) {
        console.error('Failed to parse templates', e);
      }
    }
  }, []);

  // Change default capacity based on selected shape
  const handleShapeSelect = (shape: 'round' | 'rectangle' | 'square' | 'banquet' | 'custom') => {
    setSelectedShape(shape);
    if (shape === 'round') setNewTableCapacity(8);
    else if (shape === 'rectangle') setNewTableCapacity(8);
    else if (shape === 'square') setNewTableCapacity(4);
    else if (shape === 'banquet') setNewTableCapacity(12);
    
    if (shape !== 'custom') {
      setSelectedTemplateId('');
    }
  };

  const handleAddTableSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (arenaMode === 'lecture') {
      const name = newTableName.trim() || `Lecture Segment ${tables.filter(t => t.shape === 'seminar').length + 1}`;
      onAddTable(
        name,
        seminarRows * seminarSeatsPerRow,
        'seminar',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        seminarRows,
        seminarSeatsPerRow,
        seminarDirection
      );
    } else if (selectedShape === 'custom') {
      const template = templates.find(t => t.id === selectedTemplateId);
      if (!template) return;
      const name = newTableName.trim() || `${template.name} ${tables.length + 1}`;
      onAddTable(
        name,
        template.seats.length,
        'custom',
        template.seats,
        template.shape,
        template.width,
        template.height,
        template.radius,
        template.sides
      );
    } else {
      const shapeLabel = selectedShape.charAt(0).toUpperCase() + selectedShape.slice(1);
      const name = newTableName.trim() || `${shapeLabel} ${tables.length + 1}`;
      onAddTable(name, newTableCapacity, selectedShape);
    }
    setNewTableName('');
  };


  const renderShapeIcon = (shape: 'round' | 'rectangle' | 'square' | 'banquet' | 'banana' | 'nano', isSelected: boolean) => {
    const tableColor = isSelected ? 'bg-gilded-accent' : 'bg-gilded-ink/30';
    const chairColor = isSelected ? 'bg-gilded-accent-muted' : 'bg-gilded-ink/20';

    if (shape === 'round') {
      return (
        <div className="relative w-12 h-12 flex items-center justify-center p-0.5">
          <img
            src={isSelected ? "/tables/circle_on.png" : "/tables/circle_off.png"}
            alt="Round Table"
            className="w-full h-full object-contain transition-all duration-200"
            referrerPolicy="no-referrer"
          />
        </div>
      );
    }

    if (shape === 'rectangle') {
      return (
        <div className="relative w-12 h-12 flex items-center justify-center p-0.5">
          <img
            src={isSelected ? "/tables/rect_on.png" : "/tables/rect_off.png"}
            alt="Rectangle Table"
            className="w-full h-full object-contain transition-all duration-200"
            referrerPolicy="no-referrer"
          />
        </div>
      );
    }

    if (shape === 'square') {
      return (
        <div className="relative w-12 h-12 flex items-center justify-center p-0.5">
          <img
            src={isSelected ? "/tables/squ_on.png" : "/tables/squ_off.png"}
            alt="Square Table"
            className="w-full h-full object-contain transition-all duration-200"
            referrerPolicy="no-referrer"
          />
        </div>
      );
    }

    if (shape === 'banana') {
      return (
        <div className="relative w-12 h-12 flex items-center justify-center">
          {/* Banana shape path */}
          <svg className="w-8 h-8 fill-none overflow-visible" viewBox="0 0 32 32">
            <path
              d="M 4 10 Q 16 26 28 10 Q 16 18 4 10"
              className={`${isSelected ? 'stroke-indigo-600 fill-indigo-600/10' : 'stroke-gray-400 fill-gray-400/5'} transition-colors duration-200`}
              strokeWidth="2"
            />
          </svg>
          {/* Minimal representation of chairs */}
          {[0, 1, 2, 3, 4].map((idx) => {
            const ratio = idx / 4;
            const x = 6 + ratio * 20;
            const y = [13, 17, 19, 17, 13][idx];
            return (
              <div
                key={`bn-${idx}`}
                className={`absolute w-1.5 h-1.5 rounded-full ${chairColor} transition-colors duration-200`}
                style={{
                  left: `${x}px`,
                  top: `${y}px`,
                }}
              />
            );
          })}
        </div>
      );
    }

    if (shape === 'nano') {
      return (
        <div className="relative w-12 h-12 flex items-center justify-center">
          {/* Pill / Capsule shape */}
          <div className={`w-8 h-4 rounded-full ${tableColor} transition-colors duration-200`} />
          {/* 6 chairs around the capsule */}
          {[-8, 0, 8].map((x, idx) => (
            <div
              key={`nn-${idx}`}
              className="absolute flex flex-col justify-between h-7"
              style={{ transform: `translateX(${x}px)` }}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${chairColor}`} />
              <div className={`w-1.5 h-1.5 rounded-full ${chairColor}`} />
            </div>
          ))}
        </div>
      );
    }

    // banquet
    return (
      <div className="relative w-12 h-12 flex items-center justify-center p-0.5">
        <img
          src={isSelected ? "/tables/banquet_on.png" : "/tables/banquet_off.png"}
          alt="Banquet Table"
          className="w-full h-full object-contain transition-all duration-200"
          referrerPolicy="no-referrer"
        />
      </div>
    );
  };

  return (
    <div className="w-full mb-6">
      
      {/* Block 1: Add Table Manual Form with Visual Shape Selection */}
      <div className="bg-white rounded-none border border-gilded-border p-5 shadow-xs flex flex-col justify-between w-full">
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gilded-border/40 pb-3 mb-4 gap-3">
            <h3 className="text-base font-serif font-medium text-gilded-ink tracking-tight flex items-center gap-1.5">
              <Plus size={15} className="text-gilded-accent" />
              Add Seating Table
            </h3>
            {/* Mode Shift Switcher */}
            <div className="flex rounded-lg bg-gray-100 p-0.5 border border-gray-200">
              <button
                type="button"
                onClick={() => {
                  onChangeArenaMode('dining');
                  onChangeSeminarModeActive(false);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  arenaMode === 'dining'
                    ? 'bg-gilded-ink text-white shadow-2xs font-bold'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Banquet Dining
              </button>
              <button
                type="button"
                onClick={() => {
                  onChangeArenaMode('lecture');
                  onChangeSeminarModeActive(false);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  arenaMode === 'lecture'
                    ? 'bg-gilded-ink text-white shadow-2xs font-bold'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Lecture Hall
              </button>
            </div>
          </div>
          <p className="text-[10px] text-gilded-ink/50 font-mono uppercase tracking-wider">
            {arenaMode === 'dining' 
              ? 'Select a layout and place a custom styled table'
              : 'Configure lecture rows to drag & drop or instant deploy'}
          </p>
        </div>

        <form onSubmit={handleAddTableSubmit} className="mt-4 space-y-3.5">
          {arenaMode === 'dining' ? (
            <>
              {/* Visual Table Shape Options Grid */}
              <div>
                <label className="block text-[10px] font-medium text-gilded-ink/60 uppercase tracking-widest font-mono mb-2">
                  Select Table Shape
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(['round', 'rectangle', 'square', 'banquet'] as const).map((shape) => {
                    const isSelected = selectedShape === shape;
                    const shapeName = 
                      shape === 'round' ? 'Round Table' :
                      shape === 'rectangle' ? 'Rectangle' :
                      shape === 'square' ? 'Square' : 'Banquet';
                    
                    return (
                      <button
                        key={shape}
                        type="button"
                        onClick={() => handleShapeSelect(shape)}
                        className={`relative p-2 rounded-none border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                          isSelected
                            ? 'border-gilded-accent bg-gilded-bg shadow-xs ring-1 ring-gilded-accent'
                            : 'border-gilded-border bg-gilded-bg/30 hover:bg-gilded-bg hover:border-gilded-accent/50'
                        }`}
                      >
                        {isSelected && (
                          <span className="absolute top-1.5 right-1.5 w-3 h-3 rounded-none bg-gilded-accent text-white flex items-center justify-center">
                            <Check size={8} strokeWidth={3} />
                          </span>
                        )}
                        {renderShapeIcon(shape, isSelected)}
                        <span className="text-[10px] font-semibold text-gilded-ink tracking-tight leading-none truncate w-full">
                          {shapeName}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Template Dropdown Selection */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider font-mono mb-1.5">
                  Or Use Custom Design Template
                </label>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => {
                      const tempId = e.target.value;
                      setSelectedTemplateId(tempId);
                      if (tempId) {
                        setSelectedShape('custom');
                        const temp = templates.find(t => t.id === tempId);
                        if (temp) {
                          setNewTableCapacity(temp.seats.length);
                          setNewTableName(temp.name);
                        }
                      } else {
                        handleShapeSelect('round');
                      }
                    }}
                    className="flex-1 text-xs font-sans bg-indigo-50/10 border border-indigo-100 rounded-none px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:bg-white cursor-pointer text-indigo-900 font-medium"
                  >
                    <option value="" className="text-gray-500">
                      {templates.length === 0 ? '-- No templates designed yet --' : '-- Select custom template --'}
                    </option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id} className="text-gray-700">
                        {t.name} ({t.seats.length} seats, {t.shape})
                      </option>
                    ))}
                  </select>

                  {onNavigateToDesigner && (
                    <button
                      type="button"
                      onClick={onNavigateToDesigner}
                      className="px-3 py-1.5 bg-gilded-accent hover:bg-gilded-accent-muted text-gilded-ink font-bold text-[10px] rounded-none border border-gilded-border hover:border-gilded-accent shadow-3xs transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
                    >
                      <Plus size={12} />
                      <span>Create custom table template</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[10px] font-medium text-gilded-ink/60 uppercase tracking-widest font-mono mb-1">
                    Table Name / Number
                  </label>
                  <input
                    type="text"
                    placeholder={selectedShape === 'custom' ? "Custom Table Name" : `${selectedShape.charAt(0).toUpperCase() + selectedShape.slice(1)} ${tables.length + 1}`}
                    value={newTableName}
                    onChange={(e) => setNewTableName(e.target.value)}
                    className="w-full bg-gilded-bg border border-gilded-border placeholder-gilded-ink/30 rounded-none px-3 py-1.5 text-xs font-sans text-gilded-ink focus:border-gilded-accent focus:bg-white outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-medium text-gilded-ink/60 uppercase tracking-widest font-mono mb-1">
                    Seats (Capacity)
                  </label>
                  <select
                    disabled={selectedShape === 'custom'}
                    value={newTableCapacity}
                    onChange={(e) => setNewTableCapacity(Number(e.target.value))}
                    className={`w-full text-xs font-sans bg-gilded-bg border border-gilded-border rounded-none px-2.5 py-1.5 text-gilded-ink focus:border-gilded-accent focus:bg-white cursor-pointer outline-none transition-all ${
                      selectedShape === 'custom' ? 'opacity-40 bg-gilded-faint cursor-not-allowed text-gilded-ink/40' : ''
                    }`}
                  >
                    {[4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16].map((num) => (
                      <option key={num} value={num}>{num} Chairs</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-1">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-gilded-ink hover:bg-gilded-accent text-white text-xs font-mono uppercase tracking-widest font-medium rounded-none transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                >
                  <Plus size={14} />
                  <span>Add Seating Table</span>
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Lecture Hall Row Matrix Configuration inside the card */}
              <div className="bg-[#FAF7F2]/40 border border-gilded-border/50 rounded-none p-3.5 space-y-3 animate-fadeIn">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-gilded-bg border border-gilded-border text-gilded-accent">
                    <LayoutGrid size={15} />
                  </span>
                  <div>
                    <span className="block text-[10px] font-bold text-gilded-ink uppercase tracking-wider font-serif">
                      Academic Seating Matrix
                    </span>
                    <span className="block text-[9px] text-gilded-ink/50 font-mono">
                      Classroom and lecture segment parameters
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5 text-xs pt-1">
                  <div>
                    <label className="block text-[10px] font-medium text-gilded-ink/60 uppercase tracking-widest font-mono mb-1">
                      Rows
                    </label>
                    <select
                      value={seminarRows}
                      onChange={(e) => onChangeSeminarRows(Number(e.target.value))}
                      className="w-full bg-gilded-bg border border-gilded-border rounded-none px-2 py-1.5 text-gilded-ink focus:border-gilded-accent focus:bg-white cursor-pointer outline-none text-xs font-sans transition-all"
                    >
                      {[2, 3, 4, 5, 6, 7, 8].map(r => (
                        <option key={r} value={r}>{r} Rows</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium text-gilded-ink/60 uppercase tracking-widest font-mono mb-1">
                      Seats/Row
                    </label>
                    <select
                      value={seminarSeatsPerRow}
                      onChange={(e) => onChangeSeminarSeatsPerRow(Number(e.target.value))}
                      className="w-full bg-gilded-bg border border-gilded-border rounded-none px-2 py-1.5 text-gilded-ink focus:border-gilded-accent focus:bg-white cursor-pointer outline-none text-xs font-sans transition-all"
                    >
                      {[4, 5, 6, 7, 8, 9, 10, 12, 14, 16].map(s => (
                        <option key={s} value={s}>{s} Seats</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium text-gilded-ink/60 uppercase tracking-widest font-mono mb-1">
                      Podium Side
                    </label>
                    <select
                      value={seminarDirection}
                      onChange={(e) => onChangeSeminarDirection(e.target.value as any)}
                      className="w-full bg-gilded-bg border border-gilded-border rounded-none px-2 py-1.5 text-gilded-ink focus:border-gilded-accent focus:bg-white cursor-pointer outline-none text-xs font-sans transition-all"
                    >
                      <option value="Top">Stage Top</option>
                      <option value="Bottom">Stage Bottom</option>
                      <option value="Left">Stage Left</option>
                      <option value="Right">Stage Right</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Lecture Segment Name Field */}
              <div className="grid grid-cols-1 gap-1">
                <label className="block text-[10px] font-medium text-gilded-ink/60 uppercase tracking-widest font-mono mb-1">
                  Lecture Row/Segment Name
                </label>
                <input
                  type="text"
                  placeholder={`Lecture Segment ${tables.filter(t => t.shape === 'seminar').length + 1}`}
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  className="w-full bg-gilded-bg border border-gilded-border placeholder-gilded-ink/30 rounded-none px-3 py-1.5 text-xs font-sans text-gilded-ink focus:border-gilded-accent focus:bg-white outline-none transition-all"
                />
              </div>

              <div className="pt-1">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-gilded-ink hover:bg-gilded-accent text-white text-xs font-mono uppercase tracking-widest font-medium rounded-none transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                >
                  <Plus size={14} />
                  <span>Instant Deploy Row</span>
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
