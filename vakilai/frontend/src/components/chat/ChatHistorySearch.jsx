import { useRef } from "react";

const SearchIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/>
  </svg>
);

const Spinner = () => (
  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
  </svg>
);

const XIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
  </svg>
);

const ChatHistorySearch = ({ value, onChange, isSearching }) => {
  const inputRef = useRef(null);

  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
        {isSearching ? <Spinner /> : <SearchIcon />}
      </div>

      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search conversations…"
        aria-label="Search chat history"
        className="w-full pl-9 pr-8 py-2 text-sm bg-gray-100 border border-transparent
                   rounded-lg text-gray-900 placeholder-gray-400
                   focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white
                   transition-colors"
      />

      {value && (
        <button
          onClick={() => { onChange(""); inputRef.current?.focus(); }}
          aria-label="Clear search"
          className="absolute inset-y-0 right-0 flex items-center pr-2.5
                     text-gray-400 hover:text-gray-600 transition-colors"
        >
          <XIcon />
        </button>
      )}
    </div>
  );
};

export default ChatHistorySearch;
