import crypto from "crypto";
import User from "../models/User.js";
import {
  issueTokens,
  verifyRefreshToken,
  signAccessToken,
  hashToken,
  clearRefreshTokenCookie,
  setRefreshTokenCookie,
  signRefreshToken,
} from "../utils/generateTokens.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const sendSuccess = (res, statusCode, message, data = {}) => {
  return res.status(statusCode).json({ success: true, message, ...data });
};

const sendError = (res, statusCode, message, code, extra = {}) => {
  return res.status(statusCode).json({ success: false, message, code, ...extra });
};

// ─── @route   POST /api/auth/register ────────────────────────────────────────
// @desc    Create a new user account with email + password
// @access  Public

export const register = async (req, res) => {
  try {
    const { email, password, fullName } = req.body;

    // 1. Input validation
    if (!email || !password) {
      return sendError(res, 400, "Email and password are required.", "MISSING_FIELDS");
    }

    if (password.length < 8) {
      return sendError(
        res, 400,
        "Password must be at least 8 characters long.",
        "PASSWORD_TOO_SHORT"
      );
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      return sendError(
        res, 400,
        "Password must contain at least one uppercase letter, one lowercase letter, and one number.",
        "PASSWORD_TOO_WEAK"
      );
    }

    // 2. Check for existing user
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });

    if (existingUser) {
      return sendError(
        res, 409,
        "An account with this email already exists.",
        "EMAIL_IN_USE"
      );
    }

    // 3. Create user — passwordHash is set here; the pre-save hook will bcrypt it
    const user = await User.create({
      email: email.toLowerCase().trim(),
      passwordHash: password, // pre-save hook hashes this
      authProvider: "local",
      profile: {
        fullName: fullName?.trim() || "",
      },
    });

    // 4. Issue tokens and set cookie
    const accessToken = await issueTokens(user, res);

    // 5. Respond — never send passwordHash in the response
    return sendSuccess(res, 201, "Account created successfully.", {
      accessToken,
      user: {
        id:        user._id,
        email:     user.email,
        fullName:  user.profile.fullName,
        tier:      user.tier,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    // Mongoose duplicate key error (race condition fallback)
    if (error.code === 11000) {
      return sendError(res, 409, "An account with this email already exists.", "EMAIL_IN_USE");
    }

    console.error("Register error:", error);
    return sendError(res, 500, "Registration failed. Please try again.", "REGISTER_ERROR");
  }
};

// ─── @route   POST /api/auth/login ───────────────────────────────────────────
// @desc    Authenticate user and issue tokens
// @access  Public

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Input validation
    if (!email || !password) {
      return sendError(res, 400, "Email and password are required.", "MISSING_FIELDS");
    }

    // 2. Find user — explicitly select passwordHash since it's select: false
    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select("+passwordHash +refreshTokenHash");

    // Use the same error for wrong email AND wrong password — prevents
    // user enumeration attacks (attacker can't tell which one is wrong)
    if (!user) {
      return sendError(res, 401, "Invalid email or password.", "INVALID_CREDENTIALS");
    }

    // 3. Ensure account uses local auth (not OAuth)
    if (user.authProvider !== "local") {
      return sendError(
        res, 400,
        `This account uses ${user.authProvider} sign-in. Please use that method.`,
        "WRONG_AUTH_PROVIDER",
        { provider: user.authProvider }
      );
    }

    // 4. Verify password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return sendError(res, 401, "Invalid email or password.", "INVALID_CREDENTIALS");
    }

    // 5. Issue tokens and set cookie
    const accessToken = await issueTokens(user, res);

    // 6. Respond
    return sendSuccess(res, 200, "Logged in successfully.", {
      accessToken,
      user: {
        id:          user._id,
        email:       user.email,
        fullName:    user.profile.fullName,
        tier:        user.tier,
        isVerified:  user.isVerified,
        preferredLanguage: user.profile.preferredLanguage,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return sendError(res, 500, "Login failed. Please try again.", "LOGIN_ERROR");
  }
};

// ─── @route   POST /api/auth/logout ──────────────────────────────────────────
// @desc    Invalidate refresh token and clear cookie
// @access  Private (requires valid access token)

export const logout = async (req, res) => {
  try {
    // req.user is attached by the protect middleware
    const userId = req.user?.userId;

    if (userId) {
      // Invalidate the refresh token in DB so it cannot be reused
      // even if someone captured the cookie value
      await User.findByIdAndUpdate(userId, {
        refreshTokenHash: null,
        lastLoginAt: new Date(),
      });
    }

    // Clear the httpOnly cookie from the client
    clearRefreshTokenCookie(res);

    return sendSuccess(res, 200, "Logged out successfully.");
  } catch (error) {
    console.error("Logout error:", error);
    // Still clear the cookie even if DB update fails
    clearRefreshTokenCookie(res);
    return sendError(res, 500, "Logout encountered an error.", "LOGOUT_ERROR");
  }
};

// ─── @route   POST /api/auth/refresh ─────────────────────────────────────────
// @desc    Issue new access token using the refresh token cookie
// @access  Public (uses httpOnly cookie, not Authorization header)

export const refreshToken = async (req, res) => {
  try {
    // 1. Read refresh token from httpOnly cookie
    const token = req.cookies?.refreshToken;

    if (!token) {
      return sendError(res, 401, "No refresh token found.", "NO_REFRESH_TOKEN");
    }

    // 2. Verify JWT signature and expiry
    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch (err) {
      clearRefreshTokenCookie(res);

      if (err.name === "TokenExpiredError") {
        return sendError(res, 401, "Session expired. Please log in again.", "REFRESH_TOKEN_EXPIRED");
      }

      return sendError(res, 401, "Invalid session. Please log in again.", "REFRESH_TOKEN_INVALID");
    }

    // 3. Fetch user with stored hash
    const user = await User.findById(decoded.userId)
      .select("+refreshTokenHash");

    if (!user) {
      clearRefreshTokenCookie(res);
      return sendError(res, 401, "User not found. Please log in again.", "USER_NOT_FOUND");
    }

    // 4. Compare incoming token against stored hash
    // This is the key DB-level check — if the hash doesn't match,
    // the token has been invalidated (logout, password change, etc.)
    const isTokenValid = await user.compareRefreshToken(token);

    if (!isTokenValid) {
      // Potential token reuse attack — invalidate everything
      await User.findByIdAndUpdate(user._id, { refreshTokenHash: null });
      clearRefreshTokenCookie(res);
      return sendError(
        res, 401,
        "Session invalidated. Please log in again.",
        "REFRESH_TOKEN_REUSE"
      );
    }

    // 5. Issue a fresh pair of tokens (token rotation)
    // Each refresh produces a brand-new refresh token — old one is invalidated
    const newRefreshToken = signRefreshToken(user);
    const newTokenHash    = await hashToken(newRefreshToken);
    const newAccessToken  = signAccessToken(user);

    // Persist the new hash, invalidating the old token
    user.refreshTokenHash = newTokenHash;
    await user.save();

    // Replace the cookie with the new refresh token
    setRefreshTokenCookie(res, newRefreshToken);

    return sendSuccess(res, 200, "Token refreshed.", {
      accessToken: newAccessToken,
      user: {
        id:          user._id,
        email:       user.email,
        fullName:    user.profile.fullName,
        tier:        user.tier,
        isVerified:  user.isVerified,
      },
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    clearRefreshTokenCookie(res);
    return sendError(res, 500, "Token refresh failed.", "REFRESH_ERROR");
  }
};

// ─── @route   GET /api/auth/me ────────────────────────────────────────────────
// @desc    Return the currently authenticated user's profile
// @access  Private

export const getMe = async (req, res) => {
  try {
    // Fetch fresh data from DB — don't rely on the JWT payload alone
    // since tier or verification status may have changed
    const user = await User.findById(req.user.userId).select(
      "_id email tier isVerified profile preferences usageStats createdAt lastLoginAt"
    );

    if (!user) {
      return sendError(res, 404, "User not found.", "USER_NOT_FOUND");
    }

    return sendSuccess(res, 200, "User profile fetched.", { user });
  } catch (error) {
    console.error("GetMe error:", error);
    return sendError(res, 500, "Failed to fetch user profile.", "GETME_ERROR");
  }
};

// ─── @route   PATCH /api/auth/change-password ────────────────────────────────
// @desc    Change password for authenticated local-auth users
// @access  Private

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return sendError(res, 400, "Current and new password are required.", "MISSING_FIELDS");
    }

    if (newPassword.length < 8) {
      return sendError(res, 400, "New password must be at least 8 characters.", "PASSWORD_TOO_SHORT");
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      return sendError(
        res, 400,
        "New password must contain uppercase, lowercase, and a number.",
        "PASSWORD_TOO_WEAK"
      );
    }

    // Fetch user with password hash
    const user = await User.findById(req.user.userId)
      .select("+passwordHash +refreshTokenHash");

    if (!user || user.authProvider !== "local") {
      return sendError(res, 400, "Password change not available for this account.", "INVALID_OPERATION");
    }

    // Verify current password
    const isValid = await user.comparePassword(currentPassword);
    if (!isValid) {
      return sendError(res, 401, "Current password is incorrect.", "WRONG_PASSWORD");
    }

    // Prevent reuse of the same password
    const isSame = await user.comparePassword(newPassword);
    if (isSame) {
      return sendError(res, 400, "New password must be different from current password.", "SAME_PASSWORD");
    }

    // Update password and invalidate all sessions (force re-login everywhere)
    user.passwordHash    = newPassword; // pre-save hook will hash this
    user.refreshTokenHash = null;        // invalidate all existing sessions

    await user.save();

    clearRefreshTokenCookie(res);

    return sendSuccess(res, 200, "Password changed successfully. Please log in again.");
  } catch (error) {
    console.error("Change password error:", error);
    return sendError(res, 500, "Password change failed.", "CHANGE_PASSWORD_ERROR");
  }
};
