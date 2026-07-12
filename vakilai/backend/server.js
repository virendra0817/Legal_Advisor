import express         from "express";
import cors            from "cors";
import cookieParser    from "cookie-parser";
import helmet          from "helmet";
import morgan          from "morgan";
import rateLimit       from "express-rate-limit";
import dotenv          from "dotenv";

import connectDB       from "./config/db.js";
import authRoutes      from "./routes/authRoutes.js";
import documentRoutes  from "./routes/documentRoutes.js";
import analysisRoutes  from "./routes/analysisRoutes.js";
import chatRoutes      from "./routes/chatRoutes.js";
import consultationRoutes from "./routes/consultationRoutes.js";
import { ensureStorageReady } from "./utils/fileStorage.js";
import { startDocumentProcessingWorker } from "./workers/documentProcessingWorker.js";

// ─── Environment ──────────────────────────────────────────────────────────────

const result = dotenv.config();

console.log("dotenv result:", result);
console.log("cwd:", process.cwd());
console.log("MISTRAL_API_KEY:", process.env.MISTRAL_API_KEY);


const PORT     = process.env.PORT     || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";

const REQUIRED_ENV = [
  "MONGO_URI",
  "ACCESS_TOKEN_SECRET",
  "REFRESH_TOKEN_SECRET",
  "MISTRAL_API_KEY",
  "GROQ_API_KEY",
  "PINECONE_API_KEY",
];

// Fail fast — crash on startup if critical env vars are missing
// so the problem is obvious rather than silently broken at runtime
REQUIRED_ENV.forEach((key) => {
  if (!process.env[key]) {
    console.error(`FATAL: Missing required environment variable: ${key}`);
    process.exit(1);
  }
});

// ─── App ──────────────────────────────────────────────────────────────────────

const app = express();

// ─── Trust Proxy ─────────────────────────────────────────────────────────────
// Required when running behind a reverse proxy (Nginx, Railway, Render).
// Without this, req.ip returns the proxy's IP — breaking rate limiting.

app.set("trust proxy", 1);

// ─── Security Headers ─────────────────────────────────────────────────────────
// Helmet sets a suite of security-focused HTTP headers in one call.
// Notably: X-Content-Type-Options, X-Frame-Options, HSTS in production.

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }, // allow CDN assets
    contentSecurityPolicy: NODE_ENV === "production",      // CSP in prod only
  })
);

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Whitelist only the frontend origin. The credentials: true flag is required
// for the browser to send httpOnly cookies on cross-origin requests.

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman)
      if (!origin) return callback(null, true);

      if (ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS: Origin ${origin} not allowed`), false);
    },
    credentials:      true,  // Required for cookies to cross origins
    methods:          ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders:   ["Content-Type", "Authorization"],
    exposedHeaders:   ["RateLimit-Limit", "RateLimit-Remaining"],
    maxAge:           86400, // Cache preflight for 24 hours
  })
);

// ─── Body Parsers ─────────────────────────────────────────────────────────────

app.use(express.json({ limit: "10kb" }));        // Reject oversized JSON payloads
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());                          // Parses req.cookies

// ─── Request Logging ──────────────────────────────────────────────────────────

if (NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  // Structured logs in production — easier to parse with log aggregators
  app.use(
    morgan("combined", {
      skip: (req) => req.url === "/api/health", // Don't log health checks
    })
  );
}

// ─── Global Rate Limiter ──────────────────────────────────────────────────────
// Broad safety net across all API routes — specific routes have tighter limits
// applied in their own routers (e.g. auth routes)

const globalLimiter = rateLimit({
  windowMs:        15 * 60 * 1000, // 15 minutes
  max:             200,             // 200 requests per IP per window
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    message: "Too many requests from this IP. Please try again later.",
    code:    "GLOBAL_RATE_LIMITED",
  },
});

app.use("/api", globalLimiter);

// ─── Health Check ─────────────────────────────────────────────────────────────
// Lightweight endpoint for load balancers and uptime monitors.
// Intentionally placed before route mounting so it never hits the DB.

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    status:  "ok",
    env:     NODE_ENV,
    time:    new Date().toISOString(),
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────

app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/documents/:id", analysisRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/consultations", consultationRoutes);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
// Catches any request that didn't match a registered route

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found.`,
    code:    "ROUTE_NOT_FOUND",
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
// Express's special 4-argument error middleware. Must be last.
// Catches anything passed to next(error) anywhere in the app.

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // CORS errors from the origin check above
  if (err.message?.startsWith("CORS:")) {
    return res.status(403).json({
      success: false,
      message: err.message,
      code:    "CORS_ERROR",
    });
  }

  // Mongoose validation errors
  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      message: "Validation failed.",
      code:    "VALIDATION_ERROR",
      errors,
    });
  }

  // Mongoose cast error (e.g. invalid ObjectId in URL param)
  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: `Invalid ${err.path}: ${err.value}`,
      code:    "CAST_ERROR",
    });
  }

  // MongoDB duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    return res.status(409).json({
      success: false,
      message: `A record with this ${field} already exists.`,
      code:    "DUPLICATE_KEY",
    });
  }

  // JSON parse errors (malformed request body)
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON in request body.",
      code:    "INVALID_JSON",
    });
  }

  // Payload too large
  if (err.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      message: "Request body is too large.",
      code:    "PAYLOAD_TOO_LARGE",
    });
  }

  // Log unexpected errors but never leak stack traces to clients
  console.error("Unhandled error:", {
    message: err.message,
    stack:   NODE_ENV === "development" ? err.stack : undefined,
    url:     req.originalUrl,
    method:  req.method,
  });

  return res.status(err.statusCode || 500).json({
    success: false,
    message: NODE_ENV === "development"
      ? err.message
      : "An unexpected error occurred. Please try again.",
    code: "INTERNAL_ERROR",
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────

const startServer = async () => {
  try {
    await connectDB();
    await ensureStorageReady();

    const stopWorker = startDocumentProcessingWorker();
    app.locals.stopWorker = stopWorker; // referenced by graceful shutdown below

    app.listen(PORT, () => {
      console.log(`
  ╔══════════════════════════════════════╗
  ║       VakilAI API Server             ║
  ║──────────────────────────────────────║
  ║  Environment : ${NODE_ENV.padEnd(22)}║
  ║  Port        : ${String(PORT).padEnd(22)}║
  ║  Auth routes : /api/auth             ║
  ╚══════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
// Ensures in-flight requests finish before the process exits.
// Critical for zero-downtime deploys on Railway / Render.

const shutdown = (signal) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  app.locals.stopWorker?.();
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

// Catch unhandled promise rejections — log and exit cleanly
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Promise Rejection:", reason);
  process.exit(1);
});

startServer();

export default app;
