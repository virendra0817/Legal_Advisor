const SOURCE_LABEL = { user_document: "Your document", kb_statute: "Legal knowledge base" };

const CitationPanel = ({ citations, activeMarker, onClose }) => {
  if (!citations?.length) return null;
  const active = citations.find(c => c.marker === activeMarker);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 lg:absolute lg:right-4 lg:bottom-20 lg:inset-x-auto lg:w-80">
      <div className="bg-white border-t lg:border border-gray-200 rounded-t-2xl lg:rounded-2xl shadow-lg p-4 max-h-72 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-700">Sources</p>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="space-y-3">
          {(activeMarker ? [active].filter(Boolean) : citations).map(c => (
            <div key={c.marker} className="border-l-2 border-indigo-200 pl-3">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[10px] font-medium text-indigo-600 bg-indigo-50 rounded-full w-4 h-4 flex items-center justify-center">{c.marker}</span>
                <p className="text-xs font-medium text-gray-600">{SOURCE_LABEL[c.source] || c.source}</p>
              </div>
              {c.heading && <p className="text-xs text-gray-500 mb-1">{c.heading}</p>}
              <p className="text-xs text-gray-400 leading-relaxed italic">"{c.excerpt}"</p>
              {c.fileName && <p className="text-xs text-gray-300 mt-1">{c.fileName}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
export default CitationPanel;
