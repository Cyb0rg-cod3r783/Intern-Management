"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";

export default function ManagerAllInternsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/manager/my-interns");
  }, [router]);

  return (
    <AppShell requiredRole="MANAGER">
      <div className="loading-overlay">
        <div className="spinner" />
      </div>
    </AppShell>
  );
}
