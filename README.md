# 🍽️ Round Table Seating Planner & Banquet Coordinator

A high-fidelity, full-stack event planning and seating management web application designed for wedding coordinators, banquet hosts, seminar organizers, and venue managers. Built with a **Gourmet Serenity** aesthetic, it unifies spatial layout authoring, interactive guest seat assignments, custom table prototyping, tent card generation, and invitation dispatch into a responsive, single-pane workspace.

---

## 🌟 Key Features

### 1. Interactive SVG Seating Floorplan Arena
* **Upright Seating Orientation:** All chair slots, seat labels, and numbers render in a clean, upright orientation (`transform: 'none'`) regardless of table rotation or radial geometry.
* **Versatile Table Geometries:** Standard support for **Round**, **Rectangle**, **Square**, and **Banquet** tables with visual asset previews (`circle_on`, `rect_on`, `squ_on`, `banquet_on`).
* **Dual Event Modes:** Seamlessly switch between **Banquet Dining** (round/mixed layout clusters) and **Lecture Hall** (columnar matrices and classroom configurations).
* **Live In-Place Table Settings:** Instant real-time customization of table names, capacities, shape presets, color tags, font sizes, and seat number visibility directly from the table card options menu.
* **Fluid Drag-and-Drop & Quick Swapping:** Click-to-seat, drag-and-drop, and two-click seat swapping with automatic conflict resolution.

### 2. Multi-Event Manager & Setup Wizard
* **Guided 6-Step Setup Wizard:** Step-by-step project onboarding configuring basics, date, venue location, estimated guest count, layout mode, and default seating shapes with instant validation.
* **Event Summary & In-Place Editing Canvas:** A dedicated summary modal for reviewing live statistics (Total Tables, Total Seating Capacity, Seated vs. Unassigned Guests, Dietary Alerts) and updating event specifications without losing state.
* **Multi-Event Workspace:** Create, switch, and delete multiple seating plans with local persistence.

### 3. Dynamic Table Builder Studio
* **Parametric Geometric Prototyping:** Build custom tables from 8 geometric primitives (**Circle**, **Rectangle**, **Square**, **Oval**, **Semi-circle**, **Quarter circle**, **Polygon**, and **Long Banquet**).
* **Interactive Seat Distribution:** Manual point-and-click seat placement or automatic perimeter-balanced seat distribution.
* **Specialized Seat Roles:** Assign seat classifications including **VIP**, **Standard**, **Kid**, **Wheelchair Accessibility**, and **Spacer**.
* **Template Library:** Save custom table templates to the workspace library for instant reuse across events.

### 4. Architectural Room Layout Designer
* **Room Elements Artboard:** Place architectural boundaries including walls, doors, windows, stage banners, and custom text markers.
* **Quick Delete & Clear Controls:** Direct top-right delete action badge on selected elements and a dedicated "Clear Canvas" action with inline confirmation.
* **Spatial Transformation:** Drag, rotate, scale, and snap elements with exact coordinate tracking and JSON blueprint export.

### 5. Foldable Tent Card Studio
* **Print-Ready Place Cards:** Real-time generation of double-sided foldable place cards (or flat badges) for all seated attendees.
* **Typography & Styling Controls:** Customizable fonts, font sizing, border flourishes, fold lines, cut guides, and table marker indicators.
* **Standard Paper Formats:** Supports International **A4** and **US Letter** sheets with multi-card grid layouts.

### 6. Invitation Studio & WYSIWYG Dispatch
* **TipTap Rich Text Editor:** Full WYSIWYG editor with text formatting, custom color palettes, image insertion, and HTML sanitization.
* **Image Cropper Modal:** Integrated aspect-ratio image cropping for invitation headers and sponsor branding.
* **Gmail OAuth2 Integration:** Secure Google OAuth2 token management for direct invitation dispatch and RSVP status tracking.

### 7. High-DPI PDF & Document Export Engine
* **Multiple Printable Formats:**
  - **Visual Floorplan Sheet**: High-res landscape/portrait overview of the entire venue floorplan.
  - **Specific Table Guides**: Clean, individual table booklets (one page per table) listing guest names at each seat. Vacant seats remain clean and unlabelled.
  - **Alphabetical Directory**: Complete guest index sorted by name with assigned table/seat numbers and dietary notes.
  - **High-Res JPEGs & PNGs**: Direct image exports for digital sharing.
* **Configurable Logging Metadata:** Optional toggle to include printing timestamps and generation metadata (disabled by default for clean presentation sheets).

---

## 🛠️ Technology Stack

* **Frontend:** React 19, TypeScript, Vite 6, Tailwind CSS
* **Rich Text Editing:** TipTap Editor (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-image`)
* **Vector Graphics & Icons:** Lucide React, SVG `<foreignObject>`
* **Backend:** Node.js, Express 4, TypeScript (`tsx`)
* **Database & Sessions:** SQLite (`better-sqlite3-session-store`, `sqlite3`)
* **Export Utilities:** `jsPDF`, `html-to-image`, `html2canvas`, `papaparse`, `xlsx`

---

## 📦 Getting Started

### 1. Prerequisites
- **Node.js**: `v20.0.0` or higher
- **npm**: `v9.0.0` or higher

### 2. Installation
```bash
# Clone the repository
git clone <repository-url>
cd round-table-seating-planner

# Install dependencies
npm install
```

### 3. Environment Configuration (`.env`)
Create a `.env` file in the project root:

```env
# Server Port
PORT=3000

# Session & Security
SESSION_SECRET=your_random_session_secret_key_min_16_chars
ADMIN_PASSWORD=your_admin_dashboard_password

# Google OAuth2 Settings (Optional - for Invitation Email Dispatch)
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

### 4. Running the Application

#### Development Mode
```bash
npm run dev
```
Access the application at **`http://localhost:3000`**.

#### Production Build & Run
```bash
# Build the client bundle and compile server
npm run build

# Start the production server
npm start
```

---

## 🔒 Privacy & Local Storage Architecture

All seating arrangements, table configurations, architectural plans, guest lists, and dietary data are persisted directly inside your browser's **`localStorage`**. No sensitive event or guest data is transmitted to external third-party services unless you explicitly configure Google OAuth for invitation emailing.

---

*Designed for seamless banquet coordination, spatial precision, and memorable events.*

