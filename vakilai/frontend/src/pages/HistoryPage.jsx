import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useChatHistory from "../hooks/useChatHistory.js";
import ChatHistorySearch from "../components/chat/ChatHistorySearch.jsx";

const dateGroup = (dateStr) => {
  if (!dateStr) return "Older";
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff  < 7) return "This week";
  if (diff  < 30) return "This month";
  return new Date(dateStr).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
};

const groupChatsByDate = (chats) => {
  const groups = {};
  chats.forEach((c) => {
    const key = dateGroup(c.lastMessageAt);
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  });
  return groups;
};

const CardSkeleton = () => (
  <div className="bg-white rounded-2xl border border-gray-200 p-4 animate-pulse">
    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
    <div className="h-3 bg-gray-100 rounded w-full mb-1" />
    <div className="h-3 bg-gray-100 rounded w-2/3 mb-4" />
    <div className="h-3 bg-gray-100 rounded w-1/3" />
  </div>
);

const ChatCard = ({ chat, onOpen, onRename, onDelete, onArchive }) => {
  const [editing, setEditing] = useState(false);
  const [title,   setTitle]   = useState(chat.title);

  const handleRenameSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const t = title.trim();
    if (t && t !== chat.title) await onRename(chat._id, t);
    setEditing(false);
  };

  return (
    <div
      onClick={() => !editing && onOpen(chat._id)}
      className="group bg-white border border-gray-200 rounded-2xl p-4 hover:shadow-sm
                 hover:border-gray-300 transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        {editing ? (
          <form onSubmit={handleRenameSubmit} onClick={(e) => e.stopPropagation()} className="flex-1">
            <input
              autoFocus value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
              maxLength={150}
              className="w-full text-sm font-semibold px-2 py-1 rounded-lg border border-indigo-400
                         focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </form>
        ) : (
          <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 flex-1">{chat.title}</h3>
        )}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity"
             onClick={(e) => e.stopPropagation()}>
          <button onClick={() => { setTitle(chat.title); setEditing(true); }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Rename">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/>
            </svg>
          </button>
          <button onClick={() => onArchive(chat._id)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Archive">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"/>
            </svg>
          </button>
          <button onClick={() => onDelete(chat._id)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            aria-label="Delete">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/>
            </svg>
          </button>
        </div>
      </div>

      {chat.lastMessagePreview && (
        <p className="text-xs text-gray-400 line-clamp-2 mb-3 leading-relaxed">
          {chat.lastMessagePreview}
        </p>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {chat.lastMessageAt
            ? new Date(chat.lastMessageAt).toLocaleDateString("en-IN", {
                day: "numeric", month: "short", year: "numeric",
              })
            : "—"}
          {chat.messageCount > 0 && (
            <span className="ml-2 text-gray-300">{chat.messageCount} msgs</span>
          )}
        </span>
      </div>
    </div>
  );
};

const HistoryPage = () => {
  const navigate = useNavigate();
  const {
    chats, isLoading, isSearching, searchQuery, error,
    pagination, activeStatus,
    setSearchQuery, setActiveStatus,
    renameChat, deleteChat, archiveChat, loadPage,
  } = useChatHistory();

  const grouped    = groupChatsByDate(chats);
  const groupOrder = Object.keys(grouped);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Chat History</h1>
          <p className="text-sm text-gray-500">
            {pagination.total > 0
              ? `${pagination.total} conversation${pagination.total !== 1 ? "s" : ""}`
              : "Your conversations will appear here"}
          </p>
        </div>

        <div className="max-w-sm mb-6">
          <ChatHistorySearch value={searchQuery} onChange={setSearchQuery} isSearching={isSearching} />
        </div>

        {!searchQuery && (
          <div className="flex gap-1 mb-6 border-b border-gray-200">
            {["active", "archived"].map((tab) => (
              <button key={tab} onClick={() => setActiveStatus(tab)}
                className={`px-4 py-2 text-sm font-medium capitalize transition-colors
                  ${activeStatus === tab
                    ? "text-indigo-600 border-b-2 border-indigo-600 -mb-px"
                    : "text-gray-400 hover:text-gray-600"}`}>
                {tab}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : chats.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 text-sm mb-2">
              {searchQuery ? `No results for "${searchQuery}"` : "No conversations yet"}
            </p>
            {!searchQuery && (
              <button onClick={() => navigate("/chat")}
                className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm font-medium
                           rounded-xl hover:bg-indigo-700 transition-colors">
                Start a conversation
              </button>
            )}
          </div>
        ) : (
          groupOrder.map((group) => (
            <div key={group} className="mb-8">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                {group}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {grouped[group].map((chat) => (
                  <ChatCard
                    key={chat._id}
                    chat={chat}
                    onOpen={(id) => navigate(`/chat/${id}`)}
                    onRename={renameChat}
                    onDelete={deleteChat}
                    onArchive={(id) => archiveChat(id, true)}
                  />
                ))}
              </div>
            </div>
          ))
        )}

        {!searchQuery && pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button onClick={() => loadPage(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-300
                         rounded-xl hover:bg-gray-50 disabled:opacity-40 transition-colors">
              ← Previous
            </button>
            <span className="text-sm text-gray-500">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button onClick={() => loadPage(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-300
                         rounded-xl hover:bg-gray-50 disabled:opacity-40 transition-colors">
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryPage;
