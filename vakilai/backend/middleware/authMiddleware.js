import { verifyAccessToken } from "../utils/generateTokens.js";
import User from "../models/User.js";

// ─── protect ─────────────────────────────────────────────────────────────────
// Core auth gate. Attach to any route that requires a logged-in user.
// Verifies the JWT, does a lightweight DB check to confirm the user still
// exists (handles deleted/banned accounts), then attaches req.user.
//
// Usage:  router.get("/profile", protect, getProfile)

export const protect = async (req, res, next) => {
  try {
    // 1. Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
        code:    "NO_TOKEN",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. Malformed authorization header.",
        code:    "MALFORMED_TOKEN",
      });
    }

    // 2. Verify signature and expiry
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      // Distinguish between expired and tampered tokens so the client
      // knows whether to attempt a silent refresh or force re-login
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Session expired. Please refresh your token.",
          code:    "TOKEN_EXPIRED",
        });
      }

      return res.status(401).json({
        success: false,
        message: "Invalid token. Please log in again.",
        code:    "TOKEN_INVALID",
      });
    }

    // 3. Confirm user still exists in DB
    // We keep this lean — only fetch the fields we actually need.
    const user = await User.findById(decoded.userId).select(
      "_id email tier isVerified profile.fullName profile.preferredLanguage"
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User no longer exists.",
        code:    "USER_NOT_FOUND",
      });
    }

    // 4. Attach to request — downstream handlers read from req.user
    req.user = {
      userId:            user._id.toString(),
      email:             user.email,
      tier:              user.tier,
      isVerified:        user.isVerified,
      fullName:          user.profile?.fullName || "",
      preferredLanguage: user.profile?.preferredLanguage || "en",
    };

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error during authentication.",
      code:    "AUTH_ERROR",
    });
  }
};

// ─── requireVerified ─────────────────────────────────────────────────────────
// Secondary gate — use after protect on routes that need a verified email.
// Example: protect, requireVerified, uploadDocument
//
// Usage:  router.post("/upload", protect, requireVerified, uploadDoc)

export const requireVerified = (req, res, next) => {
  if (!req.user?.isVerified) {
    return res.status(403).json({
      success: false,
      message: "Please verify your email address to access this feature.",
      code:    "EMAIL_NOT_VERIFIED",
    });
  }
  next();
};

// ─── requireTier ─────────────────────────────────────────────────────────────
// Tier-based access control. Accepts one or more allowed tiers.
// Always use AFTER protect so req.user is guaranteed to exist.
//
// Usage:  router.post("/analyse", protect, requireTier("pro", "enterprise"), analyse)

export const requireTier = (...allowedTiers) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
        code:    "NOT_AUTHENTICATED",
      });
    }

    if (!allowedTiers.includes(req.user.tier)) {
      return res.status(403).json({
        success: false,
        message: `This feature requires a ${allowedTiers.join(" or ")} plan.`,
        code:    "INSUFFICIENT_TIER",
        requiredTiers: allowedTiers,
        currentTier:   req.user.tier,
      });
    }

    next();
  };
};

// ─── optionalAuth ─────────────────────────────────────────────────────────────
// Soft auth gate — attaches req.user if a valid token is present,
// but does NOT block the request if there is no token.
// Useful for public routes that behave differently for logged-in users.
//
// Usage:  router.get("/categories", optionalAuth, getCategories)

export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      req.user = null;
      return next();
    }

    try {
      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.userId).select(
        "_id email tier isVerified profile.fullName"
      );

      req.user = user
        ? {
            userId:     user._id.toString(),
            email:      user.email,
            tier:       user.tier,
            isVerified: user.isVerified,
            fullName:   user.profile?.fullName || "",
          }
        : null;
    } catch {
      // Invalid or expired token — treat as unauthenticated, don't block
      req.user = null;
    }

    next();
  } catch (error) {
    console.error("Optional auth middleware error:", error);
    req.user = null;
    next();
  }
};
