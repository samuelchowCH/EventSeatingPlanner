import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import helmet from "helmet";
import cors from "cors";
import session from "express-session";
import { config } from "./server/config.js";
import { getDb } from "./server/db.js";
import { startQueueWorker } from "./server/services/queueWorker.js";
import adminRouter from "./server/routes/admin.js";
import authRouter from "./server/routes/auth.js";
import invitationsRouter from "./server/routes/invitations.js";
import { generateBailianStyle, generateBailianImage, getBailianApiKey } from "./server/services/aliyunBailian.js";

dotenv.config();

/**
 * Minimal SQLite-backed session store — avoids Windows EPERM file rename errors
 * that plague session-file-store on Windows.
 */
class SQLiteSessionStore extends session.Store {
  private ready = false;

  constructor() {
    super();
    // Ensure sessions table exists
    getDb().then((db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          sid   TEXT NOT NULL PRIMARY KEY,
          sess  TEXT NOT NULL,
          expire INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire);
      `).then(() => { this.ready = true; }).catch(console.error);
    }).catch(console.error);
  }

  async get(sid: string, callback: (err: any, session?: session.SessionData | null) => void) {
    try {
      const db = await getDb();
      const row = await db.get<{ sess: string; expire: number }>(
        'SELECT sess, expire FROM sessions WHERE sid = ?', [sid]
      );
      if (!row || row.expire < Date.now()) {
        return callback(null, null);
      }
      callback(null, JSON.parse(row.sess));
    } catch (err) { callback(err); }
  }

  async set(sid: string, sessionData: session.SessionData, callback?: (err?: any) => void) {
    try {
      const db = await getDb();
      const expire = Date.now() + 8 * 60 * 60 * 1000; // 8h
      await db.run(
        `INSERT INTO sessions (sid, sess, expire) VALUES (?, ?, ?)
         ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expire = excluded.expire`,
        [sid, JSON.stringify(sessionData), expire]
      );
      callback?.();
    } catch (err) { callback?.(err); }
  }

  async destroy(sid: string, callback?: (err?: any) => void) {
    try {
      const db = await getDb();
      await db.run('DELETE FROM sessions WHERE sid = ?', [sid]);
      callback?.();
    } catch (err) { callback?.(err); }
  }

  async touch(sid: string, _session: session.SessionData, callback?: (err?: any) => void) {
    try {
      const db = await getDb();
      const expire = Date.now() + 8 * 60 * 60 * 1000;
      await db.run('UPDATE sessions SET expire = ? WHERE sid = ?', [expire, sid]);
      callback?.();
    } catch (err) { callback?.(err); }
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize SQLite database and start queue worker
  try {
    await getDb();
    startQueueWorker();
  } catch (err) {
    console.error("Failed to initialize SQLite database or start queue worker:", err);
  }

  // RF-09: Helmet security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "blob:"],
          connectSrc: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  );

  // RF-08: CORS — allow both localhost:3000 and 127.0.0.1:3000 so dev access works regardless of host used
  const allowedOrigins = new Set([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    ...(process.env.APP_URL ? [process.env.APP_URL.trim()] : []),
  ]);
  app.use(
    cors({
      origin: (origin, cb) => {
        // Allow requests with no origin (same-origin, curl, etc.)
        if (!origin || allowedOrigins.has(origin)) return cb(null, true);
        cb(new Error(`CORS: origin '${origin}' not allowed`));
      },
    })
  );

  // RF-11: Raise JSON body limit to 10mb to support inline base64 image payloads from the email template editor
  app.use(express.json({ limit: "10mb" }));

  const isProd = process.env.NODE_ENV === "production";
  const cookieName = isProd ? "__Host-seating-sid" : "seating-sid";

  // SQLite-backed session store (no file rename, no EPERM on Windows)
  app.use(
    session({
      name: cookieName,
      secret: config.sessionSecret || "default_fallback_secret_must_be_overridden_in_env_file",
      resave: false,
      saveUninitialized: false,
      rolling: true,
      store: new SQLiteSessionStore(),
      cookie: {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        maxAge: 30 * 60 * 1000,
      },
    })
  );

  // Mount API Routers
  app.use("/api/admin", adminRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/invitations", invitationsRouter);
  app.use("/unsubscribe", invitationsRouter);

  const apiKey = process.env.GEMINI_API_KEY;
  const hasApiKey = apiKey && apiKey.trim() !== "" && apiKey !== "undefined";

  const ALLOWED_EVENT_TYPES = ["Wedding", "Seminar", "Birthday", "Corporate", "Other"];

  // API endpoint for AI Style Prompt Generator (supports Gemini & Aliyun Bailian)
  const handleStyleGeneration = async (req: express.Request, res: express.Response) => {
    try {
      const { prompt, provider = "gemini" } = req.body;

      // Length cap & type validation
      if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
        return res.status(400).json({ error: "Prompt is required and must be a string" });
      }
      if (prompt.length > 2000) {
        return res.status(400).json({ error: "Prompt must be 2000 characters or fewer" });
      }

      console.log(`[AI Style Generation - Provider: ${provider}] Length: ${prompt.length} chars\nPrompt:\n"${prompt}"\n`);

      if (provider === "aliyun") {
        if (!getBailianApiKey()) {
          return res.status(400).json({
            error: "Aliyun Bailian API Key (ALIYUN_BAILIAN_API_KEY or DASHSCOPE_API_KEY) is not set in .env file.",
          });
        }
        const styleData = await generateBailianStyle(prompt);
        return res.json(styleData);
      }

      if (!hasApiKey) {
        // Fallback placeholder mock style response if key is missing, to keep app running gracefully
        return res.json({
          name: `${prompt.substring(0, 15)} Style`,
          fillColor: "#FAF5FF",
          strokeColor: "#8B5CF6",
          strokeWidth: 4,
          backgroundColor: "#F3F4F6",
          gridOpacity: 0.15
        });
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      let attempts = 0;
      const maxAttempts = 3;
      let lastError: any = null;
      let response: any = null;

      while (attempts < maxAttempts) {
        try {
          attempts++;
          response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: `Create a professional theme color scheme for a wedding banquet or dinner table based on the user prompt: "${prompt}".
Output colors in hex format (e.g. "#FF0000").
Give it a short, elegant name.`,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  name: {
                    type: Type.STRING,
                    description: "Short elegant style name (2-4 words)",
                  },
                  fillColor: {
                    type: Type.STRING,
                    description: "Solid Hex background color for the table (e.g. #FFF9F9, #4A2E1B, #C41E3A, #FAF5FF)",
                  },
                  strokeColor: {
                    type: Type.STRING,
                    description: "Hex border/accent color for the table outline (e.g. #FFD700, #9E8A63, #B76E79, #8B5CF6)",
                  },
                  strokeWidth: {
                    type: Type.INTEGER,
                    description: "Stroke border width in pixels, typically between 2 and 6",
                  },
                  backgroundColor: {
                    type: Type.STRING,
                    description: "Hex background color of the preview container area, must contrast well with table (e.g., light neutral slate, soft warm beige or rich ambient cream)",
                  },
                  gridOpacity: {
                    type: Type.NUMBER,
                    description: "Blueprint grid lines visibility fraction, e.g. between 0.05 and 0.35",
                  },
                },
                required: ["name", "fillColor", "strokeColor", "strokeWidth", "backgroundColor", "gridOpacity"],
              }
            }
          });
          break;
        } catch (err: any) {
          lastError = err;
          console.warn(`Gemini generation attempt ${attempts} failed:`, err?.message || err);
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, attempts * 1000));
          }
        }
      }

      if (!response) {
        throw lastError || new Error("Failed to contact Gemini service after maximum retries");
      }

      const responseText = response.text;
      if (!responseText) {
        throw new Error("Empty response from Gemini API");
      }

      const styleData = JSON.parse(responseText.trim());
      res.json(styleData);
    } catch (error: any) {
      console.error("Gemini API Error:", error);

      const errStr = error?.message || error?.toString() || "";
      const causeStr = error?.cause?.message || error?.cause?.toString() || "";
      const combinedErrorText = `${errStr} ${causeStr}`.toLowerCase();

      const isHighDemand = combinedErrorText.includes("503") ||
        combinedErrorText.includes("high demand") ||
        combinedErrorText.includes("unavailable") ||
        combinedErrorText.includes("overloaded") ||
        error?.status === 503;

      const isTimeout = combinedErrorText.includes("timeout") ||
        combinedErrorText.includes("und_err") ||
        combinedErrorText.includes("fetch failed");

      if (isHighDemand) {
        return res.status(503).json({ error: "The model is currently experiencing high demand, please try later." });
      }

      if (isTimeout) {
        return res.status(504).json({ error: "The style generator connection timed out. Please try again in a moment." });
      }

      // RF-04: Sanitized client error response
      res.status(500).json({ error: "Failed to generate style colors. Please try again." });
    }
  };

  app.post("/api/gemini/style", handleStyleGeneration);
  app.post("/api/ai/style", handleStyleGeneration);

  // API endpoint for AI Background Image Generation (Gemini & Aliyun Wanx)
  const handleImageGeneration = async (req: express.Request, res: express.Response) => {
    try {
      const { prompt, provider = "gemini" } = req.body;

      // Length cap & type validation
      if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
        return res.status(400).json({ error: "Prompt is required and must be a string" });
      }
      if (prompt.length > 2000) {
        return res.status(400).json({ error: "Prompt must be 2000 characters or fewer" });
      }

      console.log(`[AI Style Generation - Provider: ${provider}] Length: ${prompt.length} chars\nPrompt:\n"${prompt}"\n`);

      if (provider === "aliyun") {
        if (!getBailianApiKey()) {
          return res.status(400).json({
            error: "Aliyun Bailian API Key (ALIYUN_BAILIAN_API_KEY or DASHSCOPE_API_KEY) is not set in .env file.",
          });
        }
        const data = await generateBailianImage(prompt);
        return res.json(data);
      }

      if (!hasApiKey) {
        // Fallback: return a minimal placeholder SVG as a data URI when no API key is configured
        const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1190" height="842" viewBox="0 0 1190 842">
  <defs>
    <radialGradient id="pg" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#fff9f0"/>
      <stop offset="100%" stop-color="#f0e6d3"/>
    </radialGradient>
  </defs>
  <rect width="1190" height="842" fill="url(#pg)"/>
  <rect x="24" y="24" width="1142" height="794" fill="none" stroke="#C9A96E" stroke-width="3" stroke-dasharray="12,6" opacity="0.5"/>
  <text x="595" y="440" text-anchor="middle" font-family="serif" font-size="22" fill="#C9A96E" opacity="0.7">AI Background (API key required)</text>
</svg>`;
        const b64 = Buffer.from(placeholderSvg).toString("base64");
        return res.json({ imageUri: `data:image/svg+xml;base64,${b64}` });
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: { "User-Agent": "aistudio-build" },
        },
      });

      let attempts = 0;
      const maxAttempts = 3;
      let lastError: any = null;
      let response: any = null;

      while (attempts < maxAttempts) {
        try {
          attempts++;
          // Call Imagen 4 Generate model
          try {
            response = await ai.models.generateImages({
              model: "imagen-4-generate",
              prompt: prompt,
              config: {
                numberOfImages: 1,
                outputMimeType: "image/jpeg",
                aspectRatio: "1:1",
              },
            });
            if (response && response.generatedImages && response.generatedImages[0]) {
              const b64 = response.generatedImages[0].image.imageBytes;
              return res.json({ imageUri: `data:image/jpeg;base64,${b64}` });
            }
          } catch (imagenErr: any) {
            console.warn(`Imagen 4 attempt failed, trying imagen-3.0-generate-002:`, imagenErr?.message || imagenErr);
            response = await ai.models.generateImages({
              model: "imagen-3.0-generate-002",
              prompt: prompt,
              config: {
                numberOfImages: 1,
                outputMimeType: "image/jpeg",
                aspectRatio: "1:1",
              },
            });
            if (response && response.generatedImages && response.generatedImages[0]) {
              const b64 = response.generatedImages[0].image.imageBytes;
              return res.json({ imageUri: `data:image/jpeg;base64,${b64}` });
            }
          }
          break;
        } catch (err: any) {
          lastError = err;
          console.warn(`Image generation attempt ${attempts} failed:`, err?.message || err);
          if (attempts < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, attempts * 1500));
          }
        }
      }

      if (!response) {
        throw lastError || new Error("Failed to contact image generation service after maximum retries");
      }

      // Extract the inline image bytes from the response parts
      let imagePart: any = null;
      if (response.candidates && response.candidates[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData && part.inlineData.mimeType?.startsWith("image/")) {
            imagePart = part.inlineData;
            break;
          }
        }
      }

      if (!imagePart) {
        throw new Error("No image was returned by the generation model");
      }

      const mimeType = imagePart.mimeType || "image/png";
      const imageUri = `data:${mimeType};base64,${imagePart.data}`;
      res.json({ imageUri });
    } catch (error: any) {
      console.error("Image Generation API Error:", error);

      const errStr = error?.message || error?.toString() || "";
      const causeStr = error?.cause?.message || error?.cause?.toString() || "";
      const combinedErrorText = `${errStr} ${causeStr}`.toLowerCase();

      const isQuotaExceeded =
        combinedErrorText.includes("quota") ||
        combinedErrorText.includes("429") ||
        combinedErrorText.includes("resource_exhausted") ||
        combinedErrorText.includes("limit: 0") ||
        error?.status === 429;

      const isHighDemand =
        combinedErrorText.includes("503") ||
        combinedErrorText.includes("high demand") ||
        combinedErrorText.includes("unavailable") ||
        combinedErrorText.includes("overloaded") ||
        error?.status === 503;

      const isTimeout =
        combinedErrorText.includes("timeout") ||
        combinedErrorText.includes("und_err") ||
        combinedErrorText.includes("fetch failed");

      if (isQuotaExceeded) {
        return res.status(429).json({
          error: "API Quota Exceeded (Free Tier limit reached). Please wait a few seconds or upgrade your Gemini API plan."
        });
      }
      if (isHighDemand) {
        return res.status(503).json({ error: "The image generator is experiencing high demand. Please try again in a moment." });
      }
      if (isTimeout) {
        return res.status(504).json({ error: "The image generation request timed out. Please try again." });
      }

      // RF-04: Sanitized client error response
      res.status(500).json({ error: "Failed to generate background image. Please try again." });
    }
  };

  app.post("/api/gemini/image", handleImageGeneration);
  app.post("/api/ai/image", handleImageGeneration);

  // API endpoint for AI Project Setup Recommendations
  app.post("/api/gemini/setup", async (req, res) => {
    try {
      const { name, eventType, description, venueName, venueCity, guestCount } = req.body;

      // RF-03: Input validation and length caps
      if (!description && !eventType) {
        return res.status(400).json({ error: "At least eventType or description is required" });
      }
      if (name && (typeof name !== "string" || name.length > 100)) {
        return res.status(400).json({ error: "Name must be a string of 100 characters or fewer" });
      }
      if (eventType && (typeof eventType !== "string" || !ALLOWED_EVENT_TYPES.includes(eventType))) {
        return res.status(400).json({ error: "Invalid eventType provided" });
      }
      if (description && (typeof description !== "string" || description.length > 500)) {
        return res.status(400).json({ error: "Description must be a string of 500 characters or fewer" });
      }
      if (venueName && (typeof venueName !== "string" || venueName.length > 100)) {
        return res.status(400).json({ error: "venueName must be a string of 100 characters or fewer" });
      }
      if (venueCity && (typeof venueCity !== "string" || venueCity.length > 100)) {
        return res.status(400).json({ error: "venueCity must be a string of 100 characters or fewer" });
      }

      if (!hasApiKey) {
        // Graceful mock so the wizard works without an API key
        return res.json({
          themeName: "Classic Ivory",
          fillColor: "#FAFAF7",
          strokeColor: "#C8B89A",
          strokeWidth: 3,
          backgroundColor: "#F5F0E8",
          gridOpacity: 0.12,
          defaultTableShape: "round",
          defaultTableSeats: 8,
          arenaMode: "dining",
          setupNotes: "A clean, neutral theme suitable for most events."
        });
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey!,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      const prompt = `You are a professional event planner helping configure a seating arrangement app.
Event details:
- Name: ${name || "Unnamed event"}
- Type: ${eventType || "General"}
- Description: ${description || "No description provided"}
- Venue: ${venueName || "Unknown venue"}
- Estimated guests: ${guestCount || "Unknown"}

Recommend a visual theme and seating defaults. Output colors as hex strings (e.g. "#FF0000").`;

      let attempts = 0;
      const maxAttempts = 3;
      let lastError: any = null;
      let response: any = null;

      while (attempts < maxAttempts) {
        try {
          attempts++;
          response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  themeName: { type: Type.STRING, description: "Short elegant theme name (2-4 words)" },
                  fillColor: { type: Type.STRING, description: "Hex background color for tables" },
                  strokeColor: { type: Type.STRING, description: "Hex border/accent color for tables" },
                  strokeWidth: { type: Type.INTEGER, description: "Border width 2-6px" },
                  backgroundColor: { type: Type.STRING, description: "Hex canvas background color" },
                  gridOpacity: { type: Type.NUMBER, description: "Grid lines opacity 0.05-0.35" },
                  defaultTableShape: {
                    type: Type.STRING,
                    description: "Recommended table shape: 'round', 'rectangle', 'square', or 'banquet'"
                  },
                  defaultTableSeats: { type: Type.INTEGER, description: "Recommended seats per table (4-20)" },
                  arenaMode: { type: Type.STRING, description: "'dining' or 'lecture'" },
                  setupNotes: { type: Type.STRING, description: "One sentence explaining the recommendations" },
                },
                required: ["themeName", "fillColor", "strokeColor", "strokeWidth", "backgroundColor", "gridOpacity", "defaultTableShape", "defaultTableSeats", "arenaMode", "setupNotes"],
              }
            }
          });
          break;
        } catch (err: any) {
          lastError = err;
          console.warn(`Gemini setup attempt ${attempts} failed:`, err?.message || err);
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, attempts * 1000));
          }
        }
      }

      if (!response) {
        throw lastError || new Error("Failed to contact Gemini service after maximum retries");
      }

      const responseText = response.text;
      if (!responseText) throw new Error("Empty response from Gemini API");

      const setupData = JSON.parse(responseText.trim());

      // Server-side validation: enforce allowed values
      const allowedShapes = ["round", "rectangle", "square", "banquet", "banana", "nano"];
      if (!allowedShapes.includes(setupData.defaultTableShape)) {
        setupData.defaultTableShape = "round";
      }
      if (!["dining", "lecture"].includes(setupData.arenaMode)) {
        setupData.arenaMode = "dining";
      }
      const hexPattern = /^#[0-9A-Fa-f]{6}$/;
      for (const key of ["fillColor", "strokeColor", "backgroundColor"]) {
        if (!hexPattern.test(setupData[key])) {
          setupData[key] = key === "backgroundColor" ? "#F3F4F6" : "#6B7280";
        }
      }
      setupData.defaultTableSeats = Math.min(Math.max(Number(setupData.defaultTableSeats) || 8, 2), 30);
      setupData.gridOpacity = Math.min(Math.max(Number(setupData.gridOpacity) || 0.12, 0), 1);

      res.json(setupData);
    } catch (error: any) {
      console.error("Gemini Setup API Error:", error);
      const errStr = error?.message || error?.toString() || "";
      const causeStr = error?.cause?.message || error?.cause?.toString() || "";
      const combined = `${errStr} ${causeStr}`.toLowerCase();
      if (combined.includes("503") || combined.includes("unavailable") || combined.includes("overloaded")) {
        return res.status(503).json({ error: "AI service is temporarily unavailable. You can still create your event manually." });
      }
      if (combined.includes("timeout") || combined.includes("fetch failed")) {
        return res.status(504).json({ error: "AI service timed out. Your event data has been preserved." });
      }

      // RF-04: Sanitized client error response
      res.status(500).json({ error: "Failed to generate setup recommendations. Please try again." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // RF-15: Host binding (127.0.0.1 in dev, 0.0.0.0 in prod)
  const host = process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1";

  app.listen(PORT, host, () => {
    console.log(`Server running on http://${host}:${PORT}`);
  });
}

startServer();
