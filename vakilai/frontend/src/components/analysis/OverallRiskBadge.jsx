const RISK = {
  low:    { color: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Low Risk" },
  medium: { color: "bg-amber-50 text-amber-700 border-amber-200",       label: "Medium Risk" },
  high:   { color: "bg-red-50 text-red-700 border-red-200",            label: "High Risk" },
};
const OverallRiskBadge = ({ level }) => {
  const r = RISK[level] || RISK.medium;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${r.color}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current"/>
      {r.label}
    </span>
  );
};
export default OverallRiskBadge;
