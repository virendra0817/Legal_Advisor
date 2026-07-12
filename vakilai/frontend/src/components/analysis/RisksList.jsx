import Card from "../ui/Card.jsx";
import Badge from "../ui/Badge.jsx";
const LEVEL_COLOR = { low: "emerald", medium: "amber", high: "red" };

const RiskCard = ({ risk }) => (
  <div className="border border-gray-100 rounded-xl p-3.5">
    <div className="flex items-start justify-between gap-2 mb-1.5">
      <p className="text-sm font-medium text-gray-800">{risk.riskTitle}</p>
      <Badge color={LEVEL_COLOR[risk.riskLevel]}>{risk.riskLevel}</Badge>
    </div>
    <p className="text-xs text-gray-500 leading-relaxed mb-2">{risk.riskDescription}</p>
    <div className="flex gap-2 bg-indigo-50 rounded-lg px-3 py-2">
      <svg className="w-3.5 h-3.5 text-indigo-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
      </svg>
      <p className="text-xs text-indigo-700 leading-relaxed">{risk.recommendation}</p>
    </div>
  </div>
);

const RisksList = ({ risks }) => {
  if (!risks?.length) return null;
  return (
    <Card className="mb-4">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">Risks</h3>
      <div className="space-y-3">
        {risks.map((r, i) => <RiskCard key={i} risk={r} />)}
      </div>
    </Card>
  );
};
export default RisksList;
