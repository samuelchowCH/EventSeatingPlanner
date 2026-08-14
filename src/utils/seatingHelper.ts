/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Guest, Table } from '../types';

/**
 * Automatically assigns unassigned guests to tables, keeping groups/families together as much as possible.
 */
export function autoAssignSeating(
  guests: Guest[],
  tables: Table[],
  options: {
    fillExisting: boolean;
    tableCapacity: number;
    createTablesIfNeeded: boolean;
  }
): { updatedGuests: Guest[]; updatedTables: Table[] } {
  let workingGuests = JSON.parse(JSON.stringify(guests)) as Guest[];
  let workingTables = JSON.parse(JSON.stringify(tables)) as Table[];

  // If we should clear existing seating assignments first, reset those
  if (!options.fillExisting) {
    workingGuests = workingGuests.map((g) => ({
      ...g,
      tableId: null,
      seatIndex: null,
    }));
  }

  // Filter for guests that need assignment
  const unassignedGuests = workingGuests.filter((g) => g.tableId === null);
  if (unassignedGuests.length === 0) {
    return { updatedGuests: workingGuests, updatedTables: workingTables };
  }

  // Group the unassigned guests by their 'group' field
  const groupMap: { [key: string]: Guest[] } = {};
  unassignedGuests.forEach((g) => {
    const grp = (g.group || 'Individual').trim();
    if (!groupMap[grp]) {
      groupMap[grp] = [];
    }
    groupMap[grp].push(g);
  });

  // Sort groups by size, descending (assign larger groups first)
  const sortedGroupNames = Object.keys(groupMap).sort(
    (a, b) => groupMap[b].length - groupMap[a].length
  );

  // Helper to find a table and standard seat index
  const findFirstAvailableSeat = (tableId: string, maxSeats: number): number | null => {
    const occupiedSeats = workingGuests
      .filter((g) => g.tableId === tableId && g.seatIndex !== null)
      .map((g) => g.seatIndex as number);

    for (let i = 0; i < maxSeats; i++) {
      if (!occupiedSeats.includes(i)) {
        return i;
      }
    }
    return null;
  };

  const getAvailableSeatCount = (table: Table): number => {
    const occupied = workingGuests.filter(
      (g) => g.tableId === table.id && g.seatIndex !== null
    ).length;
    return Math.max(0, table.maxSeats - occupied);
  };

  const createNewTable = (): Table => {
    const nextNum = workingTables.length + 1;
    const tableColors = [
      '#C9A96E', // Gilded Gold
      '#2C2C2C', // Deep Ink
      '#6B5E4F', // Warm Taupe
      '#738276', // Sage Green
      '#3E4A56', // Deep Steel
      '#8A7968', // Warm Clay
      '#A87E60', // Bronze
    ];
    const newTable: Table = {
      id: `table_${Date.now()}_${nextNum}`,
      name: `Table ${nextNum}`,
      maxSeats: options.tableCapacity,
      color: tableColors[(nextNum - 1) % tableColors.length],
    };
    workingTables.push(newTable);
    return newTable;
  };

  // If there are absolutely no tables and we are allowed to create them, create our first table
  if (workingTables.length === 0 && options.createTablesIfNeeded) {
    createNewTable();
  }

  // Iterate over each group and try to place them
  sortedGroupNames.forEach((groupName) => {
    const groupGuests = groupMap[groupName];
    let guestsToPlace = [...groupGuests];

    while (guestsToPlace.length > 0) {
      // 1. Try to find a single table that fits the ENTIRE group
      let bestTable: Table | null = null;
      let minExcessSpace = Infinity;

      for (const t of workingTables) {
        const available = getAvailableSeatCount(t);
        if (available >= guestsToPlace.length) {
          const excess = available - guestsToPlace.length;
          if (excess < minExcessSpace) {
            minExcessSpace = excess;
            bestTable = t;
          }
        }
      }

      // If we found a table that fits the group, seat them there!
      if (bestTable) {
        for (const guest of guestsToPlace) {
          const seatIdx = findFirstAvailableSeat(bestTable.id, bestTable.maxSeats);
          if (seatIdx !== null) {
            const index = workingGuests.findIndex((g) => g.id === guest.id);
            if (index !== -1) {
              workingGuests[index].tableId = bestTable.id;
              workingGuests[index].seatIndex = seatIdx;
            }
          }
        }
        guestsToPlace = []; // All group guests seated!
      } else {
        // 2. If no table fits the entire group:
        // Try to seat as many as possible at the table with the most available space
        let tableWithMostSpace: Table | null = null;
        let maxSpace = 0;

        for (const t of workingTables) {
          const available = getAvailableSeatCount(t);
          if (available > maxSpace) {
            maxSpace = available;
            tableWithMostSpace = t;
          }
        }

        if (tableWithMostSpace && maxSpace > 0) {
          // Fill this table first
          const fitsCount = Math.min(guestsToPlace.length, maxSpace);
          const chunk = guestsToPlace.slice(0, fitsCount);

          for (const guest of chunk) {
            const seatIdx = findFirstAvailableSeat(
              tableWithMostSpace.id,
              tableWithMostSpace.maxSeats
            );
            if (seatIdx !== null) {
              const index = workingGuests.findIndex((g) => g.id === guest.id);
              if (index !== -1) {
                workingGuests[index].tableId = tableWithMostSpace.id;
                workingGuests[index].seatIndex = seatIdx;
              }
            }
          }

          guestsToPlace = guestsToPlace.slice(fitsCount);
        } else {
          // No space anywhere!
          if (options.createTablesIfNeeded) {
            // Create a new table and continue
            const newTable = createNewTable();
            // Seat as many as fit this new empty table
            const fitsCount = Math.min(guestsToPlace.length, newTable.maxSeats);
            const chunk = guestsToPlace.slice(0, fitsCount);

            for (const guest of chunk) {
              // It's a new table so seatIdx is just sequential starting at 0
              const seatIdx = findFirstAvailableSeat(newTable.id, newTable.maxSeats);
              if (seatIdx !== null) {
                const index = workingGuests.findIndex((g) => g.id === guest.id);
                if (index !== -1) {
                  workingGuests[index].tableId = newTable.id;
                  workingGuests[index].seatIndex = seatIdx;
                }
              }
            }
            guestsToPlace = guestsToPlace.slice(fitsCount);
          } else {
            // If we cannot create tables, we must stop and leave them unassigned
            break;
          }
        }
      }
    }
  });

  return { updatedGuests: workingGuests, updatedTables: workingTables };
}

export function autoGenerateGuestEmails(guests: Guest[]): Guest[] {
  return guests.map((g) => {
    if (g.email && g.email.trim() !== '') return g;

    const cleanName = g.name.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
    const nameParts = cleanName.split(/\s+/).filter(Boolean);
    const emailPrefix = nameParts.length > 0 ? nameParts.join('.') : `guest_${g.id.slice(-4)}`;
    const email = `${emailPrefix}@example.com`;

    return { ...g, email };
  });
}

/**
 * Returns preset sample data of guests and tables to make testing beautiful.
 */
export function getSampleData(): { guests: Guest[]; tables: Table[] } {
  const tableColors = [
    '#C9A96E', // Gilded Gold
    '#2C2C2C', // Deep Ink
    '#6B5E4F', // Warm Taupe
    '#738276', // Sage Green
    '#3E4A56', // Deep Steel
    '#8A7968', // Warm Clay
    '#A87E60', // Bronze
  ];

  const shapes: ('round' | 'rectangle' | 'square' | 'banquet')[] = ['round', 'rectangle', 'square', 'banquet'];

  const tables: Table[] = Array.from({ length: 4 }, (_, i) => ({
    id: `table_sample_${i + 1}`,
    name: `${shapes[i % shapes.length].charAt(0).toUpperCase() + shapes[i % shapes.length].slice(1)} ${i + 1}`,
    maxSeats: i === 2 ? 4 : i === 3 ? 12 : 8,
    color: tableColors[i % tableColors.length],
    shape: shapes[i % shapes.length],
  }));

  const sampleGuestsRaw = [
    // Group: Smith Family
    { name: 'John Smith', email: 'john.smith@example.com', group: 'Smith Family', notes: 'Gluten Free' },
    { name: 'Mary Smith', email: 'mary.smith@example.com', group: 'Smith Family', notes: '' },
    { name: 'David Smith', email: 'david.smith@example.com', group: 'Smith Family', notes: 'Child menu' },
    { name: 'Emma Smith', email: 'emma.smith@example.com', group: 'Smith Family', notes: 'Child menu' },
    
    // Group: Wedding Party
    { name: 'Sarah Connor', email: 'sarah.connor@example.com', group: 'Wedding Party', notes: 'Maid of Honor' },
    { name: 'John Connor', email: 'john.connor@example.com', group: 'Wedding Party', notes: 'Groom' },
    { name: 'Kate Brewster', email: 'kate.brewster@example.com', group: 'Wedding Party', notes: 'Bride' },
    { name: 'Marcus Wright', email: 'marcus.wright@example.com', group: 'Wedding Party', notes: 'Best Man' },

    // Group: Tech Friends
    { name: 'Alan Turing', email: 'alan.turing@example.com', group: 'Tech Friends', notes: 'Vegetarian' },
    { name: 'Ada Lovelace', email: 'ada.lovelace@example.com', group: 'Tech Friends', notes: 'VIP' },
    { name: 'Grace Hopper', email: 'grace.hopper@example.com', group: 'Tech Friends', notes: '' },
    { name: 'Claude Shannon', email: 'claude.shannon@example.com', group: 'Tech Friends', notes: '' },
    { name: 'Tim Berners-Lee', email: 'tim.bernerslee@example.com', group: 'Tech Friends', notes: '' },

    // Group: Davis Clan
    { name: 'Robert Davis', email: 'robert.davis@example.com', group: 'Davis Clan', notes: '' },
    { name: 'Patricia Davis', email: 'patricia.davis@example.com', group: 'Davis Clan', notes: 'Vegan' },
    { name: 'James Davis', email: 'james.davis@example.com', group: 'Davis Clan', notes: '' },
    { name: 'Linda Davis', email: 'linda.davis@example.com', group: 'Davis Clan', notes: '' },

    // Group: College Buddies
    { name: 'Sherlock Holmes', email: 'sherlock.holmes@example.com', group: 'College Buddies', notes: '' },
    { name: 'John Watson', email: 'john.watson@example.com', group: 'College Buddies', notes: '' },
    { name: 'Irene Adler', email: 'irene.adler@example.com', group: 'College Buddies', notes: '' },

    // Group: Office Team
    { name: 'Steve Jobs', email: 'steve.jobs@example.com', group: 'Office Team', notes: 'Fruitarian' },
    { name: 'Steve Wozniak', email: 'steve.wozniak@example.com', group: 'Office Team', notes: '' },
    { name: 'Jony Ive', email: 'jony.ive@example.com', group: 'Office Team', notes: '' },

    // Individuals
    { name: 'Albert Einstein', email: 'albert.einstein@example.com', group: 'Science', notes: 'Loves violin' },
    { name: 'Marie Curie', email: 'marie.curie@example.com', group: 'Science', notes: '' },
  ];

  const guests: Guest[] = sampleGuestsRaw.map((raw, idx) => ({
    id: `guest_sample_${idx + 1}`,
    name: raw.name,
    email: raw.email,
    tableId: null,
    seatIndex: null,
    group: raw.group,
    notes: raw.notes,
  }));

  // Auto assign the sample ones to give a fully seated board on request!
  const { updatedGuests } = autoAssignSeating(guests, tables, {
    fillExisting: false,
    tableCapacity: 8,
    createTablesIfNeeded: false,
  });

  return { guests: updatedGuests, tables };
}

/**
 * Returns preset academic sample data of scholars and seminar rows for Lecture Mode.
 */
export function getLectureSampleData(): { guests: Guest[]; tables: Table[] } {
  const tables: Table[] = [
    {
      id: 'table_lecture_sample_1',
      name: 'LECTURE SEGMENT 1',
      maxSeats: 24,
      color: '#C9A96E', // Gilded Gold
      shape: 'seminar',
      seminarRows: 3,
      seminarSeatsPerRow: 8,
      seminarDirection: 'Top',
    },
    {
      id: 'table_lecture_sample_2',
      name: 'LECTURE SEGMENT 2',
      maxSeats: 24,
      color: '#3E4A56', // Deep Steel
      shape: 'seminar',
      seminarRows: 3,
      seminarSeatsPerRow: 8,
      seminarDirection: 'Top',
    }
  ];

  const scholarsRaw = [
    // Quantum Physics
    { name: 'Albert Einstein', group: 'Quantum Physics', notes: 'Keynote Speaker' },
    { name: 'Marie Curie', group: 'Quantum Physics', notes: 'VIP Panelist' },
    { name: 'Richard Feynman', group: 'Quantum Physics', notes: '' },
    { name: 'Niels Bohr', group: 'Quantum Physics', notes: 'Nocturnal coffee seeker' },
    { name: 'Max Planck', group: 'Quantum Physics', notes: '' },
    { name: 'Werner Heisenberg', group: 'Quantum Physics', notes: '' },
    { name: 'Erwin Schrödinger', group: 'Quantum Physics', notes: '' },
    { name: 'Paul Dirac', group: 'Quantum Physics', notes: 'Very quiet' },

    // Astrophysics & Space
    { name: 'Stephen Hawking', group: 'Astrophysics', notes: 'Special Guest' },
    { name: 'Katherine Johnson', group: 'Astrophysics', notes: 'VIP' },
    { name: 'Carl Sagan', group: 'Astrophysics', notes: 'Needs starry ceiling view' },
    { name: 'Galileo Galilei', group: 'Astrophysics', notes: '' },
    { name: 'Nicolaus Copernicus', group: 'Astrophysics', notes: '' },
    { name: 'Edwin Hubble', group: 'Astrophysics', notes: '' },
    { name: 'Jocelyn Bell Burnell', group: 'Astrophysics', notes: '' },
    { name: 'Subrahmanyan Chandrasekhar', group: 'Astrophysics', notes: '' },

    // Computation & Tech
    { name: 'Alan Turing', group: 'Computation', notes: 'Loves apples' },
    { name: 'Ada Lovelace', group: 'Computation', notes: 'First programmer' },
    { name: 'Grace Hopper', group: 'Computation', notes: 'Brought a physical nanosecond' },
    { name: 'Claude Shannon', group: 'Computation', notes: '' },
    { name: 'Tim Berners-Lee', group: 'Computation', notes: '' },
    { name: 'John von Neumann', group: 'Computation', notes: '' },
    { name: 'Margaret Hamilton', group: 'Computation', notes: '' },
    { name: 'Dennis Ritchie', group: 'Computation', notes: '' },

    // Philosophy
    { name: 'Socrates', group: 'Philosophy', notes: 'Questioning everything' },
    { name: 'Plato', group: 'Philosophy', notes: 'Cave allegory mentor' },
    { name: 'Aristotle', group: 'Philosophy', notes: '' },
    { name: 'René Descartes', group: 'Philosophy', notes: 'Thinks, therefore is' },
    { name: 'Immanuel Kant', group: 'Philosophy', notes: '' },
    { name: 'Friedrich Nietzsche', group: 'Philosophy', notes: '' },
    { name: 'Jean-Paul Sartre', group: 'Philosophy', notes: '' },
    { name: 'Albert Camus', group: 'Philosophy', notes: '' },

    // Life Sciences
    { name: 'Charles Darwin', group: 'Life Sciences', notes: '' },
    { name: 'Gregor Mendel', group: 'Life Sciences', notes: 'Loves peas' },
    { name: 'Rosalind Franklin', group: 'Life Sciences', notes: '' },
    { name: 'Louis Pasteur', group: 'Life Sciences', notes: '' },
    { name: 'Rachel Carson', group: 'Life Sciences', notes: 'Environmentalist' },
    { name: 'Jane Goodall', group: 'Life Sciences', notes: 'VIP' },
    { name: 'Alexander Fleming', group: 'Life Sciences', notes: 'Penicillin' },
    { name: 'Barbara McClintock', group: 'Life Sciences', notes: '' },
  ];

  const guests: Guest[] = scholarsRaw.map((raw, idx) => {
    // Let's seat the first 24 guests completely in LECTURE SEGMENT 1 (seatIndex 0 to 23)
    // Let's seat the next 12 guests in LECTURE SEGMENT 2 (seatIndex 0 to 11)
    // Let's leave the remaining 4 guests unassigned so they can be manually dragged
    let tableId: string | null = null;
    let seatIndex: number | null = null;

    if (idx < 24) {
      tableId = 'table_lecture_sample_1';
      seatIndex = idx;
    } else if (idx < 36) {
      tableId = 'table_lecture_sample_2';
      seatIndex = idx - 24;
    }

    return {
      id: `guest_lecture_sample_${idx + 1}`,
      name: raw.name,
      tableId,
      seatIndex,
      group: raw.group,
      notes: raw.notes,
    };
  });

  return { guests, tables };
}

