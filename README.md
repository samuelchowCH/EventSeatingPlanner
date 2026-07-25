# 🍽️ Seating Planner & Banquet Coordinator (DishDash Engine)

A high-fidelity, interactive full-stack web application designed for wedding planners, banquet organizers, and dinner hosts to organize layouts, assign seats, generate custom table styles, and produce print-ready event assets. Blending geometric precision with generative intelligence, this app brings order and gourmet aesthetics to event coordination.

---

## 🌟 The Aim & Philosophy

Planning seating arrangements for modern banquets is an intricate puzzle balancing spatial limitations, guest relationships, dietary requirements, and visual themes. The **Seating Planner** streamlines this process into a unified, fluid workspace. Adhering to a "Gourmet Serenity" theme, it leverages a high-performance **interactive SVG vector floorplan canvas** paired with **Generative AI Styling** to translate natural-language wedding prompts into elegant visual layouts.

---

## 🚀 Key Features

### 1. Interactive SVG Floorplan Arena
*   **Vector Precision:** Custom-rendered SVG table structures (Round, Rectangle, Square, Banquet, Banana, Nano, and Custom shapes) that scale perfectly on ultra-wide screens or tablets.
*   **Drag-to-Select & Drag-and-Drop:** Intuitive interaction models allowing planners to quickly select, swap, seat, or unseat guests across tables dynamically.
*   **Dual Event Modes:** Toggle effortlessly between classic **Dining Banquets** and **Seminar/Lecture Matrices** with automatic alignment generators.

### 2. Generative AI Style Designer (Powered by Gemini)
*   **Prompt-to-Theme Synthesis:** Uses **Gemini 3.5 Flash** to create themed color schemes based on event prompts (e.g., *"Vintage Emerald & Rose Gold Wedding"*, *"Celestial Midnight Banquet"*).
*   **Dynamic Visual Elements:** Generates a custom styled color spectrum including Solid Hex table fills, contrasting outlines, custom grid opacities, and responsive container ambient overlays.

### 3. Bulletproof API Error Resilience
*   **High-Demand Handling:** Integrated middleware that intercepts Gemini API status code spikes (such as `503 Unavailable` due to sudden demand spikes) and gracefully communicates a friendly error state while preserving layout progress.
*   **Auto-Retry Backoff Engine:** Server-side fetch wrappers that perform up to 3 automated retries with backoff delays when encountering transient network timeouts (`HeadersTimeoutError`).
*   **Graceful Local Fallback:** Immediate fallback options that keep the application operational even when client-side api-keys are unconfigured or unavailable.

### 4. Bulk Guest List Management
*   **Smart Uploads:** Accept CSV or Excel guest registers with tags, dietary preferences, and VIP flags.
*   **Intelligent Auto-Seating:** Instantly parse guest dependencies and auto-distribute them to tables based on seat capacity.

### 5. Tent Card Studio & Live Preview
*   **Custom Place Cards:** Craft elegant custom-printed place cards and table markers for attendees.
*   **Export Ready:** Instantly export layouts to PDF vectors for caterers, wedding coordinators, and site decorators.

---

## 🛠️ Technology Stack

*   **Frontend:** React 18 (TypeScript), Vite, Tailwind CSS (Modern Utility styling)
*   **Icons:** Lucide React (Clean, minimalist typography-focused iconography)
*   **AI Engine:** Google GenAI SDK (`@google/genai`) on Express backend (protecting keys securely)
*   **Layout Engine:** Raw SVG Math Matrices for responsive coordinates
*   **State & Persistence:** LocalStorage-based caching to prevent data-loss on refresh

---

## 📦 Setting Up Locally

To set up the project and connect the AI Style Generative Synthesizer, configure your environmental settings:

1. Create a `.env` file in the root directory based on `.env.example`:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

2. Install the necessary server and UI packages:
   ```bash
   npm install
   ```

3. Spin up the local development suite:
   ```bash
   npm run dev
   ```

The application dev server will automatically boot and synchronize client/backend routes on port `3000`.

---

*Made with precision for gourmet banquets and unforgettable memories.*
