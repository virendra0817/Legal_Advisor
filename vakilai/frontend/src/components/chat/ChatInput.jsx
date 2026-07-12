import { useState, useRef, useEffect } from "react";

const ChatInput = ({ onSend, isLoading }) => {
  const [value, setValue] = useState("");
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [value]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!value.trim() || isLoading) return;
    onSend(value.trim());
    setValue("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e); }
  };

  return (
    <div className="border-t border-gray-200 bg-white px-4 sm:px-6 py-4">
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe your situation or ask a question…"
          rows={1}
          disabled={isLoading}
          className="flex-1 resize-none px-4 py-2.5 text-sm bg-gray-100 rounded-2xl border border-transparent
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors
                     max-h-40 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!value.trim() || isLoading}
          className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-indigo-600 text-white rounded-full
                     hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/>
          </svg>
        </button>
      </form>
      <p className="text-xs text-gray-300 text-center mt-2">VakilAI provides legal information, not legal advice.</p>
    </div>
  );
};
export default ChatInput;
