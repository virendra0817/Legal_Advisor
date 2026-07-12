import { useCallback, useEffect } from "react";
import { useAuth as useAuthContext } from "../context/AuthContext.jsx";

// ─── useAuth ──────────────────────────────────────────────────────────────────
// The single hook all components import for auth state and actions.
// Wraps the raw AuthContext with derived booleans and tier helpers so
// component code stays declarative and never does string comparisons inline.
//
// Usage:
//   const { isAuthenticated, isPro, user, login, logout } = useAuth();

const useAuth = () => {
  const auth = useAuthContext();

  const {
    user,
    accessToken,
    isLoading,
    isAuthenticated,
    authError,
    login,
    logout,
    register,
    refreshUser,
    changePassword,
    silentRefresh,
  } = auth;

  // ─── Tier Checks ────────────────────────────────────────────────────────────
  // Derived from user.tier — components never compare strings directly

  const isFree       = user?.tier === "free";
  const isPro        = user?.tier === "pro"        || user?.tier === "enterprise";
  const isEnterprise = user?.tier === "enterprise";

  // ─── Feature Flags ──────────────────────────────────────────────────────────
  // Single source of truth for what each tier can do.
  // Update here and every component automatically reflects the change.

  const canUploadDocuments  = isAuthenticated;           // all tiers
  const canAnalyseDocuments = isPro;                     // pro + enterprise
  const canExportChat       = isPro;                     // pro + enterprise
  const canShareSession     = isPro;                     // pro + enterprise
  const hasUnlimitedChats   = isPro;                     // free tier is capped
  const canAccessAllCategories = isAuthenticated;        // all tiers

  // Free tier document upload limit
  const maxDocuments = isFree ? 3 : isEnterprise ? Infinity : 20;

  // Free tier monthly message limit
  const maxMonthlyMessages = isFree ? 50 : isEnterprise ? Infinity : 500;

  // ─── Usage Stats Helpers ───────────────────────────────────────────────────

  const monthlyTokensUsed   = user?.usageStats?.monthlyTokensUsed   || 0;
  const totalChats          = user?.usageStats?.totalChats           || 0;
  const totalDocsUploaded   = user?.usageStats?.totalDocsUploaded    || 0;
  const totalMessages       = user?.usageStats?.totalMessages        || 0;

  const isNearMessageLimit =
    isFree && totalMessages >= maxMonthlyMessages * 0.8;

  const hasReachedMessageLimit =
    isFree && totalMessages >= maxMonthlyMessages;

  const hasReachedDocumentLimit =
    isFree && totalDocsUploaded >= maxDocuments;

  // ─── User Display Helpers ──────────────────────────────────────────────────

  const displayName = user?.profile?.fullName || user?.email?.split("@")[0] || "";
  const avatarUrl   = user?.profile?.avatarUrl || null;
  const userEmail   = user?.email || "";
  const isVerified  = user?.isVerified || false;
  const userState   = user?.profile?.state || null;         // Indian state
  const language    = user?.profile?.preferredLanguage || "en";

  // ─── Tier Badge ────────────────────────────────────────────────────────────
  // Returns display label and Tailwind colour class for the tier badge

  const tierBadge = (() => {
    switch (user?.tier) {
      case "pro":
        return { label: "Pro", colorClass: "text-indigo-600 bg-indigo-50" };
      case "enterprise":
        return { label: "Enterprise", colorClass: "text-purple-600 bg-purple-50" };
      default:
        return { label: "Free", colorClass: "text-gray-600 bg-gray-100" };
    }
  })();

  // ─── requireAuth ──────────────────────────────────────────────────────────
  // Programmatic guard for action handlers — use in event callbacks
  // to gate actions that need auth without relying on route guards alone.
  //
  // Usage:
  //   const handleSend = () => {
  //     if (!requireAuth("send messages")) return;
  //     sendMessage();
  //   };

  const requireAuth = useCallback(
    (actionDescription = "perform this action") => {
      if (!isAuthenticated) {
        window.dispatchEvent(
          new CustomEvent("auth:loginRequired", {
            detail: { reason: `Please log in to ${actionDescription}.` },
          })
        );
        return false;
      }
      return true;
    },
    [isAuthenticated]
  );

  // ─── requireTier ──────────────────────────────────────────────────────────
  // Programmatic tier gate for action handlers.
  //
  // Usage:
  //   const handleAnalyse = () => {
  //     if (!requireTier("pro", "analyse documents")) return;
  //     analyseDocument();
  //   };

  const requireTier = useCallback(
    (minTier, actionDescription = "access this feature") => {
      if (!isAuthenticated) {
        window.dispatchEvent(
          new CustomEvent("auth:loginRequired", {
            detail: { reason: `Please log in to ${actionDescription}.` },
          })
        );
        return false;
      }

      const tierOrder = { free: 0, pro: 1, enterprise: 2 };
      const userTierLevel    = tierOrder[user?.tier]  ?? 0;
      const requiredTierLevel = tierOrder[minTier]     ?? 1;

      if (userTierLevel < requiredTierLevel) {
        window.dispatchEvent(
          new CustomEvent("auth:upgradeRequired", {
            detail: {
              reason:       `Please upgrade to ${minTier} to ${actionDescription}.`,
              requiredTier: minTier,
              currentTier:  user?.tier,
            },
          })
        );
        return false;
      }

      return true;
    },
    [isAuthenticated, user?.tier]
  );

  // ─── Listen for Interceptor Events ────────────────────────────────────────
  // The Axios interceptor (axiosInstance.js) dispatches custom events when
  // it silently refreshes a token or detects an expired session.
  // We sync those changes back into React state here.

  useEffect(() => {
    const handleTokenRefreshed = (e) => {
      // The interceptor already updated api.defaults.headers.
      // We just need to refresh the user object in context.
      if (e.detail?.user) {
        refreshUser();
      }
    };

    const handleSessionExpired = () => {
      // Interceptor already redirected to /login.
      // This event lets us do any additional cleanup (analytics, etc.)
      console.info("Session expired — user redirected to login.");
    };

    window.addEventListener("auth:tokenRefreshed", handleTokenRefreshed);
    window.addEventListener("auth:sessionExpired", handleSessionExpired);

    return () => {
      window.removeEventListener("auth:tokenRefreshed", handleTokenRefreshed);
      window.removeEventListener("auth:sessionExpired", handleSessionExpired);
    };
  }, [refreshUser]);

  // ─── Return ────────────────────────────────────────────────────────────────

  return {
    // ── Core state ──────────────────────────────────────────────────────────
    user,
    accessToken,
    isLoading,
    isAuthenticated,
    authError,

    // ── Actions ─────────────────────────────────────────────────────────────
    login,
    logout,
    register,
    refreshUser,
    changePassword,
    silentRefresh,
    requireAuth,
    requireTier,

    // ── Tier booleans ────────────────────────────────────────────────────────
    isFree,
    isPro,
    isEnterprise,
    tierBadge,

    // ── Feature flags ────────────────────────────────────────────────────────
    canUploadDocuments,
    canAnalyseDocuments,
    canExportChat,
    canShareSession,
    hasUnlimitedChats,
    canAccessAllCategories,

    // ── Limits ───────────────────────────────────────────────────────────────
    maxDocuments,
    maxMonthlyMessages,
    isNearMessageLimit,
    hasReachedMessageLimit,
    hasReachedDocumentLimit,

    // ── Usage stats ──────────────────────────────────────────────────────────
    monthlyTokensUsed,
    totalChats,
    totalDocsUploaded,
    totalMessages,

    // ── User display ─────────────────────────────────────────────────────────
    displayName,
    avatarUrl,
    userEmail,
    isVerified,
    userState,
    language,
  };
};

export default useAuth;
