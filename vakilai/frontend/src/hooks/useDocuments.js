import { useState, useEffect, useCallback, useRef } from "react";
import api from "../api/axiosInstance.js";

const useDocuments = () => {
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const pollRefs = useRef({});

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get("/documents");
      setDocuments(res.data.documents);
    } catch (err) {
      setError(err.userMessage || "Failed to load documents.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  // Poll a single document's status until it's ready or failed
  const pollStatus = useCallback((documentId) => {
    if (pollRefs.current[documentId]) return;

    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/documents/${documentId}/status`);
        const { status } = res.data;

        setDocuments(prev => prev.map(d => d._id === documentId ? { ...d, status } : d));

        if (status === "ready" || status === "failed") {
          clearInterval(pollRefs.current[documentId]);
          delete pollRefs.current[documentId];
          fetchDocuments(); // refresh full record once settled
        }
      } catch {
        clearInterval(pollRefs.current[documentId]);
        delete pollRefs.current[documentId];
      }
    }, 3000);

    pollRefs.current[documentId] = interval;
  }, [fetchDocuments]);

  useEffect(() => () => Object.values(pollRefs.current).forEach(clearInterval), []);

  const deleteDocument = useCallback(async (id) => {
    const prev = documents;
    setDocuments(p => p.filter(d => d._id !== id));
    try {
      await api.delete(`/documents/${id}`);
    } catch (err) {
      setDocuments(prev);
      setError(err.userMessage || "Failed to delete document.");
    }
  }, [documents]);

  const addDocument = useCallback((doc) => {
    setDocuments(prev => [doc, ...prev]);
    if (doc.status === "uploaded" || doc.status === "processing") pollStatus(doc.id || doc._id);
  }, [pollStatus]);

  return { documents, isLoading, error, refresh: fetchDocuments, deleteDocument, addDocument, pollStatus };
};
export default useDocuments;
