import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"],
    },

    phone: {
      type: String,
      default: null,
      match: [/^\+?[1-9]\d{9,14}$/, "Please enter a valid phone number"],
    },

    passwordHash: {
      type: String,
      default: null,
      select: false, // never returned in queries unless explicitly requested
    },

    authProvider: {
      type: String,
      enum: ["local", "google", "github"],
      default: "local",
    },

    googleId: {
      type: String,
      default: null,
      select: false,
    },

    tier: {
      type: String,
      enum: ["free", "pro", "enterprise"],
      default: "free",
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    profile: {
      fullName: {
        type: String,
        trim: true,
        default: "",
      },
      avatarUrl: {
        type: String,
        default: null,
      },
      state: {
        type: String,
        default: null, // Indian state for jurisdiction context
      },
      preferredLanguage: {
        type: String,
        enum: ["en", "hi", "mr", "ta", "te", "bn", "gu", "kn"],
        default: "en",
      },
    },

    preferences: {
      defaultCategoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "LegalCategory",
        default: null,
      },
      receiveEmails: {
        type: Boolean,
        default: true,
      },
      disclaimerAcknowledged: {
        type: Boolean,
        default: false,
      },
    },

    usageStats: {
      totalChats: { type: Number, default: 0 },
      totalMessages: { type: Number, default: 0 },
      totalDocsUploaded: { type: Number, default: 0 },
      monthlyTokensUsed: { type: Number, default: 0 },
    },

    // Stores the hashed refresh token so we can invalidate it on logout
    refreshTokenHash: {
      type: String,
      default: null,
      select: false,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },

    passwordResetToken: {
      type: String,
      default: null,
      select: false,
    },

    passwordResetExpires: {
      type: Date,
      default: null,
      select: false,
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt automatically
  }
);

// ─── Indexes ────────────────────────────────────────────────────────────────

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ phone: 1 }, { sparse: true });
userSchema.index({ tier: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ googleId: 1 }, { sparse: true });

// ─── Pre-save hook: hash password before saving ──────────────────────────────

userSchema.pre("save", async function (next) {
  // Only hash if the passwordHash field was explicitly modified
  if (!this.isModified("passwordHash") || !this.passwordHash) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(12);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// ─── Instance method: compare a plain password against the stored hash ───────

userSchema.methods.comparePassword = async function (plainPassword) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(plainPassword, this.passwordHash);
};

// ─── Instance method: compare a plain refresh token against stored hash ──────

userSchema.methods.compareRefreshToken = async function (plainToken) {
  if (!this.refreshTokenHash) return false;
  return bcrypt.compare(plainToken, this.refreshTokenHash);
};

// ─── Instance method: check if password reset token is still valid ───────────

userSchema.methods.isResetTokenValid = function () {
  return (
    this.passwordResetToken &&
    this.passwordResetExpires &&
    this.passwordResetExpires > Date.now()
  );
};

// ─── Virtual: full display name fallback to email prefix ────────────────────

userSchema.virtual("displayName").get(function () {
  return this.profile?.fullName || this.email.split("@")[0];
});

// ─── Transform: strip sensitive fields from JSON output ─────────────────────

userSchema.set("toJSON", {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.passwordHash;
    delete ret.refreshTokenHash;
    delete ret.passwordResetToken;
    delete ret.passwordResetExpires;
    delete ret.googleId;
    delete ret.__v;
    return ret;
  },
});

const User = mongoose.model("User", userSchema);

export default User;
