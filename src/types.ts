/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Guest {
  id: string;
  name: string;
  tableId: string | null; // ID of the table or null if unassigned
  seatIndex: number | null; // Index of the seat at the table (0-based) or null if unassigned
  group: string; // Group / Family / Organization / Tag
  email?: string;
  notes?: string;
  offsetX?: number; // Custom fine-tuning offset X
  offsetY?: number; // Custom fine-tuning offset Y
}

export interface TemplateSeat {
  id: string;
  label: string;
  x: number; // position on the coordinate system
  y: number; // position on the coordinate system
  rotation: number; // rotation in degrees
  side: 'Top' | 'Bottom' | 'Left' | 'Right' | 'Circle-around' | 'Other';
  type: 'Standard' | 'VIP' | 'Kid' | 'Empty/Spacer' | 'Wheelchair';
}

export interface TableTemplate {
  id: string;
  name: string;
  shape: 'Circle' | 'Rectangle' | 'Square' | 'Oval' | 'Semi-circle' | 'Quarter circle' | 'Polygon' | 'Long Banquet';
  width: number;
  height: number;
  radius?: number;
  sides?: number; // for Polygon
  seats: TemplateSeat[];
}

export interface Table {
  id: string;
  name: string; // e.g., "Table 1" or "Royal Garden"
  maxSeats: number; // e.g., 8, 10, 12
  color: string; // Hex or tailwind color code for visual distinction
  shape?: 'round' | 'rectangle' | 'square' | 'banquet' | 'banana' | 'nano' | 'custom' | 'seminar';
  templateId?: string; // ID of the custom template if any
  customSeats?: TemplateSeat[]; // Seating layout from template
  customShape?: 'Circle' | 'Rectangle' | 'Square' | 'Oval' | 'Semi-circle' | 'Quarter circle' | 'Polygon' | 'Long Banquet';
  customWidth?: number;
  customHeight?: number;
  customRadius?: number;
  customSides?: number;
  x?: number; // Visual coordinates if we do visual placement
  y?: number;
  fontColor?: string; // custom font color for table name/number
  fontSize?: number; // custom font size (px) for table name
  scale?: number; // scale factor of the table shape (e.g. 0.5 - 2.0)
  gridCellSize?: number; // custom grid cell size in lecture mode
  showSeatNumbers?: boolean; // option to toggle display of seat numbers
  seminarRows?: number;
  seminarSeatsPerRow?: number;
  seminarDirection?: 'Top' | 'Bottom' | 'Left' | 'Right';
  nameOffsetX?: number;
  nameOffsetY?: number;
  podiumOffsetX?: number;
  podiumOffsetY?: number;
}

export interface MappingOptions {
  nameColumn: string;
  tableColumn: string;
  seatColumn: string;
  groupColumn: string;
  notesColumn: string;
}

export type ExportLayoutType = 'floorplan' | 'table-cards' | 'alphabetical' | 'jpeg-images';

export interface CanvasElement {
  id: string;
  type: 'wall' | 'door' | 'window' | 'table_proxy' | 'text' | 'geometry_rect' | 'geometry_square' | 'geometry_circle' | 'geometry_oval' | 'geometry_polygon';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scale?: number;
  textData?: string;
  tableReferenceId?: string; // Links back to standard Table.id if type is 'table_proxy'
  customCornerRadius?: number; // for geometry rounded corners
  customSides?: number; // for geometry polygon sides
  color?: string; // custom color selected for wall, door, window, text, and geometry
}

export interface TableStyle {
  id: string;
  name: string;
  backgroundType: 'default' | 'chinese' | 'hotel' | 'western' | 'wedding' | 'custom';
  customAiPrompt?: string;
  backgroundImageUri?: string; // base64 data URI of AI-generated background art
  fillColor: string; // for custom/override background
  strokeColor: string; // stroke border color
  strokeWidth: number; // width of border
  backgroundColor: string; // container background color of preview
  gridOpacity: number; // grid lines opacity
  isPredefined?: boolean;
}

export type EventType = 'Wedding' | 'Seminar' | 'Birthday' | 'Corporate' | 'Other';

export interface EventMetadata {
  eventType?: EventType;
  description?: string;
  venueName?: string;
  venueCity?: string;
  guestCountEstimated?: number;
  dietaryNotes?: string;
  /** True for each field that the user has explicitly touched in the wizard */
  userConfirmedFields?: Partial<Record<keyof Omit<EventMetadata, 'userConfirmedFields'>, boolean>>;
}

export interface Event {
  id: string;
  name: string;
  date?: string;
  createdAt: number;
  updatedAt: number;
  guests: Guest[];
  tables: Table[];
  layoutElements: CanvasElement[];
  defaultTableShape: 'round' | 'rectangle' | 'square' | 'banquet' | 'banana' | 'nano' | 'custom';
  defaultTableSeats: number;
  arenaMode: 'dining' | 'lecture';
  customStyle?: TableStyle;
  metadata?: EventMetadata;
}


