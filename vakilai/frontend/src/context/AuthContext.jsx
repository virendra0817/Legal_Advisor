import { createContext, useContext, useState, useEffect, useCallback } from "react";
import axios from "axios";

export const AuthContext = createContext(null);

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true,
});

let accessToken = null;

// Attach access token automatically
API.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Auto refresh on 401
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (
      error.response?.status === 401 &&
      !original._retry &&
      !original.url.includes("/auth/login") &&
      !original.url.includes("/auth/register") &&
      !original.url.includes("/auth/refresh")
    ) {
      original._retry = true;

      try {
        const refresh = await API.post("/auth/refresh");

        accessToken = refresh.data.accessToken;

        original.headers.Authorization = `Bearer ${accessToken}`;

        return API(original);
      } catch (err) {
        accessToken = null;
        return Promise.reject(err);
      }
    }

    return Promise.reject(error);
  }
);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const refresh = await API.post("/auth/refresh");

        accessToken = refresh.data.accessToken;

        const me = await API.get("/auth/me");

        setUser(me.data.user);
      } catch {
        accessToken = null;
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  // LOGIN
  const login = useCallback(async (email, password) => {
    try {
      const res = await API.post("/auth/login", {
        email,
        password,
      });

      accessToken = res.data.accessToken;

      setUser(res.data.user);

      return {
        success: true,
        user: res.data.user,
      };
    } catch (err) {
      return {
        success: false,
        message:
          err.response?.data?.message ||
          "Invalid email or password.",
      };
    }
  }, []);

  // REGISTER
  const register = useCallback(async (fullName, email, password) => {
    try {
      const res = await API.post("/auth/register", {
        fullName,
        email,
        password,
      });

      accessToken = res.data.accessToken;

      setUser(res.data.user);

      return {
        success: true,
        user: res.data.user,
      };
    } catch (err) {
      return {
        success: false,
        message:
          err.response?.data?.message ||
          "Registration failed.",
      };
    }
  }, []);

  // LOGOUT
  const logout = useCallback(async () => {
    try {
      await API.post("/auth/logout");
    } catch (err) {
      console.log(err);
    }

    accessToken = null;
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isLoading: loading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        api: API,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

export default AuthContext;