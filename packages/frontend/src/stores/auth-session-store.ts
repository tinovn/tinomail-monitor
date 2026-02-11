import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DashboardUser } from "@tinomail/shared";
import { apiClient } from "@/lib/api-http-client";
import { socketClient } from "@/lib/socket-realtime-client";

interface AuthState {
  user: DashboardUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
}

interface AuthActions {
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshAuth: () => Promise<void>;
  setTokens: (accessToken: string, refreshToken: string) => void;
}

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      login: async (username: string, password: string) => {
        const data = await apiClient.post<{
          user: DashboardUser;
          accessToken: string;
          refreshToken: string;
        }>("/auth/login", { username, password });

        set({
          user: data.user,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          isAuthenticated: true,
        });

        apiClient.setTokens(data.accessToken, data.refreshToken);
        socketClient.connect(data.accessToken);
      },

      logout: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
        apiClient.setTokens(null, null);
        socketClient.disconnect();
        localStorage.removeItem("auth-storage");
      },

      refreshAuth: async () => {
        const { refreshToken } = get();
        if (!refreshToken) {
          throw new Error("No refresh token");
        }

        const data = await apiClient.post<{
          accessToken: string;
          refreshToken: string;
        }>("/auth/refresh", { refreshToken });

        set({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        });

        apiClient.setTokens(data.accessToken, data.refreshToken);
        socketClient.connect(data.accessToken);
      },

      setTokens: (accessToken: string, refreshToken: string) => {
        set({ accessToken, refreshToken });
        apiClient.setTokens(accessToken, refreshToken);
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.accessToken && state?.refreshToken) {
          apiClient.setTokens(state.accessToken, state.refreshToken);
          if (state.accessToken) {
            socketClient.connect(state.accessToken);
          }
        }
      },
    },
  ),
);

// Listen for auth events from API client
if (typeof window !== "undefined") {
  window.addEventListener("auth:tokens-refreshed", ((
    e: CustomEvent<{ accessToken: string; refreshToken: string }>,
  ) => {
    useAuthStore.getState().setTokens(e.detail.accessToken, e.detail.refreshToken);
  }) as EventListener);

  window.addEventListener("auth:session-expired", () => {
    useAuthStore.getState().logout();
  });
}
