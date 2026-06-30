"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Global Error Boundary caught:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-on-background px-container-margin">
      <div className="bg-error-container text-on-error-container p-xl rounded-[24px] max-w-md w-full text-center space-y-md shadow-lg border border-error/20">
        <span className="material-symbols-outlined text-[64px] text-error" style={{ fontVariationSettings: "'FILL' 1" }}>
          error
        </span>
        <h2 className="font-headline-md text-headline-md font-bold">Something went wrong!</h2>
        <p className="font-body-md text-body-md opacity-90">
          An unexpected error occurred. We've logged this issue.
        </p>
        
        <div className="flex flex-col gap-sm pt-sm">
          <button
            onClick={() => reset()}
            className="w-full py-md bg-error text-on-error font-label-md text-label-md font-bold rounded-xl hover:bg-error/90 transition-colors shadow-sm cursor-pointer"
          >
            Try Again
          </button>
          <Link
            href="/dashboard"
            className="w-full py-md bg-surface text-on-surface font-label-md text-label-md font-bold rounded-xl border border-outline-variant/30 hover:bg-surface-container-low transition-colors cursor-pointer block"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
