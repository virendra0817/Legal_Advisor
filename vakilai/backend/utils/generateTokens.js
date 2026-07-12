import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// ─── Token Configuration ─────────────────────────────────────────────────────

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ─── Sign Access Token ───────────────────────────────────────────────────────

export const signAccessToken = (user) => {
  if (!process.env.ACCESS_TOKEN_SECRET) {
    throw new Error("ACCESS_TOKEN_SECRET is not defined in environment");
  }

  return jwt.sign(
    {
      userId: user._id.toString(),
      email: user.email,
      tier: user.tier,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    }
  );
};

// ─── Sign Refresh Token ──────────────────────────────────────────────────────

export const signRefreshToken = (user) => {
  if (!process.env.REFRESH_TOKEN_SECRET) {
    throw new Error("REFRESH_TOKEN_SECRET is not defined in environment");
  }

  const jti = crypto.randomBytes(32).toString("hex");

  return jwt.sign(
    {
      userId: user._id.toString(),
      jti,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: REFRESH_TOKEN_EXPIRY,
    }
  );
};

// ─── Hash Refresh Token ──────────────────────────────────────────────────────

export const hashToken = async (token) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(token, salt);
};

// ─── Refresh Token Cookie ────────────────────────────────────────────────────

export const setRefreshTokenCookie = (res, refreshToken) => {
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    maxAge: REFRESH_TOKEN_EXPIRY_MS,
    path: "/api/auth",
  });
};

// ─── Clear Cookie ────────────────────────────────────────────────────────────

export const clearRefreshTokenCookie = (res) => {
  res.cookie("refreshToken", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    expires: new Date(0),
    path: "/api/auth",
  });
};

// ─── Issue Tokens ────────────────────────────────────────────────────────────

export const issueTokens = async (user, res) => {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  const tokenHash = await hashToken(refreshToken);

  user.refreshTokenHash = tokenHash;
  user.lastLoginAt = new Date();

  await user.save();

  setRefreshTokenCookie(res, refreshToken);

  return accessToken;
};

// ─── Verify Access Token ─────────────────────────────────────────────────────

export const verifyAccessToken = (token) => {
  if (!process.env.ACCESS_TOKEN_SECRET) {
    throw new Error("ACCESS_TOKEN_SECRET is not defined in environment");
  }

  return jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
};

// ─── Verify Refresh Token ────────────────────────────────────────────────────

export const verifyRefreshToken = (token) => {
  if (!process.env.REFRESH_TOKEN_SECRET) {
    throw new Error("REFRESH_TOKEN_SECRET is not defined in environment");
  }

  return jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
};