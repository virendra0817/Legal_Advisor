import Card from "../ui/Card.jsx";
const ApplicableLawsGrid = ({ laws }) => {
  if (!laws?.length) return null;
  return (
    <Card className="mb-4">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">Applicable Laws</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {laws.map((l, i) => (
          <div key={i} className="bg-gray-50 rounded-xl p-3">
            <p className="text-sm font-medium text-gray-800 mb-1">{l.actName}</p>
            <p className="text-xs text-gray-500">{l.relevance}</p>
          </div>
        ))}
      </div>
    </Card>
  );
};
export default ApplicableLawsGrid;
