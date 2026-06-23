"use client";

import { useEffect, useState } from "react";

interface BudgetHealthRingProps {
  score: number; // 0 to 100
}

export function BudgetHealthRing({ score }: BudgetHealthRingProps) {
  const [offset, setOffset] = useState(251.2);
  
  useEffect(() => {
    // Total circumference is 2 * PI * R (R=40) ≈ 251.2
    const targetOffset = 251.2 * (1 - Math.max(0, Math.min(100, score)) / 100);
    const timeout = setTimeout(() => {
      setOffset(targetOffset);
    }, 300);
    
    return () => clearTimeout(timeout);
  }, [score]);

  return (
    <div className="relative flex items-center justify-center w-24 h-24">
      <svg className="w-full h-full -rotate-90">
        <circle 
          className="text-surface-variant" 
          cx="48" 
          cy="48" 
          r="40" 
          fill="transparent" 
          stroke="currentColor" 
          strokeWidth="8" 
        />
        <circle 
          className="text-primary transition-all duration-1000 ease-out" 
          cx="48" 
          cy="48" 
          r="40" 
          fill="transparent" 
          stroke="currentColor" 
          strokeWidth="8"
          strokeDasharray="251.2"
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute font-headline-md text-headline-md font-bold text-on-surface">
        {Math.round(score)}
      </span>
    </div>
  );
}
