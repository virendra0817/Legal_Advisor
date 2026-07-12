import { useState, useRef } from "react";

const DropZone = ({ onFiles, disabled }) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); !disabled && setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors
        ${disabled ? "opacity-50 cursor-not-allowed border-gray-200" :
          isDragging ? "border-indigo-400 bg-indigo-50" : "border-gray-300 hover:border-indigo-300 hover:bg-gray-50"}`}
    >
      <input
        ref={inputRef} type="file" multiple hidden disabled={disabled}
        accept=".pdf,.docx,.txt"
        onChange={(e) => { if (e.target.files?.length) onFiles(e.target.files); e.target.value = ""; }}
      />
      <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-6 h-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 1110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"/>
        </svg>
      </div>
      <p className="text-sm font-medium text-gray-700 mb-1">
        {isDragging ? "Drop to upload" : "Drag and drop, or click to browse"}
      </p>
      <p className="text-xs text-gray-400">PDF, DOCX, or TXT — up to 15MB</p>
    </div>
  );
};
export default DropZone;
