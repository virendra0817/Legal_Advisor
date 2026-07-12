import { useState, useEffect, useCallback } from "react";
import api from "../api/axiosInstance.js";

const useAnalysis = (documentId) => {
  const [analysis, setAnalysis] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);

  const fetchExisting = useCallback(async () => {
    setIsLoading(true);
    setNotFound(false);
    try {
      const res = await api.get(`/documents/${documentId}/analysis`);
      setAnalysis(res.data.analysis);
    } catch (err) {
      if (err.response?.status === 404) setNotFound(true);
      else setError(err.userMessage || "Failed to load analysis.");
    } finally {
      setIsLoading(false);
    }
  }, [documentId]);

  useEffect(() => { fetchExisting(); }, [fetchExisting]);

  const triggerAnalysis = useCallback(async (legalCategory = null) => {
    setIsAnalysing(true);
    setError(null);
    try {
      const res = await api.post(`/documents/${documentId}/analyse`, { legalCategory });
      setAnalysis(res.data.analysis);
      setNotFound(false);
    } catch (err) {
      setError(err.userMessage || err.response?.data?.message || "Analysis failed. Please try again.");
    } finally {
      setIsAnalysing(false);
    }
  }, [documentId]);

  const reanalyse = useCallback(async (legalCategory = null) => {
    setIsAnalysing(true);
    setError(null);
    try {
      const res = await api.post(`/documents/${documentId}/reanalyse`, { legalCategory });
      setAnalysis(res.data.analysis);
    } catch (err) {
      setError(err.userMessage || "Re-analysis failed.");
    } finally {
      setIsAnalysing(false);
    }
  }, [documentId]);

  return { analysis, isLoading, isAnalysing, error, notFound, triggerAnalysis, reanalyse };
};
export default useAnalysis;
