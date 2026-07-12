const StreamingCursor = () => (
  <div className="flex justify-start">
    <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
      {[0, 1, 2].map(i => (
        <span key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }}/>
      ))}
    </div>
  </div>
);
export default StreamingCursor;
