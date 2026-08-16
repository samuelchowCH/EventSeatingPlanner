/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Event, EventType, TableStyle } from '../types';
import {
  X,
  Calendar,
  MapPin,
  Users,
  Utensils,
  LayoutGrid,
  Check,
  Edit3,
  Layers,
  Save,
  Clock,
  Sparkles
} from 'lucide-react';

interface EventSummaryModalProps {
  event: Event | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedEvent: Event) => void;
  onOpenPlan: (eventId: string) => void;
}

const EVENT_TYPES: EventType[] = ['Wedding', 'Seminar', 'Birthday', 'Corporate', 'Other'];

const TABLE_SHAPES: Array<{
  value: 'round' | 'rectangle' | 'square' | 'banquet';
  label: string;
  imgOn: string;
  imgOff: string;
}> = [
  { value: 'round', label: 'Round', imgOn: '/tables/circle_on.png', imgOff: '/tables/circle_off.png' },
  { value: 'rectangle', label: 'Rectangle', imgOn: '/tables/rect_on.png', imgOff: '/tables/rect_off.png' },
  { value: 'square', label: 'Square', imgOn: '/tables/squ_on.png', imgOff: '/tables/squ_off.png' },
  { value: 'banquet', label: 'Banquet', imgOn: '/tables/banquet_on.png', imgOff: '/tables/banquet_off.png' },
];

export default function EventSummaryModal({
  event,
  isOpen,
  onClose,
  onSave,
  onOpenPlan,
}: EventSummaryModalProps) {
  if (!isOpen || !event) return null;

  // Local form state for editing event details
  const [name, setName] = useState(event.name || '');
  const [date, setDate] = useState(event.date || '');
  const [eventType, setEventType] = useState<EventType | ''>(event.metadata?.eventType || '');
  const [venueName, setVenueName] = useState(event.metadata?.venueName || '');
  const [venueCity, setVenueCity] = useState(event.metadata?.venueCity || '');
  const [description, setDescription] = useState(event.metadata?.description || '');
  const [guestCountEstimated, setGuestCountEstimated] = useState<string>(
    event.metadata?.guestCountEstimated ? String(event.metadata.guestCountEstimated) : ''
  );
  const [dietaryNotes, setDietaryNotes] = useState(event.metadata?.dietaryNotes || '');
  const [arenaMode, setArenaMode] = useState<'dining' | 'lecture'>(event.arenaMode || 'dining');
  const [defaultTableShape, setDefaultTableShape] = useState<'round' | 'rectangle' | 'square' | 'banquet' | 'banana' | 'nano' | 'custom'>(
    event.defaultTableShape || 'round'
  );
  const [defaultTableSeats, setDefaultTableSeats] = useState<number>(event.defaultTableSeats || 8);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Sync state when event prop changes
  useEffect(() => {
    if (event) {
      setName(event.name || '');
      setDate(event.date || '');
      setEventType(event.metadata?.eventType || '');
      setVenueName(event.metadata?.venueName || '');
      setVenueCity(event.metadata?.venueCity || '');
      setDescription(event.metadata?.description || '');
      setGuestCountEstimated(event.metadata?.guestCountEstimated ? String(event.metadata.guestCountEstimated) : '');
      setDietaryNotes(event.metadata?.dietaryNotes || '');
      setArenaMode(event.arenaMode || 'dining');
      setDefaultTableShape(event.defaultTableShape || 'round');
      setDefaultTableSeats(event.defaultTableSeats || 8);
      setSavedSuccess(false);
    }
  }, [event]);

  // Statistics calculation
  const totalGuests = event.guests?.length || 0;
  const seatedGuests = event.guests?.filter((g) => g.tableId !== null).length || 0;
  const unseatedGuests = totalGuests - seatedGuests;
  const totalTables = event.tables?.length || 0;
  const totalCapacity = event.tables?.reduce((sum, t) => sum + (t.maxSeats || 0), 0) || 0;
  const dietaryGuestsCount = event.guests?.filter((g) => g.notes && g.notes.trim() !== '').length || 0;
  const progressPercent = totalGuests > 0 ? Math.round((seatedGuests / totalGuests) * 100) : 0;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const updatedEvent: Event = {
      ...event,
      name: name.trim(),
      date: date || undefined,
      arenaMode,
      defaultTableShape,
      defaultTableSeats: Math.min(Math.max(Number(defaultTableSeats) || 8, 2), 30),
      updatedAt: Date.now(),
      metadata: {
        ...event.metadata,
        eventType: eventType || undefined,
        venueName: venueName.trim() || undefined,
        venueCity: venueCity.trim() || undefined,
        description: description.trim() || undefined,
        guestCountEstimated: guestCountEstimated ? Number(guestCountEstimated) : undefined,
        dietaryNotes: dietaryNotes.trim() || undefined,
      },
    };

    onSave(updatedEvent);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
    }, 2500);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-950/80 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
      <div className="bg-white border border-gilded-border w-full max-w-4xl shadow-2xl rounded-none flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="bg-gilded-bg border-b border-gilded-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gilded-ink text-gilded-accent shadow-xs">
              <Calendar size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gilded-ink tracking-tight font-serif">
                  {event.name}
                </h2>
                {eventType && (
                  <span className="px-2 py-0.5 bg-gilded-accent text-gilded-ink text-[10px] font-mono font-bold uppercase tracking-wider">
                    {eventType}
                  </span>
                )}
                <span className={`text-[10px] font-mono uppercase px-2 py-0.5 font-bold ${
                  arenaMode === 'dining'
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                }`}>
                  {arenaMode === 'dining' ? 'Banquet Mode' : 'Lecture Mode'}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                Created: {new Date(event.createdAt).toLocaleDateString()} • Last Modified: {new Date(event.updatedAt || event.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gilded-ink hover:bg-gilded-border/40 transition-colors cursor-pointer"
            title="Close summary"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Summary Stat Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-gilded-faint border border-gilded-border/60 shadow-3xs">
              <div className="flex items-center justify-between text-gray-400 font-mono text-[10px] uppercase font-bold">
                <span>Tables Placed</span>
                <LayoutGrid size={13} className="text-gilded-accent" />
              </div>
              <div className="text-xl font-bold text-gilded-ink font-serif mt-1">{totalTables}</div>
              <div className="text-[10px] text-gray-500 font-mono mt-0.5">{totalCapacity} Total Seats</div>
            </div>

            <div className="p-3.5 bg-gilded-faint border border-gilded-border/60 shadow-3xs">
              <div className="flex items-center justify-between text-gray-400 font-mono text-[10px] uppercase font-bold">
                <span>Total Guests</span>
                <Users size={13} className="text-gilded-accent" />
              </div>
              <div className="text-xl font-bold text-gilded-ink font-serif mt-1">{totalGuests}</div>
              <div className="text-[10px] text-gray-500 font-mono mt-0.5">{seatedGuests} Seated ({progressPercent}%)</div>
            </div>

            <div className="p-3.5 bg-gilded-faint border border-gilded-border/60 shadow-3xs">
              <div className="flex items-center justify-between text-gray-400 font-mono text-[10px] uppercase font-bold">
                <span>Unassigned</span>
                <Clock size={13} className="text-amber-600" />
              </div>
              <div className="text-xl font-bold text-amber-700 font-serif mt-1">{unseatedGuests}</div>
              <div className="text-[10px] text-gray-500 font-mono mt-0.5">{totalCapacity >= totalGuests ? `${totalCapacity - totalGuests} Seats Free` : 'Over Capacity'}</div>
            </div>

            <div className="p-3.5 bg-gilded-faint border border-gilded-border/60 shadow-3xs">
              <div className="flex items-center justify-between text-gray-400 font-mono text-[10px] uppercase font-bold">
                <span>Dietary / Notes</span>
                <Utensils size={13} className="text-gilded-accent" />
              </div>
              <div className="text-xl font-bold text-gilded-ink font-serif mt-1">{dietaryGuestsCount}</div>
              <div className="text-[10px] text-gray-500 font-mono mt-0.5">Special Dietary Needs</div>
            </div>
          </div>

          {/* Edit Event Form Section */}
          <form onSubmit={handleSave} className="space-y-5 border-t border-gilded-border/50 pt-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-gilded-ink uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Edit3 size={13} className="text-gilded-accent" />
                Edit Event Specifications
              </h3>
              {savedSuccess && (
                <span className="text-xs text-emerald-700 font-mono font-bold flex items-center gap-1 bg-emerald-50 border border-emerald-200 px-2 py-0.5 animate-fadeIn">
                  <Check size={13} /> Changes saved successfully
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Event Name */}
              <div>
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Event Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-gilded-faint border border-gilded-border focus:border-gilded-accent focus:bg-white text-xs font-sans rounded-none transition-colors"
                />
              </div>

              {/* Event Type */}
              <div>
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Event Type
                </label>
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value as EventType)}
                  className="w-full px-3 py-2 bg-gilded-faint border border-gilded-border focus:border-gilded-accent focus:bg-white text-xs font-sans rounded-none transition-colors"
                >
                  <option value="">Select event type...</option>
                  {EVENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Event Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 bg-gilded-faint border border-gilded-border focus:border-gilded-accent focus:bg-white text-xs font-sans rounded-none transition-colors"
                />
              </div>

              {/* Venue City */}
              <div>
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Venue City / Location
                </label>
                <input
                  type="text"
                  value={venueCity}
                  onChange={(e) => setVenueCity(e.target.value)}
                  placeholder="e.g. San Francisco, CA"
                  className="w-full px-3 py-2 bg-gilded-faint border border-gilded-border focus:border-gilded-accent focus:bg-white text-xs font-sans rounded-none transition-colors"
                />
              </div>

              {/* Venue Name */}
              <div>
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Venue / Ballroom Name
                </label>
                <input
                  type="text"
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                  placeholder="e.g. Grand Plaza Ballroom"
                  className="w-full px-3 py-2 bg-gilded-faint border border-gilded-border focus:border-gilded-accent focus:bg-white text-xs font-sans rounded-none transition-colors"
                />
              </div>

              {/* Estimated Guest Count */}
              <div>
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Target Guest Count
                </label>
                <input
                  type="number"
                  min="1"
                  value={guestCountEstimated}
                  onChange={(e) => setGuestCountEstimated(e.target.value)}
                  placeholder="e.g. 120"
                  className="w-full px-3 py-2 bg-gilded-faint border border-gilded-border focus:border-gilded-accent focus:bg-white text-xs font-sans rounded-none transition-colors"
                />
              </div>
            </div>

            {/* Layout Mode Selection */}
            <div>
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Venue Layout Mode
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setArenaMode('dining')}
                  className={`py-2 px-3 text-xs font-serif font-bold uppercase tracking-wider border text-center transition-all cursor-pointer ${
                    arenaMode === 'dining'
                      ? 'bg-gilded-ink border-gilded-ink text-gilded-accent shadow-xs'
                      : 'bg-white border-gilded-border text-gray-600 hover:border-gilded-accent'
                  }`}
                >
                  Banquet Dining
                </button>
                <button
                  type="button"
                  onClick={() => setArenaMode('lecture')}
                  className={`py-2 px-3 text-xs font-serif font-bold uppercase tracking-wider border text-center transition-all cursor-pointer ${
                    arenaMode === 'lecture'
                      ? 'bg-gilded-ink border-gilded-ink text-gilded-accent shadow-xs'
                      : 'bg-white border-gilded-border text-gray-600 hover:border-gilded-accent'
                  }`}
                >
                  Lecture Hall
                </button>
              </div>
            </div>

            {/* Seating Defaults: Table Shape & Seats per table */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                  Default Table Shape
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {TABLE_SHAPES.map(({ value, label, imgOn, imgOff }) => {
                    const isSelected = defaultTableShape === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setDefaultTableShape(value)}
                        className={`flex flex-col items-center gap-1 p-2 border text-[11px] font-serif font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-gilded-ink border-gilded-ink text-gilded-accent shadow-xs'
                            : 'bg-white border-gilded-border text-gray-600 hover:border-gilded-accent'
                        }`}
                      >
                        <div className="w-8 h-8 flex items-center justify-center p-0.5">
                          <img
                            src={isSelected ? imgOn : imgOff}
                            alt={label}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                  Seats Per Default Table: <span className="font-mono text-gilded-accent bg-gilded-ink px-1.5 py-0.5 ml-1">{defaultTableSeats}</span>
                </label>
                <div className="flex items-center gap-3 pt-2">
                  <input
                    type="range"
                    min="2"
                    max="30"
                    value={defaultTableSeats}
                    onChange={(e) => setDefaultTableSeats(Number(e.target.value))}
                    className="flex-1 accent-gilded-accent cursor-pointer"
                  />
                  <input
                    type="number"
                    min="2"
                    max="30"
                    value={defaultTableSeats}
                    onChange={(e) => setDefaultTableSeats(Number(e.target.value))}
                    className="w-16 px-2 py-1 bg-gilded-faint border border-gilded-border text-center text-xs font-mono font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Description & Dietary Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Event Description / Logistics
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Additional notes about event agenda, keynote speakers, or schedule..."
                  className="w-full px-3 py-2 bg-gilded-faint border border-gilded-border focus:border-gilded-accent focus:bg-white text-xs font-sans rounded-none transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Catering & Dietary Overview
                </label>
                <textarea
                  rows={3}
                  value={dietaryNotes}
                  onChange={(e) => setDietaryNotes(e.target.value)}
                  placeholder="Buffet / Plated, VIP menu instructions, bar locations..."
                  className="w-full px-3 py-2 bg-gilded-faint border border-gilded-border focus:border-gilded-accent focus:bg-white text-xs font-sans rounded-none transition-colors resize-none"
                />
              </div>
            </div>

            {/* Action Buttons inside form */}
            <div className="flex items-center justify-between pt-4 border-t border-gilded-border/50 gap-3 flex-wrap">
              <button
                type="submit"
                className="px-5 py-2 bg-gilded-accent hover:bg-gilded-accent-muted text-gilded-ink text-xs font-bold font-serif uppercase tracking-wider rounded-none transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs"
              >
                <Save size={14} />
                <span>Save Changes</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onOpenPlan(event.id);
                    onClose();
                  }}
                  className="px-4 py-2 bg-gilded-ink hover:bg-black text-gilded-accent text-xs font-bold font-serif uppercase tracking-wider rounded-none border border-gilded-border transition-colors cursor-pointer"
                >
                  Open Seating Workspace →
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-white hover:bg-gilded-bg border border-gilded-border text-gray-700 text-xs font-sans font-semibold rounded-none transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}
