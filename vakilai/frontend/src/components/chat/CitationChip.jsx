const CitationChip = ({ marker, onClick }) => (
  <button
    onClick={() => onClick(marker)}
    className="inline-flex items-center justify-center w-4.5 h-4.5 w-5 h-5 mx-0.5 text-[10px] font-medium
               text-indigo-600 bg-indigo-100 rounded-full hover:bg-indigo-200 transition-colors align-text-top"
  >
    {marker}
  </button>
);
export default CitationChip;
