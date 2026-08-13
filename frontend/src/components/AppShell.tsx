"use client";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface AppShellProps {
  children: React.ReactNode;
  requiredRole?: "ADMIN" | "MANAGER" | "INTERN";
}

export default function AppShell({ children, requiredRole }: AppShellProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const isAuthorized = Boolean(
    user &&
    (!requiredRole ||
      user.role === requiredRole ||
      (requiredRole === "MANAGER" && user.role === "ADMIN"))
  );

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!isAuthorized) {
      const home =
        user.role === "ADMIN"
          ? "/admin/dashboard"
          : user.role === "MANAGER"
          ? "/manager/dashboard"
          : "/intern/dashboard";
      router.replace(home);
    }
  }, [user, isLoading, isAuthorized, router]);

  if (isLoading || !user || !isAuthorized) {
    return <div className="loading-overlay"><div className="spinner" /></div>;
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <Header />
        <div className="page-content">
          {children}
        </div>
      </main>
    </div>
  );
}
