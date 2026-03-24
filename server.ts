import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // bKash API Mock Endpoint
  // In a real scenario, you'd call bKash's official API here
  app.post("/api/bkash/pay", async (req, res) => {
    const { amount, currency, receiver } = req.body;

    // Check for bKash credentials
    const BKASH_APP_KEY = process.env.BKASH_APP_KEY;
    const BKASH_APP_SECRET = process.env.BKASH_APP_SECRET;

    if (!BKASH_APP_KEY || !BKASH_APP_SECRET) {
      return res.status(400).json({ 
        success: false, 
        message: "bKash API credentials (BKASH_APP_KEY, BKASH_APP_SECRET) are not configured in environment variables." 
      });
    }

    console.log(`Processing bKash payment: ${amount} ${currency} to ${receiver}`);

    // Simulate bKash API call
    // In production, you would use axios or fetch to call bKash's sandbox/live endpoints
    // e.g., https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout/create
    
    setTimeout(() => {
      res.json({
        success: true,
        transactionId: `BK${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        message: `Successfully paid ${amount} ${currency} via bKash to ${receiver}`,
        timestamp: new Date().toISOString()
      });
    }, 1500);
  });

  // API Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
