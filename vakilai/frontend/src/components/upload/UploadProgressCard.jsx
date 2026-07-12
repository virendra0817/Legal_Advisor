import Badge from "../ui/Badge.jsx";

const STATUS_LABEL = { uploading: "Uploading…", processing: "Processing…", error: "Failed" };
const STATUS_COLOR = { uploading: "indigo", processing: "amber", error: "red" };

const FileIcon = () => (
  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>
  </svg>
);

const UploadProgressCard = ({ item, onDismiss }) => (
  <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-3">
    <FileIcon />
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-sm text-gray-800 truncate">{item.file.name}</p>
        {item.status !== "uploading" && <Badge color={STATUS_COLOR[item.status] || "gray"}>{STATUS_LABEL[item.status]}</Badge>}
      </div>
      {item.status === "uploading" ? (
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${item.progress}%` }}/>
        </div>
      ) : item.status === "error" ? (
        <p className="text-xs text-red-500">{item.error}</p>
      ) : (
        <p className="text-xs text-gray-400">Extracting text — this can take up to a minute</p>
      )}
    </div>
    {item.status === "error" && (
      <button onClick={() => onDismiss(item.id)} className="p-1 text-gray-400 hover:text-gray-600">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    )}
  </div>
);
export default UploadProgressCard;
