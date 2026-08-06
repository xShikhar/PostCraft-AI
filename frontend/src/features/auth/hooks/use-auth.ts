import { useState, useEffect } from "react";
import { login as apiLogin, signup as apiSignup } from "@/lib/api/auth";
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

    // Listen for custom expiration event from api client
    const handleAuthExpired = () => {
      setToken(null);
      toast.error("Session expired. Please log in again.");
    };

    window.addEventListener("auth-expired", handleAuthExpired);
    return () => window.removeEventListener("auth-expired", handleAuthExpired);
  }, []);

  const login = async (username: string, password: string) => {
    try {
      setIsLoading(true);
      const data = await apiLogin(username, password);
      localStorage.setItem("postcraft_token", data.access_token);
      setToken(data.access_token);
      toast.success("Welcome back!");
      return true;
    } catch (err: any) {
      toast.error(err.message || "Failed to log in");
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
      toast.success("Account created successfully!");
      return true;
    } catch (err: any) {
      toast.error(err.message || "Failed to sign up");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("postcraft_token");
    setToken(null);
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
