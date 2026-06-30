"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useMemo } from "react";

export function MonthSelector() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const monthParam = searchParams.get("m");
  
  // Calculate current Date object from the param or fallback to current month
  const currentDate = useMemo(() => {
    if (monthParam) {
      const [year, month] = monthParam.split("-").map(Number);
      if (year && month) {
        return new Date(year, month - 1, 1);
      }
    }
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }, [monthParam]);

  const monthName = currentDate.toLocaleString("default", { month: "long" });
  const year = currentDate.getFullYear();

  const handlePrevMonth = () => {
    const prev = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    const mKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
    
    const params = new URLSearchParams(searchParams);
    params.set("m", mKey);
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleNextMonth = () => {
    const next = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    const mKey = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
    
    const params = new URLSearchParams(searchParams);
    params.set("m", mKey);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex items-center justify-between bg-surface-container-low rounded-xl px-sm py-xs border border-outline-variant/30 shadow-sm w-full max-w-[240px]">
      <button 
        onClick={handlePrevMonth}
        className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer"
        title="Previous Month"
      >
        <span className="material-symbols-outlined text-[20px]">chevron_left</span>
      </button>
      
      <div className="flex flex-col items-center">
        <span className="font-label-md text-label-md font-bold text-primary">{monthName}</span>
        <span className="font-label-sm text-label-sm text-outline-variant">{year}</span>
      </div>

      <button 
        onClick={handleNextMonth}
        className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer"
        title="Next Month"
      >
        <span className="material-symbols-outlined text-[20px]">chevron_right</span>
      </button>
    </div>
  );
}
