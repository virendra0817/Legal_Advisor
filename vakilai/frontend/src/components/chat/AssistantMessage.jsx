import CitationChip from "./CitationChip.jsx";
import Badge from "../ui/Badge.jsx";

const CONFIDENCE_COLOR = { High: "emerald", Medium: "amber", Low: "red" };

// Renders text with [1] [2] markers replaced by clickable CitationChip components,
// and strips a trailing "**Confidence: X**" line into a separate badge.
const parseContent = (content="") => {
  const confidenceMatch = content.match(/\*\*Confidence:\s*(High|Medium|Low)\*\*/i);
  const confidence = confidenceMatch ? confidenceMatch[1] : null;
  const bodyText = confidenceMatch ? content.replace(confidenceMatch[0], "").trim() : content;

  const parts = bodyText.split(/(\[\d+\])/g);
  return { parts, confidence };
};

const AssistantMessage = ({ content, citations = [], onCitationClick }) => {
  const { parts, confidence } = parseContent(content);

  return (
    <div className="max-w-[85%] sm:max-w-[75%]">
      <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3">
        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
          {parts.map((part, i) => {
            const m = part.match(/^\[(\d+)\]$/);
            if (m) return <CitationChip key={i} marker={parseInt(m[1])} onClick={onCitationClick} />;
            return <span key={i}>{part}</span>;
          })}
        </p>
      </div>
      <div className="flex items-center gap-2 mt-1.5 px-1">
        {confidence && <Badge color={CONFIDENCE_COLOR[confidence] || "gray"}>Confidence: {confidence}</Badge>}
        {citations.length > 0 && (
          <button onClick={() => onCitationClick(null)} className="text-xs text-gray-400 hover:text-indigo-600 transition-colors">
            {citations.length} source{citations.length !== 1 ? "s" : ""}
          </button>
        )}
      </div>
    </div>
  );
};
export default AssistantMessage;
