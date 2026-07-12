import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth.js";
import useChatHistory from "../hooks/useChatHistory.js";
import Card from "../components/ui/Card.jsx";
import Badge from "../components/ui/Badge.jsx";
import Skeleton from "../components/ui/Skeleton.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";

const CATEGORIES = [
  { slug: "tenant-landlord-dispute", label: "Tenant & Landlord", icon: "🏠", color: "bg-blue-50" },
  { slug: "consumer-complaint",      label: "Consumer Rights",   icon: "🛒", color: "bg-emerald-50" },
  { slug: "employment-dispute",      label: "Employment",        icon: "💼", color: "bg-amber-50" },
  { slug: "fir-criminal-complaint",  label: "FIR & Criminal",    icon: "⚖️", color: "bg-red-50" },
  { slug: "family-law",              label: "Family Law",        icon: "👨‍👩‍👧", color: "bg-purple-50" },
  { slug: "general-legal-query",     label: "Something Else",    icon: "💬", color: "bg-gray-50" },
];

const DashboardPage = () => {
  const navigate = useNavigate();
  const { user, displayName, tier, monthlyTokensUsed, maxMonthlyMessages, totalMessages, isFree } = useAuth();
  const { chats, isLoading } = useChatHistory();
  const recentChats = chats.slice(0, 5);

  const usagePercent = isFree ? Math.min(100, Math.round((totalMessages / maxMonthlyMessages) * 100)) : 0;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const handleCategoryClick = (slug) => navigate(`/chat?category=${slug}`);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

      {/* Welcome banner */}
      <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl p-6 sm:p-8 text-white mb-6">
        <p className="text-indigo-200 text-sm mb-1">{greeting},</p>
        <h1 className="text-2xl font-bold mb-4">{displayName || "there"} 👋</h1>
        <p className="text-indigo-100 text-sm mb-5 max-w-md">
          Start a new legal consultation, upload a document for analysis, or pick up where you left off.
        </p>
        <button onClick={() => navigate("/chat")}
          className="bg-white text-indigo-700 text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-indigo-50 transition-colors">
          Start new consultation
        </button>
      </div>

      {/* Usage bar - free tier only */}
      {isFree && (
        <Card className="mb-6" padding="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-600">Monthly messages used</p>
            <p className="text-xs text-gray-400">{totalMessages} / {maxMonthlyMessages}</p>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${usagePercent > 80 ? "bg-amber-500" : "bg-indigo-500"}`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          {usagePercent > 80 && (
            <p className="text-xs text-amber-600 mt-2">
              You're close to your free plan limit. <a href="/pricing" className="underline font-medium">Upgrade to Pro</a> for unlimited messages.
            </p>
          )}
        </Card>
      )}

      {/* Category grid */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">What's your legal situation?</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {CATEGORIES.map(c => (
            <button key={c.slug} onClick={() => handleCategoryClick(c.slug)}
              className="bg-white border border-gray-200 rounded-2xl p-4 text-left hover:border-indigo-300 hover:shadow-sm transition-all">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg mb-3 ${c.color}`}>{c.icon}</div>
              <p className="text-sm font-medium text-gray-800">{c.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Recent chats */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-800">Recent conversations</h2>
          <button onClick={() => navigate("/history")} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
            View all →
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} padding="p-4">
                <Skeleton variant="text" width="60%" className="mb-2"/>
                <Skeleton variant="text" width="90%"/>
              </Card>
            ))}
          </div>
        ) : recentChats.length === 0 ? (
          <Card padding="p-0">
            <EmptyState
              title="No conversations yet"
              description="Pick a category above to start your first consultation."
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                </svg>
              }
            />
          </Card>
        ) : (
          <div className="space-y-2">
            {recentChats.map(chat => (
              <button key={chat._id} onClick={() => navigate(`/chat/${chat._id}`)}
                className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-sm transition-all flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{chat.title}</p>
                  {chat.lastMessagePreview && (
                    <p className="text-xs text-gray-400 truncate mt-0.5">{chat.lastMessagePreview}</p>
                  )}
                </div>
                <Badge color="gray">{chat.messageCount} msgs</Badge>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
export default DashboardPage;
