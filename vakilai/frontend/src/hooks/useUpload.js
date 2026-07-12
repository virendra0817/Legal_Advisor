import { useState, useCallback } from "react";
import api from "../api/axiosInstance.js";

const ALLOWED_TYPES = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"];
const MAX_SIZE = 15 * 1024 * 1024;

const useUpload = (onUploaded) => {
  const [queue, setQueue] = useState([]); // [{ id, file, progress, status, error, documentId }]

  const validateFile = (file) => {
    if (!ALLOWED_TYPES.includes(file.type)) return "Only PDF, DOCX, and TXT files are supported.";
    if (file.size > MAX_SIZE) return "File exceeds the 15MB limit.";
    return null;
  };

  const uploadFile = useCallback((file) => {
    const id = `${file.name}-${Date.now()}`;
    const validationError = validateFile(file);

    if (validationError) {
      setQueue(prev => [...prev, { id, file, progress: 0, status: "error", error: validationError }]);
      return;
    }

    setQueue(prev => [...prev, { id, file, progress: 0, status: "uploading", error: null }]);

    const formData = new FormData();
    formData.append("document", file);

    api.post("/documents/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        const progress = Math.round((e.loaded * 100) / e.total);
        setQueue(prev => prev.map(q => q.id === id ? { ...q, progress } : q));
      },
    }).then((res) => {
      setQueue(prev => prev.map(q => q.id === id
        ? { ...q, status: "processing", progress: 100, documentId: res.data.document.id }
        : q));
      onUploaded?.(res.data.document);
    }).catch((err) => {
      setQueue(prev => prev.map(q => q.id === id
        ? { ...q, status: "error", error: err.userMessage || err.response?.data?.message || "Upload failed." }
        : q));
    });
  }, [onUploaded]);

  const addFiles = useCallback((fileList) => {
    Array.from(fileList).forEach(uploadFile);
  }, [uploadFile]);

  const dismiss = useCallback((id) => {
    setQueue(prev => prev.filter(q => q.id !== id));
  }, []);

  const clearCompleted = useCallback(() => {
    setQueue(prev => prev.filter(q => q.status === "uploading"));
  }, []);

  return { queue, addFiles, dismiss, clearCompleted };
};
export default useUpload;
