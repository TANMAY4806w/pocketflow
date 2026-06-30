"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../context/auth-context";
import { ProtectedRoute } from "../../components/auth/protected-route";
import { BudgetService } from "../../lib/services/budget-service";
import { IncomeService } from "../../lib/services/income-service";
import { ExpenseService } from "../../lib/services/expense-service";
import { CategoryService } from "../../lib/services/category-service";
import { BudgetConfig, ExpenseLog, CategoryItem } from "../../types";
import { BudgetHealthRing } from "../../components/dashboard/BudgetHealthRing";
import { BottomNav } from "../../components/BottomNav";
import { MonthSelector } from "../../components/ui/MonthSelector";

function DashboardContent() {
  const { user, profile, logout, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Database Data States
  const [budgetConfig, setBudgetConfig] = useState<BudgetConfig | null>(null);
  const [monthlyIncome, setMonthlyIncome] = useState<number>(0);
  const [expenses, setExpenses] = useState<ExpenseLog[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [totalSpent, setTotalSpent] = useState<number>(0);

  // Modal / Add Expense Form States
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [amountInput, setAmountInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [selectedCategoryIdx, setSelectedCategoryIdx] = useState<number>(0);
  const [savingExpense, setSavingExpense] = useState(false);

  // Date setup via URL
  const monthParam = searchParams.get("m");
  const currentDate = useMemo(() => {
    if (monthParam) {
      const [y, m] = monthParam.split("-").map(Number);
      if (y && m) return new Date(y, m - 1, 1);
    }
    return new Date();
  }, [monthParam]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;

  // Load dashboard dataset
  const fetchDashboardData = async () => {
    if (authLoading) return;

    if (!user) {
      setLoading(false);
      return;
    }

    if (!profile) {
      setError("User profile could not be loaded. Please try signing out and signing in again.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const workspaceId = profile.activeWorkspaceId || user.uid;

      // 1. Load budget config (critical)
      const budget = await BudgetService.getCurrentBudget(workspaceId, monthKey);
      setBudgetConfig(budget);

      // 2. Load monthly income total (critical)
      const totalIncome = await IncomeService.getMonthlyTotalIncome(workspaceId, monthKey);
      setMonthlyIncome(totalIncome || (budget?.income || 0));

    } catch (err: any) {
      console.error("Dashboard Critical Load Error:", err);
      setError("Failed to load dashboard data. Please try again.");
    } finally {
      setLoading(false);
    }

    // Non-critical: categories, expenses (fail silently — show empty state)
    try {
      const workspaceId = profile.activeWorkspaceId || user.uid;

      // 3. Seed and Load categories
      await CategoryService.seedDefaultCategories(user.uid, workspaceId);
      const loadedCategories = await CategoryService.getCategories(workspaceId, user.uid);
      setCategories(loadedCategories);

      // 4. Monthly spending aggregate
      const aggregate = await ExpenseService.getMonthlyAggregate(workspaceId, monthKey);
      setTotalSpent(aggregate.totalSpent);

      // 5. Recent expenses list
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0, 23, 59, 59);
      const expenseResponse = await ExpenseService.getExpensesPaginated(workspaceId, startOfMonth, endOfMonth, 15);
      setExpenses(expenseResponse.logs);

    } catch (err: any) {
      // Log to console but don't break the UI — expenses just show as empty
      console.warn("Dashboard secondary data partial load error (non-critical):", err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [user, profile, authLoading]);

  // Timeout-safe loading fallback
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (loading && !authLoading) {
      timeoutId = setTimeout(() => {
        setLoading(false);
        setError("Dashboard loading timed out. Please check your internet connection.");
      }, 8000); // 8-second safety timeout
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [loading, authLoading]);

  // Handle Add Expense click
  const handleLogExpenseSubmit = async () => {
    const parsedAmount = parseFloat(amountInput);
    if (!parsedAmount || parsedAmount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }
    if (!user || !profile) return;

    setSavingExpense(true);
    try {
      const workspaceId = profile.activeWorkspaceId || user.uid;
      const targetCategory = categories[selectedCategoryIdx];

      await ExpenseService.logExpense(
        user.uid,
        workspaceId,
        parsedAmount,
        noteInput || `${targetCategory.name} expense`,
        "Main Wallet",
        targetCategory
      );

      // Reset form states
      setAmountInput("");
      setNoteInput("");
      setSelectedCategoryIdx(0);
      setShowAddExpense(false);

      // Refresh dashboard data
      await fetchDashboardData();
    } catch (err: any) {
      console.error("Expense Log Error:", err);
      alert("Failed to save expense. Please try again.");
    } finally {
      setSavingExpense(false);
    }
  };

  // Keyboard pad helpers
  const handleKeypadPress = (val: string) => {
    if (val === "C") {
      setAmountInput("");
    } else if (val === "<-") {
      setAmountInput(prev => prev.slice(0, -1));
    } else {
      // Prevent double decimals
      if (val === "." && amountInput.includes(".")) return;
      // Max 2 decimal digits limit
      if (amountInput.includes(".")) {
        const [, decimalPart] = amountInput.split(".");
        if (decimalPart && decimalPart.length >= 2) return;
      }
      setAmountInput(prev => prev + val);
    }
  };

  // Renders target caps
  const targetBudget = budgetConfig?.monthlyBudget || 0;
  const remainingBudget = Math.max(0, targetBudget - totalSpent);
  const dailyTarget = budgetConfig?.dailyTarget || 0;

  // Health Score Logic
  let healthScore = 100;
  let healthText = "Excellent";
  let healthSubtext = "You're doing great!";
  let healthColor = "bg-secondary-container text-on-secondary-container";

  if (targetBudget > 0) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const currentDay = now.getDate();
    const expectedSpend = (targetBudget / daysInMonth) * currentDay;
    const spendRatio = totalSpent / targetBudget;
    const paceRatio = expectedSpend > 0 ? totalSpent / expectedSpend : 0;

    healthScore = Math.max(0, 100 - (spendRatio * 100));

    if (spendRatio >= 1) {
      healthText = "Critical";
      healthSubtext = "Budget exceeded.";
      healthColor = "bg-error text-on-error";
    } else if (paceRatio > 1.2) {
      healthText = "Warning";
      healthSubtext = "Spending too fast.";
      healthColor = "bg-error-container text-on-error-container";
    } else if (paceRatio > 1) {
      healthText = "Fair";
      healthSubtext = "Slightly over pace.";
      healthColor = "bg-surface-container-highest text-on-surface";
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-on-background">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error && !budgetConfig) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-container-margin py-xl text-center">
        <div className="w-16 h-16 bg-error-container text-on-error-container rounded-2xl flex items-center justify-center mb-lg shadow-sm">
          <span className="material-symbols-outlined text-[32px]">error</span>
        </div>
        <h2 className="font-headline-md text-headline-md font-bold text-on-surface mb-sm">Something went wrong</h2>
        <p className="font-body-md text-body-md text-on-surface-variant w-full max-w-[320px] md:max-w-[500px] mb-lg">
          {error}
        </p>
        <div className="flex flex-col gap-sm w-full max-w-[200px]">
          <button
            onClick={() => {
              setLoading(true);
              setError(null);
              fetchDashboardData();
            }}
            className="w-full py-md bg-primary hover:bg-on-primary-container text-on-primary font-label-md text-label-md rounded-xl transition-all cursor-pointer shadow-md"
          >
            Retry Connection
          </button>
          <button
            onClick={logout}
            className="w-full py-md bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant font-label-md text-label-md rounded-xl transition-all cursor-pointer shadow-sm"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-36 overflow-x-hidden bg-background text-on-surface">
      {/* Top App Bar */}
      <header className="w-full top-0 sticky z-40 bg-surface dark:bg-on-background flex justify-between items-center px-container-margin py-md">
        <div className="flex items-center gap-sm">
          <Link href="/dashboard/settings" className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary-container cursor-pointer hover:opacity-80 transition-opacity">
            {profile?.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img 
                alt="Profile" 
                src={profile.photoURL} 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-primary text-on-primary flex items-center justify-center font-bold">
                {profile?.displayName?.charAt(0) || "U"}
              </div>
            )}
          </Link>
          <div className="flex flex-col">
            <span className="font-label-md text-label-md text-on-surface-variant">Hello, {profile?.displayName?.split(" ")[0]}</span>
            <span className="font-headline-md text-headline-md font-bold text-primary dark:text-primary-fixed-dim">{monthName} {year}</span>
          </div>
        </div>
        <Link 
          href="/dashboard/settings"
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-low transition-colors active:opacity-80 cursor-pointer"
          title="Settings"
        >
          <span className="material-symbols-outlined text-primary">settings</span>
        </Link>
      </header>

      {/* Main Grid Canvas */}
      <main className="px-container-margin space-y-lg pt-md max-w-[768px] mx-auto">
        <div className="flex justify-center w-full mb-md">
          <MonthSelector />
        </div>
        
        {error && (
          <div className="p-md bg-error-container text-on-error-container rounded-lg font-label-sm text-label-sm">
            {error}
          </div>
        )}

        {/* Large Remaining Budget Card */}
        <section className="relative overflow-hidden bg-primary p-lg rounded-[24px] shadow-lg text-on-primary">
          <div className="absolute top-0 right-0 p-lg opacity-10">
            <span className="material-symbols-outlined text-[120px]" style={{ fontVariationSettings: "'FILL' 1" }}>account_balance_wallet</span>
          </div>
          <div className="relative z-10 space-y-xs">
            <p className="font-label-md text-label-md opacity-80">Remaining Budget</p>
            <h1 className="font-display-lg text-display-lg font-extrabold tracking-tight">₹{remainingBudget.toFixed(2)}</h1>
            <div className="flex items-center gap-xs pt-sm">
              <span className="material-symbols-outlined text-[18px]">trending_down</span>
              <span className="font-label-sm text-label-sm">
                Spent ₹{totalSpent.toFixed(2)} of ₹{targetBudget.toFixed(2)}
              </span>
            </div>
          </div>
        </section>

        {/* Stats Bento Grid */}
        <div className="grid grid-cols-2 gap-gutter">
          {/* Income Logged */}
          <div className="bg-surface-container-lowest p-md rounded-[24px] shadow-[0px_4px_20px_rgba(0,0,0,0.04)] border border-outline-variant/30 flex flex-col justify-between">
            <p className="font-label-sm text-label-sm text-outline mb-xs">Income Logged</p>
            <p className="font-headline-md text-headline-md text-on-surface">₹{monthlyIncome.toFixed(2)}</p>
          </div>
          {/* Daily Target */}
          <div className="bg-surface-container-lowest p-md rounded-[24px] shadow-[0px_4px_20px_rgba(0,0,0,0.04)] border border-outline-variant/30 flex flex-col justify-between">
            <p className="font-label-sm text-label-sm text-outline mb-xs">Daily Target</p>
            <p className="font-headline-md text-headline-md text-on-surface">₹{dailyTarget.toFixed(2)}</p>
            <div className="mt-md flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-primary">On Track</span>
              <span className="material-symbols-outlined text-primary text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            </div>
          </div>
        </div>

        {/* Budget Health Score Meter */}
        <section className="bg-surface-container-lowest p-lg rounded-[24px] shadow-[0px_4px_20px_rgba(0,0,0,0.04)] flex items-center justify-between border border-outline-variant/30">
          <div className="space-y-xs">
            <h3 className="font-headline-md text-headline-md">Budget Health</h3>
            <p className="font-body-md text-body-md text-on-surface-variant">{healthSubtext}</p>
            <div className="flex items-center gap-xs mt-sm">
              <span className={`px-3 py-1 rounded-full font-label-sm text-label-sm ${healthColor}`}>{healthText}</span>
            </div>
          </div>
          <BudgetHealthRing score={healthScore} />
        </section>

        {/* Quick Actions */}
        <section className="space-y-md">
          <h3 className="font-headline-md text-headline-md">Quick Actions</h3>
          <div className="flex justify-between gap-sm">
            <button onClick={() => setShowAddExpense(true)} className="flex-1 flex flex-col items-center justify-center gap-xs p-md bg-secondary-fixed text-on-secondary-fixed-variant rounded-xl active:scale-95 transition-transform cursor-pointer">
              <span className="material-symbols-outlined">add_card</span>
              <span className="font-label-sm text-label-sm">Add Expense</span>
            </button>
            <button onClick={() => router.push("/dashboard/categories")} className="flex-1 flex flex-col items-center justify-center gap-xs p-md bg-secondary-fixed text-on-secondary-fixed-variant rounded-xl active:scale-95 transition-transform cursor-pointer">
              <span className="material-symbols-outlined">category</span>
              <span className="font-label-sm text-label-sm">Categories</span>
            </button>
            <button onClick={() => router.push("/dashboard/todos")} className="flex-1 flex flex-col items-center justify-center gap-xs p-md bg-secondary-fixed text-on-secondary-fixed-variant rounded-xl active:scale-95 transition-transform cursor-pointer">
              <span className="material-symbols-outlined">checklist</span>
              <span className="font-label-sm text-label-sm">Todos</span>
            </button>
          </div>
        </section>

        {/* Last Expenses */}
        <section className="space-y-md">
          <div className="flex items-center justify-between">
            <h3 className="font-headline-md text-headline-md">Last Expenses</h3>
            <button onClick={() => router.push("/expenses")} className="text-primary font-label-md text-label-md hover:underline cursor-pointer">View all</button>
          </div>
          
          <div className="bg-surface-container-lowest rounded-[24px] shadow-[0px_4px_20px_rgba(0,0,0,0.04)] divide-y divide-outline-variant/10 overflow-hidden border border-outline-variant/30">
            {expenses.length === 0 ? (
              <div className="p-xl text-center bg-surface-container-low/40">
                <span className="material-symbols-outlined text-[48px] text-outline mb-sm">receipt_long</span>
                <h4 className="font-headline-md text-headline-md font-bold text-on-surface mb-xs">No expenses yet</h4>
                <p className="font-body-md text-body-md text-on-surface-variant w-full max-w-[320px] md:max-w-[500px] mx-auto">Tap "Add Expense" above to log your first transaction.</p>
              </div>
            ) : (
              expenses.map((expense) => (
                <div key={expense.id} className="flex items-center gap-md p-md hover:bg-surface-container-low transition-colors">
                  <div 
                    className="w-12 h-12 bg-surface-container-high rounded-full flex items-center justify-center"
                    style={{ backgroundColor: expense.category.color, color: "#fff" }}
                  >
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>{expense.category.icon}</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-label-md text-label-md text-on-surface font-bold">{expense.note}</p>
                    <p className="font-label-sm text-label-sm text-outline">{expense.category.name} • {new Date(expense.expenseDate).toLocaleDateString()}</p>
                  </div>
                  <p className="font-label-md text-label-md text-error">-₹{expense.amount.toFixed(2)}</p>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Insight Card */}
        <section className="bg-secondary-container/30 border border-secondary-container p-lg rounded-[24px] flex gap-md">
          <div className="w-12 h-12 shrink-0 bg-primary rounded-2xl flex items-center justify-center text-on-primary">
            <span className="material-symbols-outlined">lightbulb</span>
          </div>
          <div className="space-y-xs">
            <h4 className="font-label-md text-label-md text-on-secondary-container font-bold">Smart Saving Tip</h4>
            <p className="font-body-md text-body-md text-on-secondary-container/80">Switching to a generic brand for your weekly coffee beans could save you <span className="font-bold">₹40.00</span> this month.</p>
          </div>
        </section>
      </main>

      {/* FAB */}
      <button 
        onClick={() => setShowAddExpense(true)}
        className="fixed bottom-24 right-container-margin w-16 h-16 bg-primary-container text-on-primary-container rounded-full shadow-lg flex items-center justify-center z-[60] hover:scale-110 active:scale-95 transition-all cursor-pointer"
      >
        <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: "'wght' 600" }}>add</span>
      </button>

      {/* Bottom Navigation */}
      <BottomNav />

      {/* Add Expense Slide-Up Modal Overlay */}
      {showAddExpense && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-[448px] md:max-w-[600px] bg-surface rounded-t-[32px] md:rounded-[32px] md:mb-[10vh] p-lg shadow-2xl flex flex-col gap-md max-h-[90vh] overflow-y-auto border-t border-outline-variant/20 animate-slide-up">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-outline-variant/15 pb-sm">
              <h2 className="font-headline-md text-headline-md font-bold">Log New Expense</h2>
              <button 
                onClick={() => setShowAddExpense(false)}
                className="w-8 h-8 rounded-full bg-surface-container-low flex items-center justify-center text-outline cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Recessed Value Display Box */}
            <div className="recessed-input rounded-2xl p-md text-center border border-transparent focus-within:border-primary">
              <span className="font-label-sm text-label-sm text-outline block uppercase tracking-wider mb-xs">Expense Amount</span>
              <div className="flex items-center justify-center">
                <span className="font-display-lg text-display-lg text-primary font-bold mr-xs">₹</span>
                <span className="font-display-lg text-display-lg text-on-surface font-extrabold min-h-[56px] flex items-center">
                  {amountInput || "0.00"}
                </span>
              </div>
            </div>

            {/* Custom Notes text entry */}
            <input 
              type="text" 
              placeholder="Add a note (e.g. Starbucks coffee)" 
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary-container"
            />

            {/* Horizontal scrollable Category selector */}
            <div className="space-y-xs">
              <span className="font-label-sm text-label-sm text-outline block uppercase tracking-wider">Select Category</span>
              <div className="flex gap-sm overflow-x-auto py-xs scrollbar-none">
                {categories.map((cat, idx) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategoryIdx(idx)}
                    className={`flex-shrink-0 px-4 py-2.5 rounded-full flex items-center gap-xs font-label-sm text-label-sm border cursor-pointer active:scale-95 transition-all ${
                      selectedCategoryIdx === idx 
                        ? "border-primary bg-secondary-container/40 text-primary font-semibold"
                        : "border-outline-variant/40 text-on-surface-variant bg-surface-container-lowest"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]" style={{ color: cat.color }}>{cat.icon}</span>
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Keypad Grid layout */}
            <div className="grid grid-cols-3 gap-sm my-xs w-full max-w-[384px] md:max-w-full mx-auto">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "C"].map((key) => (
                <button
                  key={key}
                  onClick={() => handleKeypadPress(key)}
                  className="h-12 bg-surface-container-low text-on-surface font-headline-md text-headline-md rounded-xl flex items-center justify-center hover:bg-surface-container-high active:scale-95 transition-all cursor-pointer font-bold"
                >
                  {key}
                </button>
              ))}
            </div>

            {/* Submit CTA */}
            <button 
              disabled={savingExpense || !amountInput || parseFloat(amountInput) <= 0}
              onClick={handleLogExpenseSubmit}
              className="w-full py-md bg-primary hover:bg-on-primary-container text-on-primary font-headline-md text-headline-md rounded-[16px] transition-all flex items-center justify-center gap-sm cursor-pointer shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingExpense ? (
                <div className="w-6 h-6 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span className="material-symbols-outlined">check</span>
                  Log Expense
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Ambient background textures */}
      <div className="fixed inset-0 -z-10 pointer-events-none opacity-40 overflow-hidden">
        <div className="absolute top-0 right-[-10%] w-96 h-96 bg-primary/5 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[20%] left-[-10%] w-[500px] h-[500px] bg-secondary-container/10 rounded-full blur-[120px]"></div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center">Loading Dashboard...</div>}>
        <DashboardContent />
      </Suspense>
    </ProtectedRoute>
  );
}
