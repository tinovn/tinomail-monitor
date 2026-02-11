import type { ApiResponse, ApiError } from "@tinomail/shared";

/** API client error */
export class ApiClientError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

/** HTTP client for API requests */
class ApiHttpClient {
  private baseUrl = "/api/v1";
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private isRefreshing = false;
  private refreshPromise: Promise<void> | null = null;

  setTokens(access: string | null, refresh: string | null) {
    this.accessToken = access;
    this.refreshToken = refresh;
  }

  private async refreshAuth(): Promise<void> {
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = (async () => {
      try {
        if (!this.refreshToken) {
          throw new ApiClientError("No refresh token", "NO_REFRESH_TOKEN");
        }

        const response = await fetch(`${this.baseUrl}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: this.refreshToken }),
        });

        if (!response.ok) {
          throw new ApiClientError("Token refresh failed", "REFRESH_FAILED");
        }

        const data: ApiResponse<{
          accessToken: string;
          refreshToken: string;
        }> = await response.json();
        this.setTokens(data.data.accessToken, data.data.refreshToken);

        // Notify auth store about new tokens
        window.dispatchEvent(
          new CustomEvent("auth:tokens-refreshed", {
            detail: {
              accessToken: data.data.accessToken,
              refreshToken: data.data.refreshToken,
            },
          }),
        );
      } finally {
        this.isRefreshing = false;
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers as Record<string, string>),
    };

    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    let response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    // Auto-refresh on 401
    if (response.status === 401 && !options.signal?.aborted) {
      try {
        await this.refreshAuth();
        // Retry request with new token
        const retryHeaders: Record<string, string> = { ...headers };
        if (this.accessToken) {
          retryHeaders.Authorization = `Bearer ${this.accessToken}`;
        }
        response = await fetch(`${this.baseUrl}${path}`, {
          ...options,
          headers: retryHeaders,
        });
      } catch (error) {
        // Refresh failed, notify logout
        window.dispatchEvent(new CustomEvent("auth:session-expired"));
        throw error;
      }
    }

    const data = (await response.json()) as ApiResponse<T> | ApiError;

    if (!data.success) {
      throw new ApiClientError(
        data.error.message,
        data.error.code,
        data.error.details,
      );
    }

    return data.data;
  }

  async get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    const query = params
      ? `?${new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v !== undefined && v !== null)
            .map(([k, v]) => [k, String(v)]),
        )}`
      : "";
    return this.request<T>(`${path}${query}`, { method: "GET" });
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async del<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "DELETE" });
  }
}

export const apiClient = new ApiHttpClient();
