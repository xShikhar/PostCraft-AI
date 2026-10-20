import { useState, useSyncExternalStore } from "react";
import { login as apiLogin, signup as apiSignup } from "@/lib/api/auth";
import { ApiError, getAuthToken, clearAuth } from "@/lib/api/client";
import { toast } from "sonner";
import { useMounted } from "@/lib/use-mounted";
import { enterStudio } from "@/components/motion/studio-entry";

function subscribeAuth(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("auth-changed", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("auth-changed", callback);
  };
}

function getAuthSnapshot() {
  return getAuthToken();
}

function getAuthServerSnapshot() {
  return null;
}

export function useAuth() {
  const token = useSyncExternalStore(subscribeAuth, getAuthSnapshot, getAuthServerSnapshot);
  const isMounted = useMounted();
  const [isLoading, setIsLoading] = useState(false);

  const login = async (username: string, password: string, rememberMe = false) => {
    try {
      setIsLoading(true);
      const data = await apiLogin(username, password, rememberMe);
      await enterStudio(() => {
        clearAuth();
        (rememberMe ? localStorage : sessionStorage).setItem("postcraft_token", data.access_token);
        window.dispatchEvent(new Event("auth-changed"));
      });
      toast.success("Welcome back!");
      return true;
    } catch (err: unknown) {
      // 429 already has a rate-limit specific message from fetchApi; surface
      // it as-is so the user understands what's happening. Other errors just
      // pass through whatever the server sent.
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to log in";
      toast.error(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (username: string, password: string, rememberMe = false) => {
    try {
      setIsLoading(true);
      const data = await apiSignup(username, password, rememberMe);
      await enterStudio(() => {
        clearAuth();
        (rememberMe ? localStorage : sessionStorage).setItem("postcraft_token", data.access_token);
        window.dispatchEvent(new Event("auth-changed"));
      });
      toast.success("Account created successfully!");
      return true;
    } catch (err: unknown) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to sign up";
      toast.error(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    clearAuth();
    toast("Logged out successfully");
  };

  return {
    token,
    isAuthenticated: !!token,
    isLoading,
    isInitializing: !isMounted,
    login,
    signup,
    logout,
  };
}
