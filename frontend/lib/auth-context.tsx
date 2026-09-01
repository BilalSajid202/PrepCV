"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { apiRequest, AuthResponse, User } from "./api";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (full_name: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const isAdmin = user?.role === "admin";

  const checkAuth = async () => {
    try {
      const userData = await apiRequest<User>("/auth/me");
      setUser(userData);
    } catch {
      setUser(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem("prepcv_token");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    const data = await apiRequest<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (typeof window !== "undefined") {
      localStorage.setItem("prepcv_token", data.access_token);
    }
    setUser(data.user);
    return data.user;
  };

  const register = async (
    full_name: string,
    email: string,
    password: string
  ): Promise<User> => {
    const data = await apiRequest<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ full_name, email, password }),
    });

    if (typeof window !== "undefined") {
      localStorage.setItem("prepcv_token", data.access_token);
    }
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try {
      await apiRequest<{ message: string }>("/auth/logout", {
        method: "POST",
      });
    } catch {
      // Ignore logout request failure
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem("prepcv_token");
      }
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
