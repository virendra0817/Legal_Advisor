import { useNavigate } from "react-router-dom";

const ChatHeader = ({ title, categoryLabel }) => {
  const navigate = useNavigate();
  return (
    <div className="flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-gray-200 bg-white flex-shrink-0">
      <button onClick={() => navigate("/dashboard")} className="lg:hidden p-1 -ml-1 text-gray-400 hover:text-gray-600">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5"/>
        </svg>
      </button>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{title || "New conversation"}</p>
        {categoryLabel && <p className="text-xs text-gray-400">{categoryLabel}</p>}
      </div>
    </div>
  );
};
export default ChatHeader;
