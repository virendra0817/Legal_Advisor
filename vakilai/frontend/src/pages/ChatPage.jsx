import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import useConsultation from "../hooks/useConsultation.js";
import { chatApi } from "../api/chatApi.js";
import ChatHeader from "../components/chat/ChatHeader.jsx";
import IntakeProgressBar from "../components/chat/IntakeProgressBar.jsx";
import DisclaimerBanner from "../components/chat/DisclaimerBanner.jsx";
import ChatWindow from "../components/chat/ChatWindow.jsx";
import ChatInput from "../components/chat/ChatInput.jsx";
import CitationPanel from "../components/chat/CitationPanel.jsx";
import Spinner from "../components/ui/Spinner.jsx";

const ChatPage = () => {
  const { chatId: paramChatId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [chatId, setChatId] = useState(paramChatId || null);
  const [isCreating, setIsCreating] = useState(!paramChatId);
  const [activeCitations, setActiveCitations] = useState(null);
  const [activeMarker, setActiveMarker] = useState(null);

  // Create a new chat if none exists yet (e.g. navigated from /chat or a category card)
  useEffect(() => {
    if (paramChatId) { setChatId(paramChatId); setIsCreating(false); return; }
    let cancelled = false;
    chatApi.create().then(data => {
      if (cancelled) return;
      setChatId(data.chat._id);
      navigate(`/chat/${data.chat._id}`, { replace: true });
    }).finally(() => !cancelled && setIsCreating(false));
    return () => { cancelled = true; };
  }, [paramChatId, navigate]);

  const { messages, phase, isLoading, isLoadingHistory, error, chatMeta, bottomRef, sendMessage } = useConsultation(chatId);

  const handleCitationClick = (marker) => {
    const lastAssistant = [...messages].reverse().find(m => m.role === "assistant" && m.citations?.length);
    if (!lastAssistant) return;
    setActiveCitations(lastAssistant.citations);
    setActiveMarker(marker);
  };

  if (isCreating || isLoadingHistory) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" className="text-indigo-500" />
      </div>
    );
  }

  const lastAssistantMsg = [...messages].reverse().find(m => m.role === "assistant");
  const missingFacts = lastAssistantMsg?.missingFacts || [];

  return (
    <div className="flex flex-col h-full relative">
      <ChatHeader title={chatMeta?.title} categoryLabel={chatMeta?.categoryLabel} />
      <IntakeProgressBar phase={phase} answered={0} total={0} />
      <DisclaimerBanner />

      {error && (
        <div className="px-4 sm:px-6 py-2 bg-red-50 border-b border-red-100">
          <p className="max-w-3xl mx-auto text-xs text-red-600">{error}</p>
        </div>
      )}

      <ChatWindow messages={messages} isLoading={isLoading} onCitationClick={handleCitationClick} bottomRef={bottomRef} />

      {missingFacts.length > 0 && (
        <div className="px-4 sm:px-6 py-2 bg-gray-50 border-t border-gray-100">
          <p className="max-w-3xl mx-auto text-xs text-gray-400">
            Not established: {missingFacts.join(", ")}
          </p>
        </div>
      )}

      <ChatInput onSend={sendMessage} isLoading={isLoading} />

      {activeCitations && (
        <CitationPanel
          citations={activeCitations}
          activeMarker={activeMarker}
          onClose={() => { setActiveCitations(null); setActiveMarker(null); }}
        />
      )}
    </div>
  );
};
export default ChatPage;
