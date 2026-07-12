import Card from "../ui/Card.jsx";
const NextStepsPanel = ({ steps }) => {
  if (!steps?.length) return null;
  return (
    <Card className="mb-4 bg-indigo-50 border-indigo-100">
      <h3 className="text-sm font-semibold text-indigo-900 mb-3">Recommended Next Steps</h3>
      <ol className="space-y-2.5">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-600 text-white text-xs font-medium flex items-center justify-center">{i + 1}</span>
            <span className="text-sm text-indigo-800 leading-relaxed">{s}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
};
export default NextStepsPanel;
