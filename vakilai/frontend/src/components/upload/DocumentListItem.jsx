import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Badge from "../ui/Badge.jsx";

const STATUS_MAP = {
  uploaded:   { label: "Queued",     color: "gray" },
  processing: { label: "Processing", color: "amber" },
  ready:      { label: "Ready",      color: "emerald" },
  failed:     { label: "Failed",     color: "red" },
};

const EXT_ICON = { pdf: "📄", docx: "📝", txt: "📃" };

const DocumentListItem = ({ doc, onDelete }) => {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);
  const status = STATUS_MAP[doc.status] || STATUS_MAP.uploaded;
  const isReady = doc.status === "ready";

  useEffect(() => {
    if (!showMenu) return;
    const h = (e) => !menuRef.current?.contains(e.target) && setShowMenu(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showMenu]);

  return (
    <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors">
      <div className="text-2xl flex-shrink-0">{EXT_ICON[doc.fileExtension] || "📄"}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{doc.fileName}</p>
        <div className="flex items-center gap-2 mt-1">
          <Badge color={status.color}>{status.label}</Badge>
          <span className="text-xs text-gray-400">{doc.fileSizeFormatted}</span>
          <span className="text-xs text-gray-300">·</span>
          <span className="text-xs text-gray-400">{new Date(doc.uploadedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
        </div>
      </div>

      <div className="relative flex-shrink-0" ref={menuRef}>
        <button onClick={() => setShowMenu(v => !v)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 4a2 2 0 110-4 2 2 0 010 4zm0 4a2 2 0 110-4 2 2 0 010 4z"/>
          </svg>
        </button>
        {showMenu && (
          <div className="absolute right-0 top-9 z-10 w-44 bg-white rounded-xl shadow-lg border border-gray-200 py-1 text-sm">
            <button disabled={!isReady} onClick={() => navigate(`/documents/${doc._id}/analysis`)}
              className="w-full text-left px-3 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
              Analyse document
            </button>
            <button disabled={!isReady} onClick={() => navigate(`/chat?documentId=${doc._id}`)}
              className="w-full text-left px-3 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
              Chat about this
            </button>
            <div className="border-t border-gray-100 my-1"/>
            <button onClick={() => onDelete(doc._id)} className="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50">
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
export default DocumentListItem;
