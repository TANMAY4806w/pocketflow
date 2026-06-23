"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/auth-context";

export default function AuthPage() {
  const { user, profile, login, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // If user is already logged in, redirect them away from auth page
    if (!authLoading && user) {
      if (profile && !profile.onboarded) {
        router.replace("/onboarding");
      } else {
        router.replace("/dashboard");
      }
    }
  }, [user, profile, authLoading, router]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const userProfile = await login();
      if (!userProfile.onboarded) {
        router.push("/onboarding");
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      console.error("Authentication Error:", err);
      // Friendly messages for Firebase errors
      if (err.code === "auth/popup-closed-by-user") {
        setError("Sign-in window closed. Please try again.");
      } else if (err.code === "auth/network-request-failed") {
        setError("Network error. Please check your internet connection.");
      } else {
        setError(err.message || "An unexpected authentication error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex-grow flex flex-col items-center justify-center px-container-margin py-xl max-w-[1140px] mx-auto w-full min-h-screen">
      
      {/* Header Section */}
      <div className="w-full text-center mb-lg">
        <h1 className="font-display-lg text-display-lg text-on-surface mb-xs font-bold">Welcome</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant">Your journey to financial clarity starts here.</p>
      </div>

      {/* Illustration Component */}
      <div className="relative w-full aspect-square max-w-[320px] mb-xl flex items-center justify-center">
        <div className="absolute inset-0 bg-secondary-container opacity-20 rounded-full scale-90 blur-3xl"></div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img 
          alt="Digital management illustration" 
          className="relative z-10 w-full h-full object-contain" 
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuCr-nBP8pJPXTJrv7VDt9xyV_sSFVyoeJ0RpkRkt8VQXlWpS9Y56aiRXVRCNmQ-PB7A1WLsOdzhZm03_6juirOjvL_L-BRon7kX4cL_stkcJNgMtpTcwWaW-esX5Z95RPPH2A_YzOGS2dBBzIDAeMhIn-1QUwje7YUtD1QAVGV4pdGt2Px-vXPWgYvD58s6nxKml0HR0k9am4cMwuRs04QLPqYgTTegg8h7LFJquwzLpWShJ1DivRWKin12Hm-KPcqQUMFGT7gTAZY"
        />
      </div>

      {/* Error Alert Box */}
      {error && (
        <div className="w-full max-w-[360px] p-md bg-error-container text-on-error-container rounded-lg font-label-sm text-label-sm mb-md flex items-center gap-sm">
          <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Action Section */}
      <div className="w-full max-w-[360px] flex flex-col gap-md">
        
        {/* Primary Google Auth Button */}
        <button 
          disabled={loading || authLoading}
          onClick={handleGoogleSignIn}
          className="w-full h-[56px] bg-primary text-on-primary font-label-md text-label-md rounded-[16px] flex items-center justify-center gap-md active:scale-95 transition-all shadow-lg hover:bg-on-primary-container disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
        >
          {loading || authLoading ? (
            <div className="w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="currentColor"></path>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="currentColor"></path>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="currentColor"></path>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="currentColor"></path>
            </svg>
          )}
          <span>{loading || authLoading ? "Signing in..." : "Continue with Google"}</span>
        </button>

        {/* Disabled Placeholder Secondary Button */}
        <button 
          disabled
          className="w-full h-[56px] bg-surface-container-high text-outline font-label-md text-label-md rounded-[16px] flex items-center justify-center opacity-60 cursor-not-allowed"
        >
          Use email instead
        </button>
      </div>

      {/* Footer / PWA Hint */}
      <footer className="mt-xl flex flex-col items-center gap-xs">
        <div className="flex items-center gap-xs text-on-surface-variant opacity-80">
          <span className="material-symbols-outlined text-[18px]">add_to_home_screen</span>
          <p className="font-label-sm text-label-sm">Add PocketFlow to home screen</p>
        </div>
        <p className="font-label-sm text-label-sm text-outline mt-md">
          By continuing, you agree to our <a className="text-primary underline decoration-primary-container" href="#">Terms of Service</a>
        </p>
      </footer>
    </main>
  );
}
