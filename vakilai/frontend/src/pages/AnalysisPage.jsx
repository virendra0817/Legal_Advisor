import { useParams, useNavigate } from "react-router-dom";
import useAnalysis from "../hooks/useAnalysis.js";
import useAuth from "../hooks/useAuth.js";
import AnalysisTriggerCard from "../components/analysis/AnalysisTriggerCard.jsx";
import AnalysisLoadingState from "../components/analysis/AnalysisLoadingState.jsx";
import SummaryCard from "../components/analysis/SummaryCard.jsx";
import TruncationNotice from "../components/analysis/TruncationNotice.jsx";
import PartiesTable from "../components/analysis/PartiesTable.jsx";
import DatesTimeline from "../components/analysis/DatesTimeline.jsx";
import ClauseAccordion from "../components/analysis/ClauseAccordion.jsx";
import PenaltiesList from "../components/analysis/PenaltiesList.jsx";
import ObligationsList from "../components/analysis/ObligationsList.jsx";
import RisksList from "../components/analysis/RisksList.jsx";
import ApplicableLawsGrid from "../components/analysis/ApplicableLawsGrid.jsx";
import NextStepsPanel from "../components/analysis/NextStepsPanel.jsx";
import Button from "../components/ui/Button.jsx";
import Spinner from "../components/ui/Spinner.jsx";

const AnalysisPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canAnalyseDocuments } = useAuth();
  const { analysis, isLoading, isAnalysing, error, notFound, triggerAnalysis, reanalyse } = useAnalysis(id);

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><Spinner size="lg" className="text-indigo-500"/></div>;
  }

  if (!canAnalyseDocuments) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Pro feature</h2>
        <p className="text-sm text-gray-500 mb-6">Document analysis requires a Pro or Enterprise plan.</p>
        <Button onClick={() => navigate("/pricing")}>View pricing</Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <button onClick={() => navigate("/documents")} className="text-xs text-gray-400 hover:text-gray-600 mb-4 flex items-center gap-1">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5"/>
        </svg>
        Back to documents
      </button>

      <h1 className="text-xl font-bold text-gray-900 mb-6">Document Analysis</h1>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>
      )}

      {isAnalysing ? (
        <AnalysisLoadingState />
      ) : notFound || !analysis ? (
        <AnalysisTriggerCard onAnalyse={triggerAnalysis} isAnalysing={isAnalysing} />
      ) : (
        <>
          {analysis.wasTruncated && <TruncationNotice />}
          <SummaryCard
            documentType={analysis.documentType}
            documentTypeConfidence={analysis.documentTypeConfidence}
            summary={analysis.summary}
            overallRiskLevel={analysis.overallRiskLevel}
          />
          <PartiesTable parties={analysis.parties} />
          <DatesTimeline dates={analysis.importantDates} />
          <ClauseAccordion clauses={analysis.legalClauses} />
          <PenaltiesList penalties={analysis.penalties} />
          <ObligationsList obligations={analysis.obligations} />
          <RisksList risks={analysis.risks} />
          <ApplicableLawsGrid laws={analysis.applicableLaws} />
          <NextStepsPanel steps={analysis.recommendedNextSteps} />

          <div className="text-center mt-6">
            <Button variant="secondary" size="sm" onClick={() => reanalyse()} isLoading={isAnalysing}>
              Re-analyse document
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
export default AnalysisPage;
