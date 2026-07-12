import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  timeout: 90000,
});

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = window.__vakilai_token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401 try one silent token refresh, then give up
let refreshPromise = null;

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const orig = err.config;

    if (err.response?.status === 401 && !orig._retry) {
      orig._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = axios
            .post(`${API_BASE}/auth/refresh`, {}, { withCredentials: true })
            .then((r) => { window.__vakilai_token = r.data.accessToken; })
            .finally(() => { refreshPromise = null; });
        }
        await refreshPromise;
        if (window.__vakilai_token) {
          orig.headers.Authorization = `Bearer ${window.__vakilai_token}`;
          return api(orig);
        }
      } catch {
        window.__vakilai_token = null;
      }
    }

    // Surface a human-readable message
    err.userMessage =
      err.response?.data?.message ||
      (err.code === "ERR_NETWORK"
        ? "Cannot reach the server. Make sure the backend is running on port 5000."
        : "Something went wrong. Please try again.");

    return Promise.reject(err);
  }
);

export default api;
