import useUpload from "../hooks/useUpload.js";
import useDocuments from "../hooks/useDocuments.js";
import DropZone from "../components/upload/DropZone.jsx";
import UploadProgressCard from "../components/upload/UploadProgressCard.jsx";
import DocumentListItem from "../components/upload/DocumentListItem.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import Skeleton from "../components/ui/Skeleton.jsx";
import useAuth from "../hooks/useAuth.js";

const UploadPage = () => {
  const { documents, isLoading, deleteDocument, addDocument, pollStatus } = useDocuments();
  const { hasReachedDocumentLimit, maxDocuments, isFree } = useAuth();

  const { queue, addFiles, dismiss } = useUpload((doc) => {
    addDocument(doc);
    pollStatus(doc.id);
  });

  const activeUploads = queue.filter(q => q.status === "uploading" || q.status === "error");

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Documents</h1>
        <p className="text-sm text-gray-500">
          Upload rent agreements, contracts, notices, or any legal document for AI analysis and chat.
        </p>
      </div>

      {isFree && (
        <p className="text-xs text-gray-400 mb-3">
          {documents.length} / {maxDocuments} documents used on the Free plan
        </p>
      )}

      <DropZone onFiles={addFiles} disabled={hasReachedDocumentLimit} />

      {hasReachedDocumentLimit && (
        <p className="text-xs text-amber-600 mt-2">
          You've reached your Free plan's document limit. <a href="/pricing" className="underline font-medium">Upgrade to Pro</a> to upload more.
        </p>
      )}

      {activeUploads.length > 0 && (
        <div className="mt-4 space-y-2">
          {activeUploads.map(item => (
            <UploadProgressCard key={item.id} item={item} onDismiss={dismiss} />
          ))}
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Your library</h2>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
                <Skeleton variant="rect" width={32} height={32} />
                <div className="flex-1"><Skeleton variant="text" width="50%" className="mb-2"/><Skeleton variant="text" width="30%"/></div>
              </div>
            ))}
          </div>
        ) : documents.length === 0 ? (
          <EmptyState
            title="No documents yet"
            description="Upload a document above to get started with AI analysis."
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
            }
          />
        ) : (
          <div className="space-y-2">
            {documents.map(doc => (
              <DocumentListItem key={doc._id} doc={doc} onDelete={deleteDocument} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
export default UploadPage;
