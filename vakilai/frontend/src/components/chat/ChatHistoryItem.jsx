import { useState, useRef, useEffect } from "react";

const PencilIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/>
  </svg>
);
const TrashIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/>
  </svg>
);
const ArchiveIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"/>
  </svg>
);
const CheckIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
  </svg>
);
const XIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
  </svg>
);

const relativeTime = (dateStr) => {
  if (!dateStr) return "";
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return "just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  < 7)  return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

const ChatHistoryItem = ({ chat, isActive = false, onClick, onRename, onDelete, onArchive }) => {
  const [isRenaming,     setIsRenaming]     = useState(false);
  const [renameValue,    setRenameValue]    = useState(chat.title);
  const [showDeleteConf, setShowDeleteConf] = useState(false);
  const [showMenu,       setShowMenu]       = useState(false);
  const renameInputRef = useRef(null);
  const menuRef        = useRef(null);

  useEffect(() => { if (isRenaming) renameInputRef.current?.select(); }, [isRenaming]);

  useEffect(() => {
    if (!showMenu) return;
    const h = (e) => { if (!menuRef.current?.contains(e.target)) setShowMenu(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showMenu]);

  const startRename = (e) => { e.stopPropagation(); setRenameValue(chat.title); setIsRenaming(true); setShowMenu(false); };
  const commitRename = async () => {
    const t = renameValue.trim();
    if (t && t !== chat.title) await onRename(chat._id, t);
    setIsRenaming(false);
  };
  const cancelRename = () => { setRenameValue(chat.title); setIsRenaming(false); };
  const handleKey = (e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") cancelRename(); };

  if (showDeleteConf) {
    return (
      <div className="px-3 py-2.5 rounded-xl bg-red-50 border border-red-200 mx-1 my-0.5">
        <p className="text-xs text-red-700 font-medium mb-1.5">Delete this chat?</p>
        <p className="text-xs text-red-400 truncate mb-3">{chat.title}</p>
        <div className="flex gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(chat._id); }}
            className="flex-1 py-1.5 text-xs font-medium text-white bg-red-600
                       rounded-lg hover:bg-red-700 transition-colors"
          >Delete</button>
          <button
            onClick={(e) => { e.stopPropagation(); setShowDeleteConf(false); }}
            className="flex-1 py-1.5 text-xs font-medium text-gray-600 bg-white
                       border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => !isRenaming && onClick(chat._id)}
      className={`group relative flex items-start gap-2 px-3 py-2.5 rounded-xl mx-1 my-0.5
                  cursor-pointer transition-colors select-none
                  ${isActive ? "bg-indigo-50 text-indigo-900" : "hover:bg-gray-100 text-gray-700"}`}
    >
      <div className="flex-1 min-w-0">
        {isRenaming ? (
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <input
              ref={renameInputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={handleKey}
              onBlur={commitRename}
              maxLength={150}
              className="flex-1 min-w-0 text-sm font-medium px-1.5 py-0.5 rounded border
                         border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
            />
            <button onMouseDown={(e) => { e.preventDefault(); commitRename(); }}
              className="p-1 text-emerald-600 hover:text-emerald-700" aria-label="Confirm">
              <CheckIcon />
            </button>
            <button onMouseDown={(e) => { e.preventDefault(); cancelRename(); }}
              className="p-1 text-gray-400 hover:text-gray-600" aria-label="Cancel">
              <XIcon />
            </button>
          </div>
        ) : (
          <>
            <p className={`text-sm font-medium truncate leading-snug
                           ${isActive ? "text-indigo-900" : "text-gray-800"}`}>
              {chat.title}
            </p>
            {chat.lastMessagePreview && (
              <p className="text-xs text-gray-400 truncate mt-0.5">{chat.lastMessagePreview}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              {relativeTime(chat.lastMessageAt)}
              {chat.messageCount > 0 && (
                <span className="ml-1.5 text-gray-300">· {chat.messageCount} msgs</span>
              )}
            </p>
          </>
        )}
      </div>

      {!isRenaming && (
        <div className="relative flex-shrink-0" ref={menuRef}>
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu((v) => !v); }}
            aria-label="Chat options"
            className={`p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-200
                        transition-all ${showMenu ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 4a2 2 0 110-4 2 2 0 010 4zm0 4a2 2 0 110-4 2 2 0 010 4z"/>
            </svg>
          </button>

          {showMenu && (
            <div className="absolute right-0 top-6 z-50 w-40 bg-white rounded-xl shadow-lg
                            border border-gray-200 py-1 text-sm">
              <button onClick={startRename}
                className="w-full flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-50 text-left">
                <PencilIcon /> Rename
              </button>
              <button onClick={(e) => { e.stopPropagation(); onArchive(chat._id); setShowMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-50 text-left">
                <ArchiveIcon /> Archive
              </button>
              <div className="border-t border-gray-100 my-1" />
              <button onClick={(e) => { e.stopPropagation(); setShowDeleteConf(true); setShowMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 text-left">
                <TrashIcon /> Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatHistoryItem;
