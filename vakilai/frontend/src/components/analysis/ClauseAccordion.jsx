import { useState } from "react";
import Card from "../ui/Card.jsx";

const ClauseItem = ({ clause, isOpen, onToggle }) => (
  <div className="border-b border-gray-100 last:border-0">
    <button onClick={onToggle} className="w-full flex items-center justify-between py-3 text-left">
      <span className="text-sm font-medium text-gray-800">{clause.clauseTitle}</span>
      <svg className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
           fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
      </svg>
    </button>
    {isOpen && (
      <div className="pb-3 space-y-2">
        <p className="text-sm text-gray-600 leading-relaxed">{clause.clauseSummary}</p>
        <p className="text-xs text-gray-400 italic border-l-2 border-gray-200 pl-3">"{clause.originalText}"</p>
      </div>
    )}
  </div>
);

const ClauseAccordion = ({ clauses }) => {
  const [openIndex, setOpenIndex] = useState(0);
  if (!clauses?.length) return null;
  return (
    <Card className="mb-4">
      <h3 className="text-sm font-semibold text-gray-800 mb-1">Key Clauses</h3>
      {clauses.map((c, i) => (
        <ClauseItem key={i} clause={c} isOpen={openIndex === i} onToggle={() => setOpenIndex(openIndex === i ? -1 : i)} />
      ))}
    </Card>
  );
};
export default ClauseAccordion;
