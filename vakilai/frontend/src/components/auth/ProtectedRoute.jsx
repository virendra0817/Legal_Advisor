import { Navigate, Outlet, useLocation } from "react-router-dom";
import useAuth from "../../hooks/useAuth.js";

const ProtectedRoute = ({ requiredTier = null }) => {
  const { isAuthenticated, loading, tier } = useAuth();
  const location = useLocation();

  // Still checking session — show nothing (or a spinner) while resolving
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <svg className="w-8 h-8 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
      </div>
    );
  }

  // Not logged in → redirect to /login, preserve intended destination
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Tier gate
  if (requiredTier) {
    const TIER_RANK = { free: 0, pro: 1, enterprise: 2 };
    const userRank     = TIER_RANK[tier] ?? 0;
    const requiredRank = TIER_RANK[requiredTier] ?? 1;
    if (userRank < requiredRank) {
      return <Navigate to="/pricing" replace />;
    }
  }

  return <Outlet />;
};

export default ProtectedRoute;
