import Card from "../ui/Card.jsx";
const PartiesTable = ({ parties }) => {
  if (!parties?.length) return null;
  return (
    <Card className="mb-4">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">Parties Involved</h3>
      <div className="divide-y divide-gray-100">
        {parties.map((p, i) => (
          <div key={i} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
            <span className="text-sm text-gray-800">{p.name}</span>
            <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">{p.role}</span>
          </div>
        ))}
      </div>
    </Card>
  );
};
export default PartiesTable;
