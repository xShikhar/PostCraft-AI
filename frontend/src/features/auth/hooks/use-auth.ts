import { useState, useEffect } from "react";
import { login as apiLogin, signup as apiSignup } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { toast } from "sonner";

export function useAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("postcraft_token");
    if (saved) {
      setToken(saved);
    }
    setIsInitializing(false);

    const handleAuthExpired = () => {
      setToken(null);
      toast.error("Session expired. Please log in again.");
    };

    const handleAuthChanged = () => {
      setToken(localStorage.getItem("postcraft_token"));
    };

    window.addEventListener("auth-expired", handleAuthExpired);
    window.addEventListener("auth-changed", handleAuthChanged);
    return () => {
      window.removeEventListener("auth-expired", handleAuthExpired);
      window.removeEventListener("auth-changed", handleAuthChanged);
    };
  }, []);

  const login = async (username: string, password: string) => {
    try {
      setIsLoading(true);
      const data = await apiLogin(username, password);
      localStorage.setItem("postcraft_token", data.access_token);
      setToken(data.access_token);
      window.dispatchEvent(new Event("auth-changed"));
      toast.success("Welcome back!");
      return true;
    } catch (err: any) {
      // 429 already has a rate-limit specific message from fetchApi; surface
      // it as-is so the user understands what's happening. Other errors just
      // pass through whatever the server sent.
      const message =
        err instanceof ApiError
          ? err.message
          : err?.message || "Failed to log in";
      toast.error(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (username: string, password: string) => {
    try {
      setIsLoading(true);
      const data = await apiSignup(username, password);
      localStorage.setItem("postcraft_token", data.access_token);
      setToken(data.access_token);
      window.dispatchEvent(new Event("auth-changed"));
      toast.success("Account created successfully!");
      return true;
    } catch (err: any) {
      const message =
        err instanceof ApiError
          ? err.message
          : err?.message || "Failed to sign up";
      toast.error(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("postcraft_token");
    setToken(null);
    window.dispatchEvent(new Event("auth-changed"));
    toast("Logged out successfully");
  };

  return {
    token,
    isAuthenticated: !!token,
    isLoading,
    isInitializing,
    login,
    signup,
    logout,
  };
}
