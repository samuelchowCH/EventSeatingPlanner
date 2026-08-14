# 🍽️ Seating Planner & Banquet Coordinator (DishDash Engine)

A high-fidelity, interactive full-stack web application designed for wedding planners, banquet organizers, and dinner hosts to organize layouts, assign seats, generate custom table styles, manage guest invitations, and produce print-ready event assets. Blending geometric precision with generative intelligence, this app brings order and gourmet aesthetics to event coordination.

---

## 🌟 The Aim & Philosophy

Planning seating arrangements for modern banquets is an intricate puzzle balancing spatial limitations, guest relationships, dietary requirements, visual themes, and attendee communication. The **Seating Planner** streamlines this process into a unified, fluid workspace. Adhering to a "Gourmet Serenity" theme, it combines a high-performance **interactive SVG vector floorplan canvas**, **Generative AI Styling**, and a **Rich Invitation Studio** to bring event concepts to life seamlessly.

---

## 🚀 Key Features

### 1. Interactive SVG Floorplan Arena
* **Vector Precision:** Custom-rendered SVG table structures (Round, Rectangle, Square, Banquet, Banana, Nano, and Custom shapes) that scale perfectly on ultra-wide screens or mobile devices.
* **Drag-to-Select & Drag-and-Drop:** Intuitive interaction models allowing planners to quickly select, swap, seat, or unseat guests across tables dynamically.
* **Dual Event Modes:** Toggle effortlessly between classic **Dining Banquets** and **Seminar/Lecture Matrices** with automatic alignment generators.

### 2. Dual Generative AI Style Engines (Gemini & Aliyun Bailian)
* **Prompt-to-Theme Synthesis:** Support for both **Google Gemini API** and **Aliyun Bailian / DashScope API (阿里云百炼)** to create themed color schemes based on natural language prompts (e.g., *"Vintage Emerald & Rose Gold Wedding"*, *"Celestial Midnight Banquet"*).
* **AI Background Image Generation:** Generates custom high-resolution background artwork using Aliyun Qwen Image Synthesis (`qwen-image-plus`) or Gemini vision models.
* **Flexible Gateway Configuration:** Native support for regional gateways (`DASHSCOPE_BASE_URL`), workspace header routing (`X-DashScope-WorkSpace`), and automatic async task polling.

### 3. Invitation Studio & WYSIWYG Editor
* **TipTap Rich Text Editor:** Full WYSIWYG body editor with font sizing, custom text/highlight colors, image insertion, hyperlink management, and clean HTML sanitization.
* **Interactive Image Crop Modal:** Built-in image cropping tool with aspect ratio controls for customizing email header banners and sponsor logos.
* **RSVP & Email Dispatch Workflows:** Send branded invitations, manage guest email queues, and preview responsive HTML templates.
* **Google OAuth2 Integration:** Integrated Gmail API authentication for secure, rate-managed invitation delivery.

### 4. High-DPI PDF & Visual Exporting
* **Crash-Proof Engine:** Powered by browser-native SVG `<foreignObject>` canvas rendering (`domImageExporter.ts`).
* **Modern CSS Support:** Robust compatibility with modern CSS color spaces (`oklab()`, `oklch()`) ensuring export operations never crash or alter live application styling.
* **Print-Ready Outputs:** Export complete floor plans, table cards, and tent cards directly to PNG/JPEG or PDF for caterers and decorators.

### 5. Bulk Guest Management & Admin Control
* **Smart Uploads:** Import CSV or Excel registers with dietary notes, group affiliations, and VIP flags.
* **Intelligent Auto-Seating:** Automatically seat guest groups based on table capacities.
* **Admin Security Panel:** SQLite-backed persistent database (`server/db.ts`) with password hashing and session authentication for managing invitation queues and system settings.

---

## 🛠️ Technology Stack

* **Frontend:** React 18, TypeScript, Vite, Tailwind CSS
* **WYSIWYG Editor:** TipTap Editor (`@tiptap/react`, `@tiptap/starter-kit`)
* **Icons:** Lucide React
* **Backend:** Express.js (Node.js), TypeScript
* **Database:** SQLite (`better-sqlite3`)
* **AI Engines:** Google GenAI SDK (`@google/genai`), Aliyun DashScope API (`qwen-plus`, `qwen-image-plus`)
* **Exporting:** `html-to-image`, `jsPDF`

---

## 📦 Local Environment Setup Procedure

Follow these steps to set up and run the project locally.

### 1. Prerequisites
- **Node.js**: `v18.0.0` or higher
- **npm**: `v9.0.0` or higher

### 2. Installation
Clone the repository and install all dependencies:
```bash
git clone <repository-url>
cd round-table-seating-planner
npm install
```

### 3. Environment Configuration (`.env`)
Create a `.env` file in the project root directory based on your preferred AI provider:

```env
# Server Port
PORT=3000

# Active AI Provider: 'gemini' or 'aliyun'
AI_PROVIDER=aliyun

# -----------------------------------------------------------------
# Option A: Aliyun Bailian / DashScope Configuration (Default)
# -----------------------------------------------------------------
DASHSCOPE_API_KEY=sk-your_aliyun_dashscope_api_key
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/api/v1
DASHSCOPE_IMAGE_BASE_URL=https://dashscope.aliyuncs.com
ALIYUN_TEXT_MODEL=qwen-plus
ALIYUN_IMAGE_MODEL=qwen-image-plus
DASHSCOPE_WORKSPACE_ID=your_dashscope_workspace_id_here

# -----------------------------------------------------------------
# Option B: Google Gemini Configuration
# -----------------------------------------------------------------
GEMINI_API_KEY=your_google_gemini_api_key

# -----------------------------------------------------------------
# Google OAuth2 Settings (Optional - for Invitation Email Dispatch)
# -----------------------------------------------------------------
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# -----------------------------------------------------------------
# Admin Dashboard & Security (Optional)
# -----------------------------------------------------------------
ADMIN_PASSWORD=your_secure_admin_password
SESSION_SECRET=your_random_session_secret_key_min_16_chars
```

### 4. Admin Account Initialization (Optional)
To set or update the administrator password for the invitation dashboard:
```bash
node scripts/set-admin-password.js <your_password>
```

### 5. Running the Application

#### Development Mode (Concurrent Vite + Server Hot-Reload)
```bash
npm run dev
```
The application dev server will boot on **`http://localhost:3000`**.

#### Production Build & Run
```bash
# 1. Build the production bundle
npm run build

# 2. Start the production server
npm start
```

---

## 🔒 Privacy & Data Protection Notice

All floorplan geometry, guest registers, seating assignments, and dietary notes are stored **exclusively inside your browser's local storage (`localStorage`)**. Prompts for AI style and background image generation are proxied securely through your local Express server directly to your configured provider (Google Gemini or Aliyun Bailian).

---

*Made with precision for gourmet banquets and unforgettable memories.*
