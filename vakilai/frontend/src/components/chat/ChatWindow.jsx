import MessageBubble from "./MessageBubble.jsx";
import StreamingCursor from "./StreamingCursor.jsx";
import EmptyState from "../ui/EmptyState.jsx";

const ChatWindow = ({ messages, isLoading, onCitationClick, bottomRef }) => (
  <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
    <div className="max-w-3xl mx-auto space-y-4">
      {messages.length === 0 && !isLoading ? (
        <EmptyState
          title="Tell me what's going on"
          description="Describe your legal situation in your own words — I'll ask any follow-up questions I need."
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
            </svg>
          }
        />
      ) : (
        messages.map(m => <MessageBubble key={m.id} message={m} onCitationClick={onCitationClick} />)
      )}
      {isLoading && <StreamingCursor />}
      <div ref={bottomRef} />
    </div>
  </div>
);
export default ChatWindow;
