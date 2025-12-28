"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppKitAccount } from "@reown/appkit/react";

type AuthStatus =
  | "checking"
  | "unauthenticated"
  | "authenticating"
  | "authenticated"
  | "error";

interface AuthUser {
  id: string;
  walletAddress: string;
}

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  error?: string | null;
}

const initialState: AuthState = {
  status: "checking",
  user: null,
  error: null,
};

export function useWalletAuth() {
  const { address, isConnected } = useAppKitAccount();
  const [state, setState] = useState<AuthState>(initialState);
  const clearedServerSessionOnDisconnectRef = useRef(false);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session", {
        cache: "no-store",
        credentials: "same-origin",
      });

      if (!res.ok) {
        setState({ status: "unauthenticated", user: null });
        return;
      }

      const data = (await res.json()) as {
        authenticated: boolean;
        user?: AuthUser;
      };

      if (data.authenticated && data.user) {
        setState({ status: "authenticated", user: data.user });
      } else {
        setState({ status: "unauthenticated", user: null });
      }
    } catch (error) {
      console.error("Failed to fetch auth session", error);
      setState({
        status: "error",
        user: null,
        error: "Failed to load session",
      });
    }
  }, []);

  useEffect(() => {
    void fetchSession();
  }, [fetchSession]);

  const authenticate = useCallback(async () => {
    if (!isConnected || !address) {
      setState({ status: "unauthenticated", user: null });
      return;
    }

    try {
      setState((prev) => ({ ...prev, status: "authenticating", error: null }));

      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ walletAddress: address }),
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(errorBody.error || "Failed to create session");
      }

      const data = (await res.json()) as {
        ok: boolean;
        user: AuthUser;
      };

      if (!data.ok || !data.user) {
        throw new Error("Failed to create session");
      }

      setState({ status: "authenticated", user: data.user });
    } catch (error) {
      console.error("Authentication failed", error);
      setState({
        status: "error",
        user: null,
        error: error instanceof Error ? error.message : "Authentication failed",
      });
    }
  }, [address, isConnected]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } catch (error) {
      console.error("Failed to logout", error);
    } finally {
      setState({ status: "unauthenticated", user: null });
    }
  }, []);

  useEffect(() => {
    if (!isConnected || !address) {
      // Ensure we never end up in "authenticated" with a null user.
      setState({ status: "unauthenticated", user: null, error: null });

      // Best-effort: clear the server JWT cookie once per disconnect.
      if (!clearedServerSessionOnDisconnectRef.current) {
        clearedServerSessionOnDisconnectRef.current = true;
        void fetch("/api/auth/logout", {
          method: "POST",
          credentials: "same-origin",
        }).catch(() => {});
      }
      return;
    }

    clearedServerSessionOnDisconnectRef.current = false;

    // Wait until initial session check completes
    if (state.status === "checking") return;

    // If already authenticated with this wallet, no need to re-authenticate
    if (
      state.status === "authenticated" &&
      state.user?.walletAddress === address
    ) {
      return;
    }

    // If not authenticated but connected, create session
    if (state.status === "unauthenticated") {
      void authenticate();
    }
  }, [
    isConnected,
    address,
    authenticate,
    state.status,
    state.user?.walletAddress,
  ]);

  return useMemo(
    () => ({
      status: state.status,
      user: state.user,
      error: state.error,
      isAuthenticated: state.status === "authenticated",
      authenticate,
      logout,
      refresh: fetchSession,
    }),
    [state, authenticate, logout, fetchSession]
  );
}

