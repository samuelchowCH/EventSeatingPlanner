/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Table as SeatingTable, Guest, TemplateSeat, Event, CanvasElement, EventMetadata, TableStyle } from './types';
import UploadZone from './components/UploadZone';
import TableVisualizer from './components/TableVisualizer';
import GuestPanel from './components/GuestPanel';
import ControlBoard from './components/ControlBoard';
import PdfExportButton from './components/PdfExportButton';
import TentCardStudio from './components/TentCardStudio';
import TableDesigner from './components/TableDesigner';
import LayoutDesigner from './components/LayoutDesigner';
import { InvitationStudio } from './components/InvitationStudio';
import ProjectSetupWizard, { WizardFormData } from './components/ProjectSetupWizard';
import { autoAssignSeating, getSampleData, getLectureSampleData } from './utils/seatingHelper';
import { Users, LayoutGrid, ClipboardList, Utensils, Calendar, Sparkles, HelpCircle, Table, RefreshCw, Tag, Trash2, Palette, Layers, Check, Plus, Mail, X } from 'lucide-react';

export default function App() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [tables, setTables] = useState<SeatingTable[]>([]);
  const [defaultTableShape, setDefaultTableShape] = useState<'round' | 'rectangle' | 'square' | 'banquet' | 'banana' | 'nano' | 'custom'>('round');
  const [defaultTableSeats, setDefaultTableSeats] = useState<number>(8);
  const [selectedGuestForMoving, setSelectedGuestForMoving] = useState<Guest | null>(null);
  const [activeTab, setActiveTab] = useState<'events' | 'floorplan' | 'tentcards' | 'designer' | 'layout' | 'invitations'>('events');
  const [isClearingAllSeats, setIsClearingAllSeats] = useState(false);
  const [isWipingAllData, setIsWipingAllData] = useState(false);

  // Multi-event States
  const [events, setEvents] = useState<Event[]>([]);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const activeEvent = events.find((e) => e.id === activeEventId);
  const [layoutElements, setLayoutElements] = useState<CanvasElement[]>([]);
  const [newEventName, setNewEventName] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [showWizard, setShowWizard] = useState(false);

  // Gmail Header Connection Indicator State
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);

  const checkGmailStatus = async () => {
    try {
      const res = await fetch('/api/auth/google/status');
      if (res.ok) {
        const data = await res.json();
        setGmailConnected(Boolean(data.connected));
        setGmailEmail(data.email || null);
      }
    } catch (err) {}
  };

  useEffect(() => {
    checkGmailStatus();

    const handleSync = () => checkGmailStatus();
    window.addEventListener('hashchange', handleSync);
    window.addEventListener('gmail-status-changed', handleSync);
    const interval = setInterval(checkGmailStatus, 4000);

    return () => {
      window.removeEventListener('hashchange', handleSync);
      window.removeEventListener('gmail-status-changed', handleSync);
      clearInterval(interval);
    };
  }, []);

  const handleDisconnectGmailHeader = async () => {
    if (!confirm(`Disconnect connected Gmail account (${gmailEmail})?`)) return;
    try {
      const res = await fetch('/api/auth/google/disconnect', { method: 'POST' });
      if (res.ok) {
        setGmailConnected(false);
        setGmailEmail(null);
        window.dispatchEvent(new window.Event('gmail-status-changed'));
      } else if (res.status === 401) {
        setActiveTab('invitations');
        alert('Please authenticate as admin in Gmail Studio to disconnect the Gmail account.');
      }
    } catch (err) {}
  };

  // Seminar Matrix Row Generator States
  const [arenaMode, setArenaMode] = useState<'dining' | 'lecture'>('dining');
  const [isSeminarModeActive, setIsSeminarModeActive] = useState(false);
  const [seminarRows, setSeminarRows] = useState(4);
  const [seminarSeatsPerRow, setSeminarSeatsPerRow] = useState(8);
  const [seminarDirection, setSeminarDirection] = useState<'Top' | 'Bottom' | 'Left' | 'Right'>('Top');

  // Drag-to-select variables inside the floorplan area container
  const [isDraggingGrid, setIsDraggingGrid] = useState(false);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrentPos, setDragCurrentPos] = useState<{ x: number; y: number } | null>(null);

  const exportTentCardsRef = useRef<(() => void) | null>(null);
  const [isExportingTentCards, setIsExportingTentCards] = useState(false);
  const [exportTentCardsProgress, setExportTentCardsProgress] = useState('');

  const floorPlanAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isClearingAllSeats) {
      const timer = setTimeout(() => setIsClearingAllSeats(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isClearingAllSeats]);

  useEffect(() => {
    if (isWipingAllData) {
      const timer = setTimeout(() => setIsWipingAllData(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isWipingAllData]);

  // Load events and run migration
  useEffect(() => {
    const savedEvents = localStorage.getItem('seating_planner_events');
    const legacyGuests = localStorage.getItem('seating_planner_guests');
    const legacyTables = localStorage.getItem('seating_planner_tables');

    let loadedEvents: Event[] = [];
    if (savedEvents) {
      try {
        loadedEvents = JSON.parse(savedEvents);
      } catch (e) {
        console.error("Error parsing events:", e);
      }
    }

    // Check if migration is needed (legacy data exists but no events yet)
    if (loadedEvents.length === 0 && (legacyGuests || legacyTables)) {
      try {
        const migratedEvent: Event = {
          id: 'event_migrated_default',
          name: 'My First Seating Plan',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          guests: legacyGuests ? JSON.parse(legacyGuests) : [],
          tables: legacyTables ? JSON.parse(legacyTables) : [],
          layoutElements: JSON.parse(localStorage.getItem('seating_planner_layout_elements') || '[]'),
          defaultTableShape: (localStorage.getItem('seating_planner_default_shape') as any) || 'round',
          defaultTableSeats: Number(localStorage.getItem('seating_planner_default_seats') || '8'),
          arenaMode: 'dining'
        };
        loadedEvents = [migratedEvent];
        
        // Clean up legacy keys
        localStorage.removeItem('seating_planner_guests');
        localStorage.removeItem('seating_planner_tables');
        localStorage.removeItem('seating_planner_layout_elements');
        localStorage.removeItem('seating_planner_default_shape');
        localStorage.removeItem('seating_planner_default_seats');
      } catch (e) {
        console.error("Failed to migrate legacy data", e);
      }
    }

    // If still no events, load from sample or start with empty
    if (loadedEvents.length === 0) {
      const sample = getSampleData();
      const defaultEvent: Event = {
        id: `event_sample_${Date.now()}`,
        name: 'Wedding Banquet Sample',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        guests: sample.guests,
        tables: sample.tables,
        layoutElements: [
          { id: 'wall-1', type: 'wall', x: 50, y: 50, width: 742, height: 10, rotation: 0, scale: 1 },
          { id: 'wall-2', type: 'wall', x: 50, y: 50, width: 10, height: 495, rotation: 0, scale: 1 },
          { id: 'wall-3', type: 'wall', x: 50, y: 535, width: 742, height: 10, rotation: 0, scale: 1 },
          { id: 'wall-4', type: 'wall', x: 782, y: 50, width: 10, height: 495, rotation: 0, scale: 1 },
          { id: 'door-1', type: 'door', x: 400, y: 535, width: 60, height: 10, rotation: 0, scale: 1 },
          { id: 'text-stage', type: 'text', x: 350, y: 100, width: 140, height: 40, rotation: 0, scale: 1, textData: '★ PRINCIPAL STAGE ★' }
        ],
        defaultTableShape: 'round',
        defaultTableSeats: 8,
        arenaMode: 'dining'
      };
      loadedEvents = [defaultEvent];
    }

    setEvents(loadedEvents);
    
    // Choose active event (retrieve last active event id, or default to first event)
    const savedActiveId = localStorage.getItem('seating_planner_active_event_id');
    if (savedActiveId && loadedEvents.some(e => e.id === savedActiveId)) {
      setActiveEventId(savedActiveId);
      setActiveTab('floorplan');
    } else if (loadedEvents.length > 0) {
      setActiveEventId(loadedEvents[0].id);
      setActiveTab('floorplan');
    }
  }, []);

  // Save events list to local storage
  useEffect(() => {
    if (events.length > 0) {
      localStorage.setItem('seating_planner_events', JSON.stringify(events));
    }
  }, [events]);

  // Save active event ID to local storage
  useEffect(() => {
    if (activeEventId) {
      localStorage.setItem('seating_planner_active_event_id', activeEventId);
    }
  }, [activeEventId]);

  // Load active event data when activeEventId changes
  useEffect(() => {
    if (!activeEventId) return;
    const activeEvent = events.find(e => e.id === activeEventId);
    if (activeEvent) {
      setGuests(activeEvent.guests || []);
      setTables(activeEvent.tables || []);
      setDefaultTableShape(activeEvent.defaultTableShape || 'round');
      setDefaultTableSeats(activeEvent.defaultTableSeats || 8);
      setArenaMode(activeEvent.arenaMode || 'dining');
      setLayoutElements(activeEvent.layoutElements || []);
    }
  }, [activeEventId]);

  // Sync current active event fields back to events array
  useEffect(() => {
    if (!activeEventId) return;
    setEvents(prevEvents => 
      prevEvents.map(e => {
        if (e.id === activeEventId) {
          return {
            ...e,
            guests,
            tables,
            defaultTableShape,
            defaultTableSeats,
            arenaMode,
            layoutElements,
            updatedAt: Date.now()
          };
        }
        return e;
      })
    );
  }, [guests, tables, defaultTableShape, defaultTableSeats, arenaMode, layoutElements, activeEventId]);

  const handleCreateEvent = (
    name: string,
    date?: string,
    metadata?: EventMetadata,
    defaultTableShape: Event['defaultTableShape'] = 'round',
    defaultTableSeats: number = 8,
    arenaMode: 'dining' | 'lecture' = 'dining',
    aiTheme?: {
      fillColor: string; strokeColor: string; strokeWidth: number;
      backgroundColor: string; gridOpacity: number; name: string;
    }
  ) => {
    const customStyle: TableStyle | undefined = aiTheme ? {
      id: `ai_theme_${Date.now()}`,
      name: aiTheme.name,
      backgroundType: 'custom',
      fillColor: aiTheme.fillColor,
      strokeColor: aiTheme.strokeColor,
      strokeWidth: aiTheme.strokeWidth,
      backgroundColor: aiTheme.backgroundColor,
      gridOpacity: aiTheme.gridOpacity,
    } : undefined;

    const newEvent: Event = {
      id: `event_${Date.now()}`,
      name: name.trim() || `Event ${events.length + 1}`,
      date,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      guests: [],
      tables: [],
      layoutElements: [
        { id: 'wall-1', type: 'wall', x: 50, y: 50, width: 742, height: 10, rotation: 0, scale: 1 },
        { id: 'wall-2', type: 'wall', x: 50, y: 50, width: 10, height: 495, rotation: 0, scale: 1 },
        { id: 'wall-3', type: 'wall', x: 50, y: 535, width: 742, height: 10, rotation: 0, scale: 1 },
        { id: 'wall-4', type: 'wall', x: 782, y: 50, width: 10, height: 495, rotation: 0, scale: 1 },
        { id: 'door-1', type: 'door', x: 400, y: 535, width: 60, height: 10, rotation: 0, scale: 1 },
        { id: 'text-stage', type: 'text', x: 350, y: 100, width: 140, height: 40, rotation: 0, scale: 1, textData: '★ PRINCIPAL STAGE ★' }
      ],
      defaultTableShape,
      defaultTableSeats,
      arenaMode,
      metadata,
      customStyle,
    };
    setEvents(prev => [...prev, newEvent]);
    setActiveEventId(newEvent.id);
    setShowWizard(false);
    setActiveTab('floorplan');
  };

  const handleDeleteEvent = (id: string) => {
    const updatedEvents = events.filter(e => e.id !== id);
    setEvents(updatedEvents);
    if (activeEventId === id) {
      if (updatedEvents.length > 0) {
        setActiveEventId(updatedEvents[0].id);
      } else {
        setActiveEventId(null);
        setActiveTab('events');
      }
    }
  };


  // Seating plan handlers
  const handleSeatGuest = (guestId: string, tableId: string, seatIndex: number) => {
    setGuests((prevGuests) => {
      const occupiedGuest = prevGuests.find((g) => g.tableId === tableId && g.seatIndex === seatIndex);
      return prevGuests.map((g) => {
        if (g.id === occupiedGuest?.id) {
          return { ...g, tableId: null, seatIndex: null };
        }
        if (g.id === guestId) {
          return { ...g, tableId, seatIndex };
        }
        return g;
      });
    });
    setSelectedGuestForMoving(null);
  };

  const handleUnseatGuest = (guestId: string) => {
    setGuests((prev) =>
      prev.map((g) => {
        if (g.id === guestId) {
          return { ...g, tableId: null, seatIndex: null };
        }
        return g;
      })
    );
  };

  const handleSwapGuests = (guestAId: string, guestBId: string) => {
    setGuests((prev) => {
      const guestA = prev.find((g) => g.id === guestAId);
      const guestB = prev.find((g) => g.id === guestBId);
      if (!guestA || !guestB) return prev;

      const tableA = guestA.tableId;
      const seatA = guestA.seatIndex;
      const tableB = guestB.tableId;
      const seatB = guestB.seatIndex;

      return prev.map((g) => {
        if (g.id === guestAId) {
          return { ...g, tableId: tableB, seatIndex: seatB };
        }
        if (g.id === guestBId) {
          return { ...g, tableId: tableA, seatIndex: seatA };
        }
        return g;
      });
    });
  };

  const handleUpdateGuest = (guestId: string, updates: Partial<Guest>) => {
    setGuests((prev) =>
      prev.map((g) => (g.id === guestId ? { ...g, ...updates } : g))
    );
  };

  const handleClearTableGuests = (tableId: string) => {
    setGuests((prev) =>
      prev.map((g) => {
        if (g.tableId === tableId) {
          return { ...g, tableId: null, seatIndex: null };
        }
        return g;
      })
    );
  };

  const handleResetTableGuestPositions = (tableId: string) => {
    setGuests((prev) =>
      prev.map((g) => {
        if (g.tableId === tableId) {
          return { ...g, offsetX: undefined, offsetY: undefined };
        }
        return g;
      })
    );
  };

  const handleAddTable = (
    name: string,
    maxSeats: number,
    shape: 'round' | 'rectangle' | 'square' | 'banquet' | 'banana' | 'nano' | 'custom' | 'seminar' = 'round',
    customSeats?: TemplateSeat[],
    customShape?: 'Circle' | 'Rectangle' | 'Square' | 'Oval' | 'Semi-circle' | 'Quarter circle' | 'Polygon' | 'Long Banquet',
    customWidth?: number,
    customHeight?: number,
    customRadius?: number,
    customSides?: number,
    seminarRows?: number,
    seminarSeatsPerRow?: number,
    seminarDirection?: 'Top' | 'Bottom' | 'Left' | 'Right'
  ) => {
    const tableColors = [
      '#C9A96E', // Gilded Gold
      '#2C2C2C', // Deep Ink
      '#6B5E4F', // Warm Taupe
      '#738276', // Sage Green
      '#3E4A56', // Deep Steel
      '#8A7968', // Warm Clay
      '#A87E60', // Bronze
    ];

    setTables((prevTables) => {
      const newTable: SeatingTable = {
        id: `table_user_${Date.now()}`,
        name,
        maxSeats,
        color: shape === 'seminar' ? '#4F46E5' : tableColors[prevTables.length % tableColors.length],
        shape,
        customSeats,
        customShape,
        customWidth,
        customHeight,
        customRadius,
        customSides,
        seminarRows,
        seminarSeatsPerRow,
        seminarDirection,
        scale: 1.0,
      };
      return [...prevTables, newTable];
    });
  };

  const handleContainerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSeminarModeActive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + e.currentTarget.scrollLeft;
    const y = e.clientY - rect.top + e.currentTarget.scrollTop;
    
    setIsDraggingGrid(true);
    setDragStartPos({ x, y });
    setDragCurrentPos({ x, y });
  };

  const handleContainerMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingGrid || !dragStartPos) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + e.currentTarget.scrollLeft;
    const y = e.clientY - rect.top + e.currentTarget.scrollTop;
    setDragCurrentPos({ x, y });
  };

  const handleContainerMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingGrid || !dragStartPos || !dragCurrentPos) return;
    
    const dx = Math.abs(dragCurrentPos.x - dragStartPos.x);
    const dy = Math.abs(dragCurrentPos.y - dragStartPos.y);
    
    if (dx > 25 && dy > 25) {
      const nextNum = tables.filter(t => t.shape === 'seminar').length + 1;
      const newTable: SeatingTable = {
        id: `table_seminar_${Date.now()}`,
        name: `Lecture Segment ${nextNum}`,
        maxSeats: seminarRows * seminarSeatsPerRow,
        color: '#4F46E5', // Royal Gilded Indigo accent theme
        shape: 'seminar',
        seminarRows: seminarRows,
        seminarSeatsPerRow: seminarSeatsPerRow,
        seminarDirection: seminarDirection,
        scale: 1.0,
      };
      setTables((prev) => [...prev, newTable]);
    }
    
    setIsDraggingGrid(false);
    setDragStartPos(null);
    setDragCurrentPos(null);
  };

  const handleAddTableFromTemplate = (
    name: string,
    maxSeats: number,
    customSeats: TemplateSeat[],
    customShape?: 'Circle' | 'Rectangle' | 'Square' | 'Oval' | 'Semi-circle' | 'Quarter circle' | 'Polygon' | 'Long Banquet',
    customWidth?: number,
    customHeight?: number,
    customRadius?: number,
    customSides?: number
  ) => {
    const tableColors = [
      '#C9A96E', // Gilded Gold
      '#2C2C2C', // Deep Ink
      '#6B5E4F', // Warm Taupe
      '#738276', // Sage Green
      '#3E4A56', // Deep Steel
      '#8A7968', // Warm Clay
      '#A87E60', // Bronze
    ];

    setTables((prevTables) => {
      const newTable: SeatingTable = {
        id: `table_template_${Date.now()}`,
        name,
        maxSeats,
        color: tableColors[prevTables.length % tableColors.length],
        shape: 'custom',
        customSeats,
        customShape,
        customWidth,
        customHeight,
        customRadius,
        customSides,
      };
      return [...prevTables, newTable];
    });
  };

  const handleUpdateTable = (tableId: string, updates: Partial<SeatingTable>) => {
    setTables((prevTables) =>
      prevTables.map((t) => {
        if (t.id === tableId) {
          const updatedTable = { ...t, ...updates };
          
          // If capacity is reduced, unseat guests whose index now exceeds the new capacity
          if (updates.maxSeats && updates.maxSeats < t.maxSeats) {
            setGuests((prevGuests) =>
              prevGuests.map((g) => {
                if (g.tableId === tableId && g.seatIndex !== null && g.seatIndex >= (updates.maxSeats ?? 0)) {
                  return { ...g, tableId: null, seatIndex: null };
                }
                return g;
              })
            );
          }
          return updatedTable;
        }
        return t;
      })
    );
  };

  const handleBatchApplyTableSettings = (sourceTableId: string, updates: Partial<SeatingTable>) => {
    setTables((prevTables) =>
      prevTables.map((t) => {
        if (t.id !== sourceTableId) {
          const updatedTable = {
            ...t,
            maxSeats: updates.maxSeats !== undefined ? updates.maxSeats : t.maxSeats,
            color: updates.color !== undefined ? updates.color : t.color,
            shape: updates.shape !== undefined ? updates.shape : t.shape,
            fontColor: updates.fontColor !== undefined ? updates.fontColor : t.fontColor,
            fontSize: updates.fontSize !== undefined ? updates.fontSize : t.fontSize,
            scale: updates.scale !== undefined ? updates.scale : t.scale,
            showSeatNumbers: updates.showSeatNumbers !== undefined ? updates.showSeatNumbers : t.showSeatNumbers,
          };

          // If capacity is reduced, unseat guests whose index now exceeds the new capacity
          if (updates.maxSeats && updates.maxSeats < t.maxSeats) {
            setGuests((prevGuests) =>
              prevGuests.map((g) => {
                if (g.tableId === t.id && g.seatIndex !== null && g.seatIndex >= (updates.maxSeats ?? 0)) {
                  return { ...g, tableId: null, seatIndex: null };
                }
                return g;
              })
            );
          }
          return updatedTable;
        }
        return t;
      })
    );
  };

  const handleDeleteTable = (tableId: string) => {
    // Unseat all guests assigned here
    setGuests((prev) =>
      prev.map((g) => {
        if (g.tableId === tableId) {
          return { ...g, tableId: null, seatIndex: null };
        }
        return g;
      })
    );
    // Remove table record
    setTables((prevTables) => prevTables.filter((t) => t.id !== tableId));
  };

  const handleBulkApplyDefaults = () => {
    setTables((prevTables) => {
      return prevTables.map((t) => {
        const isCustomDefault = defaultTableShape === 'custom';
        return {
          ...t,
          shape: isCustomDefault ? t.shape : defaultTableShape,
          maxSeats: defaultTableSeats,
        };
      });
    });
  };

  const handleAutoSeatGuests = (fillExisting: boolean, tableCapacity: number, createTablesIfNeeded: boolean) => {
    const { updatedGuests, updatedTables } = autoAssignSeating(guests, tables, {
      fillExisting,
      tableCapacity,
      createTablesIfNeeded,
    });
    setGuests(updatedGuests);
    setTables(updatedTables);
  };

  const handleClearAllSeating = () => {
    setGuests(
      guests.map((g) => ({
        ...g,
        tableId: null,
        seatIndex: null,
      }))
    );
  };

  const handleWipeAllData = () => {
    setGuests([]);
    setTables([]);
    localStorage.setItem('seating_planner_guests', JSON.stringify([]));
    localStorage.setItem('seating_planner_tables', JSON.stringify([]));
    localStorage.setItem('seating_planner_initialized', 'true');
  };

  const handleLoadTemplateData = () => {
    const sample = arenaMode === 'lecture' ? getLectureSampleData() : getSampleData();
    setGuests(sample.guests);
    setTables(sample.tables);
  };

  const handleDataLoaded = (loadedGuests: Guest[], loadedTables: SeatingTable[], append: boolean) => {
    if (append) {
      // Find out if we have name overlaps, if so, preserve
      const mergedGuests = [...guests];
      loadedGuests.forEach((lg) => {
        if (!mergedGuests.some((mg) => mg.name === lg.name)) {
          mergedGuests.push(lg);
        }
      });

      const mergedTables = [...tables];
      loadedTables.forEach((lt) => {
        if (!mergedTables.some((mt) => mt.name === lt.name)) {
          mergedTables.push(lt);
        }
      });

      setGuests(mergedGuests);
      setTables(mergedTables);
    } else {
      setGuests(loadedGuests);
      setTables(loadedTables);
    }
  };

  // Directory Stats Calculations
  const totalGuestsCount = guests.length;
  const seatedGuestsCount = guests.filter((g) => g.tableId !== null).length;
  const unassignedGuests = guests.filter((g) => g.tableId === null);
  const totalChairsCapacity = tables.reduce((sum, t) => sum + t.maxSeats, 0);
  const designOverage = totalChairsCapacity - totalGuestsCount;
  const seatProgressPercent = totalGuestsCount > 0 ? Math.round((seatedGuestsCount / totalGuestsCount) * 100) : 0;
  const uniqueGroupsCount = new Set(guests.map((g) => g.group || 'Individual')).size;
  const dietaryRestrictionsCount = guests.filter((g) => g.notes && g.notes !== '').length;

  const lectureTables = tables.filter((t) => t.shape === 'seminar');
  const totalRows = lectureTables.reduce((sum, t) => sum + (t.seminarRows || 0), 0);
  const avgSeatsPerRow = lectureTables.length > 0
    ? Math.round(lectureTables.reduce((sum, t) => sum + (t.seminarSeatsPerRow || 0), 0) / lectureTables.length)
    : seminarSeatsPerRow;

  return (
    <div className="min-h-screen bg-gilded-bg text-gilded-ink antialiased font-sans">

      {/* Project Setup Wizard Overlay */}
      {showWizard && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-gray-950/95 backdrop-blur-sm">
          <ProjectSetupWizard
            onCreateEvent={handleCreateEvent}
            onCancel={() => setShowWizard(false)}
          />
        </div>
      )}
      
      {/* Upper Navigation Dashboard Header */}
      <header className="bg-white border-b border-gilded-border sticky top-0 z-40">
        <div className="max-w-[96%] mx-auto px-4 sm:px-6 lg:px-8 py-3.5 grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div className="flex items-center gap-3 justify-start">
            <div className="bg-gilded-ink text-gilded-accent p-2.5 rounded-none shadow-xs">
              <Table size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gilded-ink tracking-tight font-serif">
                Seating Planner
              </h1>
            </div>
          </div>

          {/* Segmented Control Tabs */}
          <div className="flex bg-gilded-faint p-1 rounded-none border border-gilded-border justify-center mx-auto">
            <button
              onClick={() => setActiveTab('events')}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-none transition-all cursor-pointer font-sans border ${
                activeTab === 'events'
                  ? 'bg-gilded-accent text-gilded-ink shadow-3xs border-gilded-border'
                  : 'border-transparent text-gray-500 hover:text-gilded-ink'
              }`}
            >
              <Calendar size={13} />
              <span>Events</span>
            </button>
            <button
              disabled={!activeEventId}
              onClick={() => setActiveTab('floorplan')}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-none transition-all cursor-pointer font-sans border disabled:opacity-40 disabled:cursor-not-allowed ${
                activeTab === 'floorplan'
                  ? 'bg-gilded-accent text-gilded-ink shadow-3xs border-gilded-border'
                  : 'border-transparent text-gray-500 hover:text-gilded-ink'
              }`}
            >
              <LayoutGrid size={13} />
              <span>Seating Workspace</span>
            </button>
            <button
              disabled={!activeEventId}
              onClick={() => setActiveTab('tentcards')}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-none transition-all cursor-pointer font-sans border disabled:opacity-40 disabled:cursor-not-allowed ${
                activeTab === 'tentcards'
                  ? 'bg-gilded-accent text-gilded-ink shadow-3xs border-gilded-border'
                  : 'border-transparent text-gray-500 hover:text-gilded-ink'
              }`}
            >
              <Tag size={13} />
              <span>Tent Card Studio</span>
            </button>
            <button
              disabled={!activeEventId}
              onClick={() => setActiveTab('designer')}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-none transition-all cursor-pointer font-sans border disabled:opacity-40 disabled:cursor-not-allowed ${
                activeTab === 'designer'
                  ? 'bg-gilded-accent text-gilded-ink shadow-3xs border-gilded-border'
                  : 'border-transparent text-gray-500 hover:text-gilded-ink'
              }`}
            >
              <Palette size={13} />
              <span>Table Builder</span>
            </button>

            <button
              disabled={!activeEventId}
              onClick={() => setActiveTab('layout')}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-none transition-all cursor-pointer font-sans border disabled:opacity-40 disabled:cursor-not-allowed ${
                activeTab === 'layout'
                  ? 'bg-gilded-accent text-gilded-ink shadow-3xs border-gilded-border'
                  : 'border-transparent text-gray-500 hover:text-gilded-ink'
              }`}
            >
              <Layers size={13} />
              <span>Layout Designer</span>
            </button>
            <button
              disabled={!activeEventId}
              onClick={() => setActiveTab('invitations')}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-none transition-all cursor-pointer font-sans border disabled:opacity-40 disabled:cursor-not-allowed ${
                activeTab === 'invitations'
                  ? 'bg-gilded-accent text-gilded-ink shadow-3xs border-gilded-border'
                  : 'border-transparent text-gray-500 hover:text-gilded-ink'
              }`}
            >
              <Mail size={13} />
              <span>Gmail Studio</span>
            </button>
          </div>

          <div className="flex items-center gap-3 justify-end min-h-[38px]">
            {gmailConnected && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-mono font-semibold shadow-3xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="truncate max-w-[140px] sm:max-w-[200px]" title={gmailEmail || ''}>
                  Gmail: {gmailEmail}
                </span>
                <button
                  onClick={handleDisconnectGmailHeader}
                  className="ml-1 text-gray-400 hover:text-red-600 cursor-pointer"
                  title="Disconnect Gmail Account"
                >
                  <X size={13} />
                </button>
              </div>
            )}

            <div className={activeEventId && activeTab !== 'events' ? 'block' : 'invisible pointer-events-none'}>
              <PdfExportButton
                guests={guests}
                tables={tables}
                floorPlanRef={floorPlanAreaRef}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                exportTentCardsRef={exportTentCardsRef}
                isExportingTentCards={isExportingTentCards}
                exportTentCardsProgress={exportTentCardsProgress}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Primary Workspace container */}
      {activeTab === 'events' || !activeEventId ? (
        <main className="max-w-[96%] mx-auto px-4 sm:px-6 lg:px-8 py-6 animate-fadeIn">
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-3xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-50 pb-4 mb-6 gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 tracking-tight font-serif flex items-center gap-2">
                  <Calendar className="text-gilded-accent" size={22} />
                  <span>Events Manager</span>
                </h2>
                <p className="text-xs text-gray-400 font-mono mt-1">
                  Create, load, or delete your banquet and lecture event seating configurations.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column: Create New Event CTA */}
              <div className="lg:col-span-1 bg-slate-50 border border-slate-100 p-5 rounded-xl flex flex-col">
                <h3 className="text-xs font-bold text-gray-900 tracking-wide uppercase font-mono mb-4 flex items-center gap-1.5">
                  <Sparkles size={13} className="text-[#C9A96E]" />
                  Create New Event
                </h3>
                <p className="text-xs text-gray-500 font-mono mb-5 leading-relaxed">
                  Use the guided setup wizard to configure your event name, venue, guest count, seating defaults, and optional AI-generated theme — all in under a minute.
                </p>
                <button
                  type="button"
                  onClick={() => setShowWizard(true)}
                  className="w-full py-2.5 bg-gilded-ink text-gilded-accent hover:bg-black font-bold rounded-lg transition-colors cursor-pointer text-[10px] uppercase tracking-widest border border-gilded-border flex items-center justify-center gap-2"
                >
                  <Plus size={12} />
                  <span>Launch Setup Wizard</span>
                </button>
              </div>

              {/* Right Column: Events List Grid */}
              <div className="lg:col-span-2 space-y-4">
                <h3 className="text-xs font-bold text-gray-900 tracking-wide uppercase font-mono flex items-center justify-between">
                  <span>Your Seating Plans ({events.length})</span>
                </h3>
                {events.length === 0 ? (
                  <div className="text-center py-12 bg-gray-55/10 rounded-xl border-2 border-dashed border-gray-100">
                    <Calendar size={28} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-xs text-gray-400 font-mono">No seating plans found. Create one using the form on the left.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {events.map((evt) => {
                      const totalGuests = evt.guests?.length || 0;
                      const seatedGuests = evt.guests?.filter(g => g.tableId !== null).length || 0;
                      const progress = totalGuests > 0 ? Math.round((seatedGuests / totalGuests) * 100) : 0;
                      const isActive = activeEventId === evt.id;

                      return (
                        <div
                          key={evt.id}
                          className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                            isActive
                              ? 'bg-white border-gilded-accent shadow-xs ring-1 ring-gilded-accent'
                              : 'bg-white border-gray-100 shadow-3xs hover:border-gray-300'
                          }`}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-bold text-sm text-gray-900 line-clamp-1 font-serif">
                                {evt.name}
                              </h4>
                              {isActive && (
                                <span className="bg-emerald-50 text-emerald-700 text-[9px] uppercase font-mono px-2 py-0.5 rounded-full font-bold border border-emerald-200 flex items-center gap-0.5">
                                  <Check size={8} /> Active
                                </span>
                              )}
                            </div>
                            {evt.date && (
                              <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                                Date: {evt.date}
                              </p>
                            )}
                            <p className="text-[9px] text-gray-400 font-mono mt-1">
                              Created: {new Date(evt.createdAt).toLocaleDateString()}
                            </p>

                            <div className="mt-4 space-y-1.5">
                              <div className="flex justify-between text-[10px] font-mono text-gray-500">
                                <span>Tables: {evt.tables?.length || 0}</span>
                                <span>Guests: {seatedGuests}/{totalGuests}</span>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-[#C9A96E] h-1.5 rounded-full transition-all duration-300"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-55/10">
                            <button
                              onClick={() => {
                                setActiveEventId(evt.id);
                                setActiveTab('floorplan');
                              }}
                              className="flex-1 py-1.5 bg-gilded-ink hover:bg-black text-gilded-accent text-[11px] font-bold font-serif uppercase tracking-wider rounded-none border border-gilded-border transition-colors cursor-pointer text-center"
                            >
                              Open Seating Plan
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete "${evt.name}"? This action cannot be undone.`)) {
                                  handleDeleteEvent(evt.id);
                                }
                              }}
                              className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg border border-red-100 transition-colors cursor-pointer"
                              title="Delete Plan"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      ) : activeTab === 'floorplan' ? (
        <main className="max-w-[96%] mx-auto px-4 sm:px-6 lg:px-8 py-6">

          
          {/* At-a-glance Statistics Ribbon */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-3xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest font-mono">Total Guests</span>
                <Users size={16} className="text-gray-400" />
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-1 font-sans">{totalGuestsCount}</p>
              <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2 overflow-hidden">
                <div 
                  className={`${arenaMode === 'lecture' ? 'bg-[#C9A96E]' : 'bg-indigo-600'} h-1.5 rounded-full transition-all duration-500`} 
                  style={{ width: `${seatProgressPercent}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-500 mt-1.5 font-mono">{seatedGuestsCount} seated ({seatProgressPercent}%)</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-3xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest font-mono">Unseated</span>
                <ClipboardList size={16} className="text-amber-500" />
              </div>
              <p className="text-2xl font-bold text-amber-600 mt-1 font-sans">{unassignedGuests.length}</p>
              <p className="text-[10px] text-gray-500 mt-3 font-mono">Requires seating placement</p>
            </div>

            {arenaMode === 'dining' ? (
              <>
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-3xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest font-mono">Total Tables</span>
                    <LayoutGrid size={16} className="text-gray-400" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900 mt-1 font-sans">{tables.filter(t => t.shape !== 'seminar').length}</p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-3xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest font-mono">Dietary Alerts</span>
                    <Utensils size={16} className="text-amber-500" />
                  </div>
                  <p className="text-2xl font-bold text-amber-600 mt-1 font-sans">{dietaryRestrictionsCount}</p>
                </div>
              </>
            ) : (
              <>
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-3xs animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#C9A96E] uppercase tracking-widest font-mono font-bold">Total Rows</span>
                    <LayoutGrid size={16} className="text-[#C9A96E]" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900 mt-1 font-sans">{totalRows}</p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-3xs animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#C9A96E] uppercase tracking-widest font-mono font-bold">Total Seats/Row</span>
                    <Users size={16} className="text-[#C9A96E]" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900 mt-1 font-sans">{avgSeatsPerRow}</p>
                </div>
              </>
            )}
          </section>

          {/* Master Double-Column Workspace */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Column A (Left 2/3): Interactive Arena */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Control Panel Block */}
              <ControlBoard
                tables={tables}
                guests={guests}
                onAddTable={handleAddTable}
                onNavigateToDesigner={() => setActiveTab('designer')}
                arenaMode={arenaMode}
                onChangeArenaMode={setArenaMode}
                seminarRows={seminarRows}
                onChangeSeminarRows={setSeminarRows}
                seminarSeatsPerRow={seminarSeatsPerRow}
                onChangeSeminarSeatsPerRow={setSeminarSeatsPerRow}
                seminarDirection={seminarDirection}
                onChangeSeminarDirection={setSeminarDirection}
                isSeminarModeActive={isSeminarModeActive}
                onChangeSeminarModeActive={setIsSeminarModeActive}
              />

              {/* Importer component */}
              <UploadZone
                onDataLoaded={handleDataLoaded}
                existingTablesCount={tables.length}
                defaultTableShape={defaultTableShape}
                defaultTableSeats={defaultTableSeats}
                arenaMode={arenaMode}
              />

              {/* Seating plan visualizer canvas */}
              <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-xs">
                <div className="flex items-center justify-between mb-4 border-b border-gray-50 pb-3 flex-wrap gap-3">
                  <div>
                    <h2 className="text-base font-bold text-gray-900 tracking-tight font-sans flex items-center gap-2">
                      <span>Seating Floorplan Arena</span>
                      <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full font-bold ${
                        arenaMode === 'dining' 
                          ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                          : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                      }`}>
                        {arenaMode === 'dining' ? '🍽️ Banquet Mode' : '🎓 Lecture Mode'}
                      </span>
                    </h2>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">
                      {arenaMode === 'dining' 
                        ? 'Click a vacant chair, drop a guest, or select any seat to perform standard moves and swaps.'
                        : 'Deploy seminar rows facing the podium, or drag guest capsules onto classroom tables.'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2" data-html2canvas-ignore="true">
                    <button
                      onClick={handleLoadTemplateData}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-55/10 hover:bg-emerald-55/20 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-100 transition-colors cursor-pointer font-sans"
                    >
                      <Calendar size={13} className="text-emerald-600" />
                      <span>Load Samples</span>
                    </button>
                    <button
                      onClick={() => {
                        if (isClearingAllSeats) {
                          handleClearAllSeating();
                          setIsClearingAllSeats(false);
                        } else {
                          setIsClearingAllSeats(true);
                        }
                      }}
                      disabled={guests.every(g => g.tableId === null)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold rounded-lg border transition-all cursor-pointer font-sans ${
                        isClearingAllSeats
                          ? 'bg-amber-600 border-amber-600 text-white hover:bg-amber-700 font-bold'
                          : 'bg-amber-50 border-amber-100 text-amber-700 hover:bg-amber-100'
                      }`}
                    >
                      <RefreshCw size={13} className={isClearingAllSeats ? 'text-white' : 'text-amber-600'} />
                      <span>{isClearingAllSeats ? 'Confirm Clear All?' : 'Clear Seats'}</span>
                    </button>
                    <button
                      onClick={() => {
                        if (isWipingAllData) {
                          handleWipeAllData();
                          setIsWipingAllData(false);
                        } else {
                          setIsWipingAllData(true);
                        }
                      }}
                      disabled={guests.length === 0 && tables.length === 0}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold rounded-lg border transition-all cursor-pointer font-sans ${
                        isWipingAllData
                          ? 'bg-red-600 border-red-600 text-white hover:bg-red-700 font-bold animate-pulse'
                          : 'bg-red-50 border-red-100 text-red-700 hover:bg-red-100'
                      }`}
                    >
                      <Trash2 size={13} className={isWipingAllData ? 'text-white' : 'text-red-500'} />
                      <span>{isWipingAllData ? 'Confirm Wipe All?' : 'Wipe Arena'}</span>
                    </button>
                  </div>
                </div>

                {/* Default Table Setup Control Bar */}
                {arenaMode === 'dining' && (
                  <div className="mb-6 p-4 bg-slate-50 border border-slate-100 rounded-none flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" data-html2canvas-ignore="true">
                    <div className="flex flex-col gap-0.5">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gilded-ink tracking-wider uppercase font-mono">
                        <Sparkles size={11} className="text-gilded-accent" /> Default Table Configuration
                      </span>
                      <span className="text-xs text-gray-500 font-sans">
                        Configure layout styles for raw data uploads or newly added tables:
                      </span>
                    </div>

                    <div className="flex items-center gap-3.5 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-400 font-semibold font-mono uppercase tracking-wider">Shape</span>
                        <select
                          value={defaultTableShape}
                          onChange={(e) => setDefaultTableShape(e.target.value as any)}
                          className="text-xs border border-gray-200 rounded-none px-2.5 py-1.5 bg-white font-sans focus:ring-1 focus:ring-gilded-accent cursor-pointer"
                        >
                          <option value="round">Round Table</option>
                          <option value="rectangle">Rectangle Table</option>
                          <option value="square">Square Table</option>
                          <option value="banquet">Long Banquet Table</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-400 font-semibold font-mono uppercase tracking-wider">Seats</span>
                        <select
                          value={defaultTableSeats}
                          onChange={(e) => setDefaultTableSeats(Number(e.target.value))}
                          className="text-xs border border-gray-200 rounded-none px-2.5 py-1.5 bg-white font-sans focus:ring-1 focus:ring-gilded-accent cursor-pointer"
                        >
                          {[4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16].map((num) => (
                            <option key={num} value={num}>{num} Seats</option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={handleBulkApplyDefaults}
                        disabled={tables.length === 0}
                        className="text-xs font-bold bg-gilded-ink hover:bg-black text-gilded-accent disabled:opacity-30 disabled:pointer-events-none px-3.5 py-1.5 rounded-none border border-gilded-border transition-all shadow-3xs cursor-pointer flex items-center gap-1.5 font-sans uppercase tracking-wider"
                      >
                        Apply to All Tables
                      </button>
                    </div>
                  </div>
                )}

                {tables.length === 0 ? (
                  <div className="text-center py-16 border-2 border-dashed border-gray-100 rounded-none bg-gray-55/10">
                    <Table size={40} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-sm font-semibold text-gray-700 font-serif">No tables created in seating plan</p>
                    <p className="text-xs text-gray-400 mt-1 font-mono max-w-sm mx-auto">
                      Create a table manually with the controls above or load our pre-configured wedding dinner registry simulation.
                    </p>
                    <button
                      onClick={handleLoadTemplateData}
                      className="mt-4 px-4.5 py-2 bg-gilded-ink hover:bg-black text-gilded-accent rounded-none text-xs font-sans font-bold uppercase tracking-wider border border-gilded-border transition-colors cursor-pointer"
                    >
                      Load Sample Seating Plan
                    </button>
                  </div>
                ) : (
                  <div 
                    ref={floorPlanAreaRef}
                    onMouseDown={handleContainerMouseDown}
                    onMouseMove={handleContainerMouseMove}
                    onMouseUp={handleContainerMouseUp}
                    style={{
                      backgroundImage: arenaMode === 'lecture' 
                        ? 'radial-gradient(rgba(99, 102, 241, 0.12) 1px, transparent 1px)' 
                        : undefined,
                      backgroundSize: '24px 24px',
                    }}
                    className={`relative flex flex-col items-center gap-8 p-6 rounded-2xl border transition-all duration-300 max-h-[950px] overflow-y-auto scrollbar-thin ${
                      arenaMode === 'lecture'
                        ? 'bg-slate-900 border-slate-950 cursor-crosshair shadow-inner'
                        : 'bg-slate-50/50 border-gray-100 cursor-default'
                    } ${isSeminarModeActive ? 'select-none' : ''}`}
                  >
                    {isSeminarModeActive && (
                      <div className="absolute top-3 left-3 right-3 bg-indigo-600 text-white text-[10px] uppercase font-bold tracking-widest text-center py-1.5 rounded-lg z-30 pointer-events-none shadow-sm font-mono flex items-center justify-center gap-1.5 animate-fadeIn">
                        <span>✏️ Drag Active: Click & Drag to Deploy a {seminarRows}x{seminarSeatsPerRow} Academic Row Array</span>
                      </div>
                    )}

                    {isDraggingGrid && dragStartPos && dragCurrentPos && (
                      <div
                        className="absolute border-2 border-dashed border-indigo-500 bg-indigo-50/20 rounded-xl pointer-events-none z-50 flex flex-col items-center justify-between p-3 animate-pulse"
                        style={{
                          left: Math.min(dragStartPos.x, dragCurrentPos.x),
                          top: Math.min(dragStartPos.y, dragCurrentPos.y),
                          width: Math.abs(dragCurrentPos.x - dragStartPos.x),
                          height: Math.abs(dragCurrentPos.y - dragStartPos.y),
                        }}
                      >
                        <div className="m-auto bg-indigo-600 text-white text-[10px] font-extrabold font-mono px-2.5 py-1 rounded shadow-md flex flex-col items-center gap-0.5 uppercase tracking-widest">
                          <span>{seminarRows} Rows × {seminarSeatsPerRow} Seats</span>
                          <span className="text-[8px] text-indigo-200">Facing Podium: {seminarDirection}</span>
                        </div>
                      </div>
                    )}

                    {tables.filter(t => arenaMode === 'dining' ? t.shape !== 'seminar' : t.shape === 'seminar').length === 0 ? (
                      <div className="text-center py-12">
                        <p className={`text-sm font-semibold ${arenaMode === 'lecture' ? 'text-indigo-200' : 'text-gray-500'}`}>
                          No {arenaMode === 'dining' ? 'banquet tables' : 'lecture row segments'} placed in this mode.
                        </p>
                        <p className={`text-xs mt-1 ${arenaMode === 'lecture' ? 'text-indigo-400' : 'text-gray-400'}`}>
                          {arenaMode === 'dining' 
                            ? 'Configure and add standard dining shapes with the panel above.' 
                            : 'Drag and hold inside this arena, or click "Instant Deploy Row" to see your classroom appear!'}
                        </p>
                      </div>
                    ) : (
                      tables.filter(t => arenaMode === 'dining' ? t.shape !== 'seminar' : t.shape === 'seminar').map((table) => (
                        <TableVisualizer
                          key={table.id}
                          table={table}
                          guests={guests}
                          unassignedGuests={unassignedGuests}
                          selectedGuestForMoving={selectedGuestForMoving}
                          onSelectGuestForMoving={setSelectedGuestForMoving}
                          onSeatGuest={handleSeatGuest}
                          onUnseatGuest={handleUnseatGuest}
                          onSwapGuests={handleSwapGuests}
                          onUpdateTable={handleUpdateTable}
                          onDeleteTable={handleDeleteTable}
                          onUpdateGuest={handleUpdateGuest}
                          onClearTableGuests={handleClearTableGuests}
                          onResetTableGuestPositions={handleResetTableGuestPositions}
                          onBatchApplySettings={handleBatchApplyTableSettings}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>

            </div>

            {/* Column B (Right 1/3): Directory List */}
            <div className="lg:col-span-1 h-[750px] lg:h-[950px]">
              <GuestPanel
                guests={guests}
                tables={tables}
                selectedGuestForMoving={selectedGuestForMoving}
                onSelectGuestForMoving={setSelectedGuestForMoving}
                onUpdateGuests={(updated) => setGuests(updated)}
                onAddGuest={(name, group, notes) => {
                  const newGuest: Guest = {
                    id: `guest_manual_${Date.now()}`,
                    name,
                    group: group || 'Individual',
                    notes,
                    tableId: null,
                    seatIndex: null,
                  };
                  setGuests([...guests, newGuest]);
                }}
                onDeleteGuest={(guestId) => {
                  setGuests(guests.filter((g) => g.id !== guestId));
                  if (selectedGuestForMoving?.id === guestId) {
                    setSelectedGuestForMoving(null);
                  }
                }}
                onUnseatGuest={handleUnseatGuest}
                onSeatGuest={handleSeatGuest}
              />
            </div>

          </div>

        </main>
      ) : activeTab === 'tentcards' ? (
        <TentCardStudio
          guests={guests}
          tables={tables}
          exportRef={exportTentCardsRef}
          isExporting={isExportingTentCards}
          setIsExporting={setIsExportingTentCards}
          exportProgress={exportTentCardsProgress}
          setExportProgress={setExportTentCardsProgress}
        />
      ) : activeTab === 'designer' ? (
        <TableDesigner
          onAddTableFromTemplate={handleAddTableFromTemplate}
          onBackToWorkspace={() => setActiveTab('floorplan')}
        />
      ) : activeTab === 'layout' ? (
        <LayoutDesigner
          key={activeEventId || 'none'}
          tables={tables}
          layoutElements={layoutElements}
          onUpdateLayoutElements={setLayoutElements}
          onBackToWorkspace={() => setActiveTab('floorplan')}
        />
      ) : activeTab === 'invitations' ? (
        <InvitationStudio
          activeEventId={activeEventId}
          activeEventName={activeEvent?.name || 'Untitled Event'}
          guests={guests}
          tables={tables}
        />
      ) : (
        <div className="text-center py-20 text-gray-400 font-mono text-xs">View not found.</div>
      )}
      
      {/* Minimalistic Elegant Page Footer */}
      <footer className="max-w-[96%] mx-auto px-4 sm:px-6 lg:px-8 py-10 border-t border-gray-50 text-center">
        <p className="text-xs text-gray-400 font-mono">
          © {new Date().getFullYear()} Round Table Seating Planner. Beautiful single-view dashboard designed for maximum productivity.
        </p>
      </footer>

    </div>
  );
}

