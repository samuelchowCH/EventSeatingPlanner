/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Search, UserPlus, Filter, X, Table, Users, Sparkles, Utensils, Check, Mail } from 'lucide-react';
import { Guest, Table as SeatingTable } from '../types';
import { autoGenerateGuestEmails } from '../utils/seatingHelper';

interface GuestPanelProps {
  guests: Guest[];
  tables: SeatingTable[];
  selectedGuestForMoving: Guest | null;
  onSelectGuestForMoving: (guest: Guest | null) => void;
  onAddGuest: (name: string, group: string, notes: string) => void;
  onDeleteGuest: (guestId: string) => void;
  onUnseatGuest: (guestId: string) => void;
  onSeatGuest: (guestId: string, tableId: string, seatIndex: number) => void;
  onUpdateGuests?: (guests: Guest[]) => void;
}

export default function GuestPanel({
  guests,
  tables,
  selectedGuestForMoving,
  onSelectGuestForMoving,
  onAddGuest,
  onDeleteGuest,
  onUnseatGuest,
  onSeatGuest,
  onUpdateGuests,
}: GuestPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'seated' | 'unassigned'>('all');
  const [selectedGroup, setSelectedGroup] = useState<string>('all-groups');

  // New Guest Quick Form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGroup, setNewGroup] = useState('');
  const [newNotes, setNewNotes] = useState('');

  const handleAutoFillEmails = () => {
    if (!onUpdateGuests) return;
    const updated = autoGenerateGuestEmails(guests);
    onUpdateGuests(updated);
  };

  // Extract unique groups for filter
  const groups = Array.from(new Set(guests.map((g) => g.group || 'Individual')));

  // Filter Guests
  const filteredGuests = guests.filter((g) => {
    const matchesSearch = g.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          g.group.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (g.notes || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = 
      filterType === 'all' ||
      (filterType === 'seated' && g.tableId !== null) ||
      (filterType === 'unassigned' && g.tableId === null);

    const matchesGroup = selectedGroup === 'all-groups' || g.group === selectedGroup;

    return matchesSearch && matchesStatus && matchesGroup;
  });

  const getTableOfGuest = (guest: Guest) => {
    if (!guest.tableId) return null;
    return tables.find((t) => t.id === guest.tableId);
  };

  const handleCreateGuest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    onAddGuest(newName.trim(), newGroup.trim() || 'Individual', newNotes.trim());
    setNewName('');
    setNewGroup('');
    setNewNotes('');
    setShowAddForm(false);
  };

  const handleQuickSeatRandom = (guestId: string) => {
    // Find first table with empty space
    for (const table of tables) {
      const occupiedSeats = guests
        .filter((g) => g.tableId === table.id && g.seatIndex !== null)
        .map((g) => g.seatIndex as number);
      
      for (let s = 0; s < table.maxSeats; s++) {
        if (!occupiedSeats.includes(s)) {
          onSeatGuest(guestId, table.id, s);
          return;
        }
      }
    }
    alert("No empty seats available at any existing table! Increase table capacities or create a new table first.");
  };

  return (
    <div className="bg-white rounded-none border border-gilded-border shadow-xs h-full flex flex-col overflow-hidden">
      
      {/* Search and Quick Filters */}
      <div className="p-4 border-b border-gilded-border shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-serif font-medium text-gilded-ink tracking-tight">Guest Directory</h2>
            <p className="text-[10px] text-gilded-ink/50 font-mono mt-0.5 uppercase tracking-wider">{guests.length} total guests registered</p>
          </div>
          <div className="flex items-center gap-1.5">
            {onUpdateGuests && (
              <button
                type="button"
                onClick={handleAutoFillEmails}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] text-gilded-ink bg-gilded-faint hover:bg-gilded-accent/20 border border-gilded-border font-mono uppercase tracking-widest font-medium rounded-none transition-all cursor-pointer"
                title="Auto-generate sample email addresses for any guest missing an email"
              >
                <Mail size={11} />
                <span>Auto-fill Emails</span>
              </button>
            )}
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] text-white bg-gilded-ink hover:bg-gilded-accent font-mono uppercase tracking-widest font-medium rounded-none transition-all cursor-pointer"
            >
              <UserPlus size={12} />
              <span>Add Guest</span>
            </button>
          </div>
        </div>

        {/* Quick Add Form nested right at the top */}
        {showAddForm && (
          <form onSubmit={handleCreateGuest} className="bg-gilded-bg border border-gilded-border rounded-none p-3 mb-3 text-xs space-y-2">
            <div>
              <label className="block text-[9px] font-medium text-gilded-ink/60 uppercase tracking-widest font-mono mb-0.5">Full Name</label>
              <input
                type="text"
                placeholder="Elizabeth Bennet"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                className="w-full bg-white border border-gilded-border rounded-none px-2.5 py-1.5 text-gilded-ink focus:border-gilded-accent outline-none font-sans text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[9px] font-medium text-gilded-ink/60 uppercase tracking-widest font-mono mb-0.5">Group / Tag</label>
                <input
                  type="text"
                  placeholder="Bennet Family"
                  value={newGroup}
                  onChange={(e) => setNewGroup(e.target.value)}
                  className="w-full bg-white border border-gilded-border rounded-none px-2.5 py-1.5 text-gilded-ink focus:border-gilded-accent outline-none font-sans text-xs"
                  list="groups-datalist"
                />
                <datalist id="groups-datalist">
                  {groups.map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-[9px] font-medium text-gilded-ink/60 uppercase tracking-widest font-mono mb-0.5">Dietary Notes</label>
                <input
                  type="text"
                  placeholder="Nut allergy, etc."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full bg-white border border-gilded-border rounded-none px-2.5 py-1.5 text-gilded-ink focus:border-gilded-accent outline-none font-sans text-xs"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-2.5 py-1 text-gilded-ink/60 hover:bg-gilded-faint rounded-none font-mono uppercase tracking-wider text-[10px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 bg-gilded-ink hover:bg-gilded-accent text-white font-mono uppercase tracking-wider text-[10px] rounded-none"
              >
                Create
              </button>
            </div>
          </form>
        )}

        {/* Selected Moving State Banner */}
        {selectedGuestForMoving && (
          <div className="bg-amber-50 border border-gilded-accent/40 rounded-none p-3 mb-3 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-none bg-gilded-accent opacity-75"></span>
                <span className="relative inline-flex rounded-none h-2 w-2 bg-gilded-accent"></span>
              </span>
              <p className="text-gilded-ink font-sans leading-tight">
                Moving <strong>{selectedGuestForMoving.name}</strong>.<br />
                <span className="text-[10px] text-gilded-accent font-semibold">Click any seat to place them.</span>
              </p>
            </div>
            <button
              onClick={() => onSelectGuestForMoving(null)}
              className="p-1 text-gilded-ink/50 hover:text-gilded-ink cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Search Input bar */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gilded-ink/40" />
          <input
            type="text"
            placeholder="Search guests, groups, notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gilded-bg border border-gilded-border rounded-none pl-9 pr-3 py-2 text-xs font-sans text-gilded-ink focus:border-gilded-accent focus:bg-white outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gilded-ink/40 hover:text-gilded-ink"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Filter buttons */}
        <div className="flex gap-1.5 mt-3 select-none">
          <button
            onClick={() => setFilterType('all')}
            className={`px-2.5 py-1 text-[10px] uppercase font-semibold tracking-wider rounded-none font-mono transition-all border ${
              filterType === 'all'
                ? 'bg-gilded-ink border-gilded-ink text-white'
                : 'bg-gilded-bg border-gilded-border text-gilded-ink/60 hover:bg-gilded-faint'
            }`}
          >
            All ({guests.length})
          </button>
          <button
            onClick={() => setFilterType('unassigned')}
            className={`px-2.5 py-1 text-[10px] uppercase font-semibold tracking-wider rounded-none font-mono transition-all border ${
              filterType === 'unassigned'
                ? 'bg-gilded-accent/15 border-gilded-accent/40 text-gilded-ink'
                : 'bg-gilded-bg border-gilded-border text-gilded-ink/60 hover:bg-gilded-faint'
            }`}
          >
            Unseated ({guests.filter((g) => g.tableId === null).length})
          </button>
          <button
            onClick={() => setFilterType('seated')}
            className={`px-2.5 py-1 text-[10px] uppercase font-semibold tracking-wider rounded-none font-mono transition-all border ${
              filterType === 'seated'
                ? 'bg-gilded-faint border-gilded-border text-gilded-ink/80'
                : 'bg-gilded-bg border-gilded-border text-gilded-ink/60 hover:bg-gilded-faint'
            }`}
          >
            Seated ({guests.filter((g) => g.tableId !== null).length})
          </button>
        </div>

        {/* Groups selection datalist */}
        {groups.length > 0 && (
          <div className="mt-2 text-[10px] flex items-center gap-1 text-gray-500 font-sans">
            <Filter size={10} className="text-gray-400" />
            <span>Group filter:</span>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="bg-transparent border-none text-gray-700 font-medium p-0 focus:ring-0 text-[10px] cursor-pointer"
            >
              <option value="all-groups">All Groups ({groups.length})</option>
              {groups.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Guest Scroller */}
      <div className="overflow-y-auto grow p-3 space-y-1.5 scrollbar-thin">
        {filteredGuests.length === 0 ? (
          <div className="text-center py-8 text-gray-400 font-sans text-xs">
            <Users size={24} className="mx-auto text-gray-300 mb-1.5" />
            <p>No matching guests found</p>
          </div>
        ) : (
          filteredGuests.map((guest) => {
            const table = getTableOfGuest(guest);
            const isSelected = selectedGuestForMoving?.id === guest.id;
            
            // Native HTML5 drag details
            const handleDragStart = (e: React.DragEvent) => {
              e.dataTransfer.setData('text/plain', guest.id);
              e.dataTransfer.effectAllowed = 'move';
              onSelectGuestForMoving(guest);
            };

            return (
              <div
                key={guest.id}
                draggable
                onDragStart={handleDragStart}
                onClick={() => onSelectGuestForMoving(isSelected ? null : guest)}
                className={`flex items-center justify-between p-2.5 rounded-none border text-xs cursor-pointer select-none group transition-all duration-150 ${
                  isSelected
                    ? 'bg-gilded-accent/10 border-gilded-accent text-gilded-ink shadow-xs scale-[1.01]'
                    : 'bg-white hover:bg-gilded-bg border-gilded-border hover:border-gilded-accent/40 shadow-xs'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-gilded-ink truncate block font-sans">
                      {guest.name}
                    </span>
                    {guest.notes && (
                      <span className="inline-block" title={`Dietary: ${guest.notes}`}>
                        <Utensils size={11} className="text-amber-500 shrink-0" />
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1.5 text-[10px] text-gilded-ink/50 font-mono mt-0.5 flex-wrap">
                    <span className="truncate max-w-[90px]" title="Affiliation Group">{guest.group}</span>
                    {guest.email && (
                      <span className="text-gilded-accent truncate max-w-[120px]" title={`Email: ${guest.email}`}>
                        {guest.email}
                      </span>
                    )}
                    {guest.notes && (
                      <span className="text-amber-600 truncate max-w-[80px] italic">({guest.notes})</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 pl-2">
                  {table ? (
                    <div className="flex items-center gap-1">
                      <span 
                        className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-none flex items-center gap-1 select-none text-white uppercase tracking-wider"
                        style={{ backgroundColor: table.color || '#C9A96E' }}
                      >
                        <Table size={10} />
                        <span>S{Number(guest.seatIndex ?? 0) + 1}</span>
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onUnseatGuest(guest.id);
                        }}
                        className="p-1 hover:bg-gilded-bg rounded-none text-gilded-ink/60 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Unseat guest"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-1 items-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectGuestForMoving(guest);
                        }}
                        className={`px-2 py-1 rounded-none text-[10px] font-mono uppercase tracking-wider border ${
                          isSelected
                            ? 'bg-gilded-accent text-white border-gilded-accent'
                            : 'bg-gilded-bg hover:bg-gilded-accent/20 text-gilded-ink border-gilded-border'
                        }`}
                      >
                        Seat...
                      </button>

                      {tables.length > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuickSeatRandom(guest.id);
                          }}
                          className="px-1.5 py-1 text-gilded-ink/40 hover:text-gilded-accent bg-gilded-bg border border-gilded-border rounded-none hover:bg-gilded-faint text-[10px]"
                          title="Place in first available seat"
                        >
                          <Sparkles size={11} />
                        </button>
                      )}
                    </div>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteGuest(guest.id);
                    }}
                    className="p-1 hover:bg-red-50 text-gilded-ink/30 hover:text-red-500 rounded-none opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-xs"
                    title="Delete guest"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
