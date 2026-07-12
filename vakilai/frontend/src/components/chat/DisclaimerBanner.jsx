import { useState, useEffect } from "react";

const DisclaimerBanner = ({ text, storageKey = "vakilai_disclaimer_dismissed" }) => {
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(storageKey) === "true");

  const dismiss = () => { sessionStorage.setItem(storageKey, "true"); setDismissed(true); };

  if (dismissed) return null;

  return (
    <div className="px-4 sm:px-6 py-2.5 bg-amber-50 border-b border-amber-100">
      <div className="max-w-3xl mx-auto flex items-start gap-2.5 text-xs text-amber-700">
        <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/>
        </svg>
        <p className="flex-1 leading-relaxed">{text || "VakilAI provides legal information, not legal advice. For matters requiring filing or representation, please consult a licensed advocate."}</p>
        <button onClick={dismiss} className="flex-shrink-0 text-amber-400 hover:text-amber-600">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </div>
  );
};
export default DisclaimerBanner;
