import Card from "../ui/Card.jsx";
import Skeleton from "../ui/Skeleton.jsx";
const AnalysisLoadingState = () => (
  <div>
    <Card className="mb-4"><Skeleton variant="text" width="40%" className="mb-3"/><Skeleton variant="text" width="90%"/><Skeleton variant="text" width="70%" className="mt-2"/></Card>
    {Array.from({ length: 3 }).map((_, i) => (
      <Card key={i} className="mb-4"><Skeleton variant="text" width="30%" className="mb-3"/><Skeleton variant="text" width="100%" className="mb-2"/><Skeleton variant="text" width="80%"/></Card>
    ))}
    <p className="text-center text-xs text-gray-400 mt-2">Analysing your document — this can take up to a minute…</p>
  </div>
);
export default AnalysisLoadingState;
