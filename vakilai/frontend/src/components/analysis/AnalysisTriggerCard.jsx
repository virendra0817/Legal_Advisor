import Card from "../ui/Card.jsx";
import Button from "../ui/Button.jsx";

const AnalysisTriggerCard = ({ onAnalyse, isAnalysing }) => (
  <Card className="text-center py-10">
    <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
      <svg className="w-6 h-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/>
      </svg>
    </div>
    <h2 className="text-base font-semibold text-gray-900 mb-2">Ready for AI analysis</h2>
    <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
      Get a structured breakdown of document type, parties, clauses, penalties, obligations, and risks.
    </p>
    <Button onClick={() => onAnalyse()} isLoading={isAnalysing} variant="primary">
      {isAnalysing ? "Analysing…" : "Analyse this document"}
    </Button>
  </Card>
);
export default AnalysisTriggerCard;
