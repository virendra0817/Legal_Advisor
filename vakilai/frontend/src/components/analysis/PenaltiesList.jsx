import Card from "../ui/Card.jsx";
import Badge from "../ui/Badge.jsx";
const SEVERITY_COLOR = { low: "emerald", medium: "amber", high: "red" };
const PenaltiesList = ({ penalties }) => {
  if (!penalties?.length) return null;
  return (
    <Card className="mb-4">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">Penalties</h3>
      <div className="space-y-3">
        {penalties.map((p, i) => (
          <div key={i} className="flex items-start justify-between gap-3 pb-3 border-b border-gray-100 last:border-0 last:pb-0">
            <div>
              <p className="text-sm text-gray-800 font-medium">{p.trigger}</p>
              <p className="text-xs text-gray-500 mt-0.5">{p.consequence}</p>
            </div>
            <Badge color={SEVERITY_COLOR[p.severity]}>{p.severity}</Badge>
          </div>
        ))}
      </div>
    </Card>
  );
};
export default PenaltiesList;
