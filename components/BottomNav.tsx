"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { name: "Home", href: "/dashboard", icon: "home" },
    { name: "Expenses", href: "/expenses", icon: "account_balance_wallet" },
    { name: "Todos", href: "/dashboard/todos", icon: "checklist" },
    { name: "Analytics", href: "/dashboard/analytics", icon: "insert_chart" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 bg-surface dark:bg-inverse-surface shadow-[0px_-4px_20px_rgba(0,0,0,0.04)] rounded-t-xl px-4 py-sm pb-[max(8px,env(safe-area-inset-bottom))] flex justify-around items-center">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.name}
            href={item.href}
            className={`flex flex-col items-center justify-center rounded-full px-4 py-1 transition-transform active:scale-90 ${
              isActive
                ? "bg-secondary-container dark:bg-secondary text-on-secondary-container dark:text-on-secondary"
                : "text-on-surface-variant dark:text-outline hover:text-primary"
            }`}
          >
            <span
              className="material-symbols-outlined"
              style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
            >
              {item.icon}
            </span>
            <span className="font-label-sm text-label-sm">{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
