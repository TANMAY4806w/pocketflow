"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/auth-context";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/auth");
    } else if (profile && !profile.onboarded) {
      router.replace("/onboarding");
    }
  }, [user, profile, loading, router]);

  if (loading || !user || (profile && !profile.onboarded)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-on-background">
        <div className="flex flex-col items-center gap-lg">
          <div className="relative flex items-center justify-center w-16 h-16">
            <svg className="w-full h-full animate-spin">
              <circle 
                className="text-surface-container-highest" 
                cx="32" 
                cy="32" 
                fill="transparent" 
                r="28" 
                stroke="currentColor" 
                strokeWidth="4"
              />
              <circle 
                className="text-primary" 
                cx="32" 
                cy="32" 
                fill="transparent" 
                r="28" 
                stroke="currentColor" 
                strokeDasharray="175.9" 
                strokeDashoffset="44" 
                strokeWidth="4"
              />
            </svg>
          </div>
          <p className="font-label-sm text-label-sm text-outline uppercase tracking-widest">Checking Authentication...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
