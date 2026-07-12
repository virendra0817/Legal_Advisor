import Card from "../ui/Card.jsx";
import OverallRiskBadge from "./OverallRiskBadge.jsx";
import Badge from "../ui/Badge.jsx";

const CONF_COLOR = { high: "emerald", medium: "amber", low: "red" };

const SummaryCard = ({ documentType, documentTypeConfidence, summary, overallRiskLevel }) => (
  <Card className="mb-4">
    <div className="flex items-start justify-between gap-3 mb-3">
      <div>
        <p className="text-xs text-gray-400 mb-1">Document type</p>
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-gray-900">{documentType}</h2>
          <Badge color={CONF_COLOR[documentTypeConfidence] || "gray"}>{documentTypeConfidence} confidence</Badge>
        </div>
      </div>
      <OverallRiskBadge level={overallRiskLevel} />
    </div>
    <p className="text-sm text-gray-600 leading-relaxed">{summary}</p>
  </Card>
);
export default SummaryCard;
