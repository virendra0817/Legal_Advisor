import UserMessage from "./UserMessage.jsx";
import AssistantMessage from "./AssistantMessage.jsx";

const MessageBubble = ({ message, onCitationClick }) => (
  <div className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
    {message.role === "user"
      ? <UserMessage content={message.content} />
      : <AssistantMessage content={message.content} citations={message.citations} onCitationClick={onCitationClick} />}
  </div>
);
export default MessageBubble;
