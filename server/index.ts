import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import compression from "compression";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

// Trust reverse proxy (needed for secure cookies and rate limits behind proxies)
app.set("trust proxy", 1);

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: process.env.NODE_ENV === "production" && {
      useDefaults: true,
      directives: {
        "default-src": ["'self'", "https:"],
        "script-src": ["'self'", "'unsafe-inline'", "https:"],
        "style-src": ["'self'", "'unsafe-inline'", "https:"],
        "img-src": ["'self'", "data:", "blob:", "https:"],
        "font-src": ["'self'", "https:", "data:"],
        "connect-src": ["'self'", "https:", "wss:", "http:"],
        "frame-ancestors": ["'self'"],
        "object-src": ["'none'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],
      },
    },
    referrerPolicy: { policy: "no-referrer" },
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    frameguard: { action: "sameorigin" },
    hsts: { maxAge: 15552000, includeSubDomains: true, preload: true },
    hidePoweredBy: true,
  })
);

// CORS configuration
const isDevelopment = process.env.NODE_ENV !== "production";
const allowedOriginsProd = [
  /^https?:\/\/([a-z0-9-]+\.)?printyx\.net$/i,
  "https://printyx.net",
]; // subdomains + apex
app.use(
  cors({
    origin: (origin, callback) => {
      if (isDevelopment || !origin) return callback(null, true);
      if (
        allowedOriginsProd.some((o) =>
          o instanceof RegExp ? o.test(origin) : o === origin
        )
      ) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// Compression
app.use(compression());

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    }
  );
})();
