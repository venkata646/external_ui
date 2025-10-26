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

export const authApi = {
  async signUp(data: SignUpInput): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Sign up failed" }));
      throw new Error(error.detail || "Sign up failed");
    }

    return response.json();
  },

  async signIn(data: SignInInput): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Sign in failed" }));
      throw new Error(error.detail || "Sign in failed");
    }

    return response.json();
  },
};

export const tokenStorage = {
  get(): string | null {
    return localStorage.getItem("auth_token");
  },

  set(token: string): void {
    localStorage.setItem("auth_token", token);
  },

  remove(): void {
    localStorage.removeItem("auth_token");
  },

  getAuthHeader(): Record<string, string> {
    const token = this.get();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
};

export const userStorage = {
  get(): AuthUser | null {
    const user = localStorage.getItem("auth_user");
    return user ? JSON.parse(user) : null;
  },

  set(user: AuthUser): void {
    localStorage.setItem("auth_user", JSON.stringify(user));
  },

  remove(): void {
    localStorage.removeItem("auth_user");
  },
};

export const authService = {
  async signUp(data: SignUpInput): Promise<AuthResponse> {
    const response = await authApi.signUp(data);
    tokenStorage.set(response.token);
    userStorage.set(response.user);
    return response;
  },

  async signIn(data: SignInInput): Promise<AuthResponse> {
    const response = await authApi.signIn(data);
    tokenStorage.set(response.token);
    userStorage.set(response.user);
    return response;
  },

  signOut(): void {
    tokenStorage.remove();
    userStorage.remove();
  },

  isAuthenticated(): boolean {
    return !!tokenStorage.get();
  },

  getCurrentUser(): AuthUser | null {
    return userStorage.get();
  },
};
