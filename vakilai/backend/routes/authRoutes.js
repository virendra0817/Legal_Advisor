import express from "express";
import rateLimit from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";
import {
  register,
  login,
  logout,
  refreshToken,
  getMe,
  changePassword,
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// ─── Input Sanitisation ───────────────────────────────────────────────────────
// Strip MongoDB operators ($where, $gt etc.) from req.body on all auth routes.
// Prevents NoSQL injection attacks on login/register endpoints.

router.use(mongoSanitize());

// ─── Rate Limiters ────────────────────────────────────────────────────────────
// Separate limiters per endpoint so a brute-force on /login doesn't
// consume the quota for /refresh, and vice versa.

const authLimiter = rateLimit({
  windowMs:         15 * 60 * 1000, // 15 minutes
  max:              10,              // 10 attempts per window per IP
  standardHeaders:  true,           // Return rate limit info in RateLimit-* headers
  legacyHeaders:    false,
  message: {
    success: false,
    message: "Too many attempts from this IP. Please try again in 15 minutes.",
    code:    "RATE_LIMITED",
  },
  skipSuccessfulRequests: false,    // Count all requests, not just failures
});

const loginLimiter = rateLimit({
  windowMs:         15 * 60 * 1000, // 15 minutes
  max:              5,               // Only 5 login attempts — tighter for brute force
  standardHeaders:  true,
  legacyHeaders:    false,
  message: {
    success: false,
    message: "Too many login attempts. Please try again in 15 minutes.",
    code:    "LOGIN_RATE_LIMITED",
  },
  skipSuccessfulRequests: true,     // Don't penalise successful logins
});

const refreshLimiter = rateLimit({
  windowMs:        5 * 60 * 1000,  // 5 minutes
  max:             20,              // Silent refresh calls can be frequent
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    message: "Too many refresh requests. Please try again shortly.",
    code:    "REFRESH_RATE_LIMITED",
  },
});

// ─── Validation Helpers ───────────────────────────────────────────────────────
// Lightweight inline validators so we don't need a full validation library
// just for auth. Each returns early with 400 if validation fails.

const validateRegisterInput = (req, res, next) => {
  const { email, password, fullName } = req.body;

  // Trim inputs in-place so controllers receive clean data
  if (email)    req.body.email    = email.trim().toLowerCase();
  if (fullName) req.body.fullName = fullName.trim();

  const errors = [];

  if (!email || typeof email !== "string") {
    errors.push("Email is required.");
  } else if (!/^\S+@\S+\.\S+$/.test(req.body.email)) {
    errors.push("Please enter a valid email address.");
  }

  if (!password || typeof password !== "string") {
    errors.push("Password is required.");
  } else if (password.length < 8) {
    errors.push("Password must be at least 8 characters.");
  }

  if (fullName && fullName.length > 100) {
    errors.push("Full name must be under 100 characters.");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Validation failed.",
      code:    "VALIDATION_ERROR",
      errors,
    });
  }

  next();
};

const validateLoginInput = (req, res, next) => {
  const { email, password } = req.body;

  if (email) req.body.email = email.trim().toLowerCase();

  const errors = [];

  if (!email || typeof email !== "string") {
    errors.push("Email is required.");
  }

  if (!password || typeof password !== "string") {
    errors.push("Password is required.");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Validation failed.",
      code:    "VALIDATION_ERROR",
      errors,
    });
  }

  next();
};

const validateChangePasswordInput = (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  const errors = [];

  if (!currentPassword || typeof currentPassword !== "string") {
    errors.push("Current password is required.");
  }

  if (!newPassword || typeof newPassword !== "string") {
    errors.push("New password is required.");
  } else if (newPassword.length < 8) {
    errors.push("New password must be at least 8 characters.");
  } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
    errors.push("New password must contain uppercase, lowercase, and a number.");
  }

  if (currentPassword && newPassword && currentPassword === newPassword) {
    errors.push("New password must be different from current password.");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Validation failed.",
      code:    "VALIDATION_ERROR",
      errors,
    });
  }

  next();
};

// ─── Routes ───────────────────────────────────────────────────────────────────
//
//  POST   /api/auth/register          Create new account
//  POST   /api/auth/login             Authenticate + issue tokens
//  POST   /api/auth/logout            Invalidate session  [protected]
//  POST   /api/auth/refresh           Rotate tokens via cookie
//  GET    /api/auth/me                Get current user    [protected]
//  PATCH  /api/auth/change-password   Update password     [protected]

router.post(
  "/register",
  authLimiter,
  validateRegisterInput,
  register
);

router.post(
  "/login",
  loginLimiter,
  validateLoginInput,
  login
);

router.post(
  "/logout",
  protect,          // Must be authenticated to log out
  logout
);

router.post(
  "/refresh",
  refreshLimiter,
  refreshToken      // Reads from httpOnly cookie — no auth header needed
);

router.get(
  "/me",
  protect,
  getMe
);

router.patch(
  "/change-password",
  protect,
  validateChangePasswordInput,
  changePassword
);

export default router;
