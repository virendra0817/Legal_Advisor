import { useLocation } from "react-router-dom";
const TITLES = { "/dashboard": "Dashboard", "/chat": "New Chat", "/documents": "Documents", "/history": "Chat History" };
const TopBar = ({ onMenuClick }) => {
  const { pathname } = useLocation();
  const title = TITLES[pathname] || "VakilAI";
  return (
    <header className="flex items-center gap-3 h-14 px-4 bg-white border-b border-gray-200 lg:hidden flex-shrink-0">
      <button onClick={onMenuClick} className="p-2 -ml-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"/>
        </svg>
      </button>
      <span className="text-sm font-medium text-gray-800">{title}</span>
    </header>
  );
};
export default TopBar;
