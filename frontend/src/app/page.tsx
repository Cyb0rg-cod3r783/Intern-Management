"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function HomePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
    } else if (user.role === "ADMIN") {
      router.replace("/admin/dashboard");
    } else if (user.role === "MANAGER") {
      router.replace("/manager/dashboard");
    } else {
      router.replace("/intern/dashboard");
    }
  }, [user, isLoading, router]);

  return (
    <div className="loading-overlay">
      <div className="spinner" />
    </div>
  );
}
