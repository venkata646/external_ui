import { z } from "zod";

// Validation schemas
export const signUpSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100, "Name must be less than 100 characters"),
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters").max(256, "Password is too long"),
});

export const signInSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters").max(256, "Password is too long"),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// -----------------------------------------------------------------------------
// Logger helper (timestamp + label)
// -----------------------------------------------------------------------------
function log(label: string, data?: any) {
  const time = new Date().toISOString();
  if (data !== undefined) {
    console.log(`[${time}] [AUTH:${label}]`, data);
  } else {
    console.log(`[${time}] [AUTH:${label}]`);
  }
}

// -----------------------------------------------------------------------------
// API Calls
// -----------------------------------------------------------------------------
export const authApi = {
  async signUp(data: SignUpInput): Promise<AuthResponse> {
    log("SIGNUP_REQUEST", data);
    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Sign up failed" }));
      log("SIGNUP_ERROR", error);
      throw new Error(error.detail || "Sign up failed");
    }

    const json = await response.json();
    log("SIGNUP_SUCCESS", json);
    return json;
  },

  async signIn(data: SignInInput): Promise<AuthResponse> {
    log("SIGNIN_REQUEST", data);
    const response = await fetch(`${API_BASE_URL}/auth/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Sign in failed" }));
      log("SIGNIN_ERROR", error);
      throw new Error(error.detail || "Sign in failed");
    }

    const json = await response.json();
    log("SIGNIN_SUCCESS", json);
    return json;
  },
};

// -----------------------------------------------------------------------------
// Token & User Storage
// -----------------------------------------------------------------------------
export const tokenStorage = {
  get(): string | null {
    const token = localStorage.getItem("auth_token");
    log("TOKEN_GET", token ? "Token found" : "No token");
    return token;
  },

  set(token: string): void {
    localStorage.setItem("auth_token", token);
    log("TOKEN_SET", token);
  },

  remove(): void {
    localStorage.removeItem("auth_token");
    log("TOKEN_REMOVE");
  },

  getAuthHeader(): Record<string, string> {
    const token = this.get();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
};

export const userStorage = {
  get(): AuthUser | null {
    const user = localStorage.getItem("auth_user");
    const parsed = user ? JSON.parse(user) : null;
    log("USER_GET", parsed);
    return parsed;
  },

  set(user: AuthUser): void {
    localStorage.setItem("auth_user", JSON.stringify(user));
    log("USER_SET", user);
  },

  remove(): void {
    localStorage.removeItem("auth_user");
    log("USER_REMOVE");
  },
};

// -----------------------------------------------------------------------------
// Event Emitter
// -----------------------------------------------------------------------------
function emitAuthChanged(user: AuthUser | null) {
  log("AUTH_CHANGED_EVENT", user);
  window.dispatchEvent(new CustomEvent("auth:changed", { detail: { user } }));
}

// -----------------------------------------------------------------------------
// Auth Service
// -----------------------------------------------------------------------------
export const authService = {
  async signUp(data: SignUpInput): Promise<AuthResponse> {
    const response = await authApi.signUp(data);
    tokenStorage.set(response.token);
    userStorage.set(response.user);
    emitAuthChanged(response.user);
    log("SIGNUP_FLOW_COMPLETED", response.user);
    return response;
  },

  async signIn(data: SignInInput): Promise<AuthResponse> {
    const response = await authApi.signIn(data);
    tokenStorage.set(response.token);
    userStorage.set(response.user);
    emitAuthChanged(response.user);
    log("SIGNIN_FLOW_COMPLETED", response.user);
    return response;
  },

  signOut(): void {
    tokenStorage.remove();
    userStorage.remove();
    emitAuthChanged(null);
    log("SIGNOUT_COMPLETED");
  },

  isAuthenticated(): boolean {
    const status = !!tokenStorage.get();
    log("AUTH_STATUS", status);
    return status;
  },

  getCurrentUser(): AuthUser | null {
    const user = userStorage.get();
    log("CURRENT_USER", user);
    return user;
  },
};

// -----------------------------------------------------------------------------
// Helper
// -----------------------------------------------------------------------------
export const getCurrentUserId = (): string | null => {
  const id = userStorage.get()?.id ?? null;
  log("GET_CURRENT_USER_ID", id);
  return id;
};
