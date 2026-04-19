import express from "express";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import the handlers from the API directory
// We can use dynamic import or just import them directly if we convert them to ES modules cleanly.
import analyzeHandler from "./api/analyze.js";
import reportHandler from "./api/report.js";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: "50mb" })); // Increase limit for base64 images

  // API Routes
  app.post("/api/analyze", async (req, res) => {
    try {
      await analyzeHandler(req, res);
    } catch (e) {
      console.error("API Analyze Error:", e);
      if (!res.headersSent) {
          res.status(500).json({ error: "Internal Server Error", details: String(e) });
      }
    }
  });

  app.post("/api/report", async (req, res) => {
    try {
      await reportHandler(req, res);
    } catch (e) {
      console.error("API Report Error:", e);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal Server Error", details: String(e) });
      }
    }
  });

  // Vite middleware for development or Static files for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve the built Vite app
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    console.log(`(This Express backend is hosted on Cloud Run via the Deploy button)`);
  });
}

startServer();
