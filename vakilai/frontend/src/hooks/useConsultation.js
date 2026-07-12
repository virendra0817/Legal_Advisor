import { useState, useCallback, useRef, useEffect } from "react";
import api from "../api/axiosInstance.js";
import { chatApi } from "../api/chatApi.js";

const useConsultation = (chatId) => {
  const [messages,    setMessages]    = useState([]);
  const [phase,       setPhase]       = useState("identifying_issue");
  const [isLoading,   setIsLoading]   = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [error,       setError]       = useState(null);
  const [chatMeta,    setChatMeta]    = useState(null);
  const bottomRef = useRef(null);

  // Load existing chat history on mount / chatId change
  useEffect(() => {
    if (!chatId) { setIsLoadingHistory(false); return; }
    let cancelled = false;
    setIsLoadingHistory(true);
    chatApi.load(chatId).then(data => {
      if (cancelled) return;
      setMessages(data.messages.map(m => ({
        id: m._id, role: m.role, content: m.content,
        citations: m.citations || [], phase: m.consultationPhase,
      })));
      setChatMeta(data.chat);
      const lastAssistant = [...data.messages].reverse().find(m => m.role === "assistant");
      if (lastAssistant?.consultationPhase) setPhase(lastAssistant.consultationPhase);
    }).catch(() => setError("Failed to load this conversation.")
    ).finally(() => !cancelled && setIsLoadingHistory(false));
    return () => { cancelled = true; };
  }, [chatId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || isLoading) return;

    const userMsg = { id: `local-${Date.now()}`, role: "user", content: text, citations: [] };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    setError(null);

    try {
      // Persist user message
      await chatApi.saveMessage(chatId, { role: "user", content: text });

      // Get AI response
      const res = await api.post(`/consultations/${chatId}/message`, {
  message: text,
});

console.log(res.data);

// Your backend wraps everything in sendSuccess()
const payload = res.data.data || res.data;

const {
  reply,
  citations = [],
  phase: newPhase,
  wasPartialIntake,
  missingFacts,
} = payload;

if (!reply) {
  throw new Error("Backend did not return reply");
}

      console.log("Consultation response:", res.data);
      setPhase(newPhase);
      
      const assistantMsg = {
        id: `local-${Date.now()}-a`, role: "assistant", content: reply,
        citations, phase: newPhase, wasPartialIntake, missingFacts,
      };
      setMessages(prev => [...prev, assistantMsg]);

      // Persist assistant message
      await chatApi.saveMessage(chatId, {
        role: "assistant", content: reply, citations, consultationPhase: newPhase,
      });
    } catch (err) {
      setError(err.userMessage || err.response?.data?.message || "Failed to get a response. Please try again.");
      setMessages(prev => prev.filter(m => m.id !== userMsg.id));
    } finally {
      setIsLoading(false);
    }
  }, [chatId, isLoading]);

  return {
    messages, phase, isLoading, isLoadingHistory, error, chatMeta, bottomRef,
    sendMessage,
  };
};
export default useConsultation;
