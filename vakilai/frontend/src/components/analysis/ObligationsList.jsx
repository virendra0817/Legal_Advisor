import Card from "../ui/Card.jsx";
const ObligationsList = ({ obligations }) => {
  if (!obligations?.length) return null;
  const grouped = obligations.reduce((acc, o) => { (acc[o.party] ||= []).push(o.obligation); return acc; }, {});
  return (
    <Card className="mb-4">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">Obligations</h3>
      <div className="space-y-4">
        {Object.entries(grouped).map(([party, items]) => (
          <div key={party}>
            <p className="text-xs font-medium text-indigo-600 mb-1.5">{party}</p>
            <ul className="space-y-1">
              {items.map((item, i) => (
                <li key={i} className="text-sm text-gray-600 flex gap-2">
                  <span className="text-gray-300 mt-0.5">•</span><span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
};
export default ObligationsList;
