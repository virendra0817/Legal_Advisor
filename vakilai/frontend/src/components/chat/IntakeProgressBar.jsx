const PHASE_LABEL = {
  identifying_issue:     "Understanding your situation",
  gathering_information: "Gathering details",
  ready_for_guidance:    "Preparing your guidance",
  guidance_provided:     null,
};

const IntakeProgressBar = ({ phase, answered = 0, total = 0 }) => {
  const label = PHASE_LABEL[phase];
  if (!label) return null;

  const percent = total > 0 ? Math.round((answered / total) * 100) : phase === "identifying_issue" ? 10 : 50;

  return (
    <div className="px-4 sm:px-6 py-2.5 bg-indigo-50 border-b border-indigo-100">
      <div className="max-w-3xl mx-auto flex items-center gap-3">
        <span className="text-xs font-medium text-indigo-700 whitespace-nowrap">{label}</span>
        <div className="flex-1 h-1.5 bg-indigo-100 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${percent}%` }}/>
        </div>
        {total > 0 && <span className="text-xs text-indigo-400 whitespace-nowrap">{answered}/{total}</span>}
      </div>
    </div>
  );
};
export default IntakeProgressBar;
