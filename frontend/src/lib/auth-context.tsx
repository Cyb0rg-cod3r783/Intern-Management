"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { authApi, UserInfo } from "@/lib/api";
import { useRouter } from "next/navigation";

interface AuthContextType {
  user: UserInfo | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  completeLogin: (user: UserInfo) => void;
  logout: () => void;
  isAdmin: boolean;
  isManager: boolean;
  isIntern: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Session lives in an httpOnly cookie the browser sends automatically —
    // there's nothing in JS-readable storage to check, so we just ask the
    // backend who (if anyone) the current cookie belongs to.
    authApi.me()
      .then((u) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    setUser(res.user);
    redirectByRole(res.user.role);
  };

  /** Used by the Google OAuth callback page once the backend has already set
   * the session cookie — we just need to hydrate local state and redirect. */
  const completeLogin = (u: UserInfo) => {
    setUser(u);
    redirectByRole(u.role);
  };

  const logout = () => {
    authApi.logout().catch(() => {});
    setUser(null);
    router.push("/login");
  };

  const redirectByRole = (role: string) => {
    if (role === "ADMIN") router.push("/admin/dashboard");
    else if (role === "MANAGER") router.push("/manager/dashboard");
    else router.push("/intern/dashboard");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        completeLogin,
        logout,
        isAdmin: user?.role === "ADMIN",
        isManager: user?.role === "MANAGER",
        isIntern: user?.role === "INTERN",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
