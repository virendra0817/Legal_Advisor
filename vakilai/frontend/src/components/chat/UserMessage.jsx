const UserMessage = ({ content }) => (
  <div className="max-w-[85%] sm:max-w-[75%] bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-4 py-3">
    <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
  </div>
);
export default UserMessage;
