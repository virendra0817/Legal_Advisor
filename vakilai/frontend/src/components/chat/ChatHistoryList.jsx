import { useNavigate, useParams } from "react-router-dom";
import ChatHistorySearch from "./ChatHistorySearch.jsx";
import ChatHistoryItem from "./ChatHistoryItem.jsx";
import useChatHistory from "../../hooks/useChatHistory.js";

const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
  </svg>
);

const SkeletonRow = () => (
  <div className="flex flex-col gap-1.5 px-3 py-2.5 mx-1 my-0.5">
    <div className="h-3.5 bg-gray-200 rounded animate-pulse w-3/4" />
    <div className="h-3 bg-gray-100 rounded animate-pulse w-full" />
    <div className="h-2.5 bg-gray-100 rounded animate-pulse w-1/3" />
  </div>
);

const EmptyState = ({ isSearching, query }) => (
  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mb-3">
      <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24"
           stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526
             1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602
             -1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25
             5.14 2.25 6.741v6.018z"/>
      </svg>
    </div>
    <p className="text-sm font-medium text-gray-600 mb-1">
      {isSearching && query ? `No results for "${query}"` : "No conversations yet"}
    </p>
    <p className="text-xs text-gray-400">
      {isSearching && query
        ? "Try a different search term"
        : "Start a new conversation to get legal guidance"}
    </p>
  </div>
);

const ChatHistoryList = ({ className = "" }) => {
  const navigate = useNavigate();
  const { chatId: activeChatId } = useParams();
  const {
    chats, isLoading, isSearching, searchQuery, error,
    pagination, activeStatus,
    setSearchQuery, setActiveStatus,
    createChat, renameChat, deleteChat, archiveChat, loadPage,
  } = useChatHistory();

  const handleNewChat = async () => {
    const chat = await createChat();
    if (chat) navigate(`/chat/${chat._id}`);
  };

  return (
    <aside className={`flex flex-col h-full bg-white border-r border-gray-200 ${className}`}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 flex-shrink-0">
        <h2 className="text-sm font-semibold text-gray-800">Conversations</h2>
        <button onClick={handleNewChat} aria-label="New conversation"
          className="p-1.5 rounded-lg text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
          <PlusIcon />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2 flex-shrink-0">
        <ChatHistorySearch value={searchQuery} onChange={setSearchQuery} isSearching={isSearching} />
      </div>

      {/* Status tabs */}
      {!searchQuery && (
        <div className="flex border-b border-gray-200 flex-shrink-0">
          {["active", "archived"].map((tab) => (
            <button key={tab} onClick={() => setActiveStatus(tab)}
              className={`flex-1 py-2 text-xs font-medium capitalize transition-colors
                ${activeStatus === tab
                  ? "text-indigo-600 border-b-2 border-indigo-600"
                  : "text-gray-400 hover:text-gray-600"}`}>
              {tab}
            </button>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="mx-3 mt-2 px-3 py-2 text-xs text-red-600 bg-red-50 rounded-lg flex-shrink-0">
          {error}
        </p>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto py-1">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
          : chats.length === 0
          ? <EmptyState isSearching={!!searchQuery} query={searchQuery} />
          : chats.map((chat) => (
              <ChatHistoryItem
                key={chat._id}
                chat={chat}
                isActive={chat._id === activeChatId}
                onClick={(id) => navigate(`/chat/${id}`)}
                onRename={renameChat}
                onDelete={deleteChat}
                onArchive={(id) => archiveChat(id, true)}
              />
            ))
        }
      </div>

      {/* Pagination */}
      {!searchQuery && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 flex-shrink-0">
          <button onClick={() => loadPage(pagination.page - 1)} disabled={pagination.page <= 1}
            className="text-xs text-gray-500 disabled:opacity-30 hover:text-gray-700">
            ← Older
          </button>
          <span className="text-xs text-gray-400">
            {pagination.page} / {pagination.totalPages}
          </span>
          <button onClick={() => loadPage(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages}
            className="text-xs text-gray-500 disabled:opacity-30 hover:text-gray-700">
            Newer →
          </button>
        </div>
      )}
    </aside>
  );
};

export default ChatHistoryList;
