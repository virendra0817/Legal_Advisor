import Card from "../ui/Card.jsx";
const DatesTimeline = ({ dates }) => {
  if (!dates?.length) return null;
  return (
    <Card className="mb-4">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">Important Dates</h3>
      <div className="space-y-3">
        {dates.map((d, i) => (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center pt-1">
              <span className="w-2 h-2 rounded-full bg-indigo-500"/>
              {i < dates.length - 1 && <span className="w-px flex-1 bg-gray-200 mt-1"/>}
            </div>
            <div className="pb-1">
              <p className="text-sm font-medium text-gray-800">{d.date}</p>
              <p className="text-xs text-gray-400">{d.description}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
export default DatesTimeline;
