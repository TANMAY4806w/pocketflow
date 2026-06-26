"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/auth-context";
import { BudgetService } from "../../lib/services/budget-service";
import { IncomeService } from "../../lib/services/income-service";
import { FixedExpense } from "../../types";

export default function OnboardingPage() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const router = useRouter();

  // Onboarding Steps State
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form inputs
  const [incomeType, setIncomeType] = useState<"Student" | "Intern" | "Salaried" | "Freelancer" | null>(null);
  const [income, setIncome] = useState<string>("");
  const [monthlyBudget, setMonthlyBudget] = useState<string>("");
  
  // Fixed expenses
  const [fixedExpenses, setFixedExpenses] = useState<Array<{ category: string; amount: string; isPaid: boolean }>>([
    { category: "Rent", amount: "", isPaid: false },
    { category: "Food", amount: "", isPaid: false },
    { category: "Travel", amount: "", isPaid: false },
    { category: "Other", amount: "", isPaid: false },
  ]);

  // Custom expense entry state
  const [customCategory, setCustomCategory] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Time metrics
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const daysInMonth = new Date(year, month, 0).getDate();

  useEffect(() => {
    // If not authenticated, redirect to login
    if (!authLoading && !user) {
      router.replace("/auth");
    }
    // If already onboarded, redirect to dashboard
    if (!authLoading && profile?.onboarded) {
      router.replace("/dashboard");
    }
  }, [user, profile, authLoading, router]);

  // Form Validation & Calculations
  const numericIncome = parseFloat(income) || 0;
  const numericBudget = parseFloat(monthlyBudget) || 0;

  const totalFixedExpenses = fixedExpenses.reduce((acc, curr) => {
    return acc + (parseFloat(curr.amount) || 0);
  }, 0);

  const remainingBudget = Math.max(0, numericBudget - totalFixedExpenses);
  const suggestedDailyTarget = remainingBudget / daysInMonth;
  const suggestedWeeklyTarget = suggestedDailyTarget * 7;

  // Handle Onboarding Completion (Step 5 submit)
  const handleCompleteSetup = async () => {
    if (!user || !profile) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Convert fixed expenses to final schema formats
      const cleanFixedExpenses: FixedExpense[] = fixedExpenses
        .filter(exp => (parseFloat(exp.amount) || 0) > 0)
        .map(exp => ({
          category: exp.category,
          amount: parseFloat(exp.amount) || 0,
          isPaid: exp.isPaid
        }));

      const workspaceId = profile.activeWorkspaceId || user.uid;

      // 2. Add the IncomeRecord to Firestore
      await IncomeService.addIncomeRecord(
        user.uid,
        workspaceId,
        numericIncome,
        incomeType || "Other",
        monthKey
      );

      // 3. Save BudgetConfig and mark UserProfile onboarded
      await BudgetService.completeOnboarding(
        user.uid,
        workspaceId,
        monthKey,
        numericIncome,
        numericBudget,
        cleanFixedExpenses
      );

      // 4. Force auth-context to refresh profile settings
      await refreshProfile();

      // 5. Navigate to Dashboard
      router.push("/dashboard");
    } catch (err: any) {
      console.error("Onboarding Persistence Error:", err);
      setError(err.message || "Failed to save configuration. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Add Custom Expense handler
  const handleAddCustomExpense = () => {
    if (!customCategory || !customAmount) return;
    setFixedExpenses([
      ...fixedExpenses,
      { category: customCategory, amount: customAmount, isPaid: false }
    ]);
    setCustomCategory("");
    setCustomAmount("");
    setShowCustomInput(false);
  };

  // Progress Bar Helper
  const progressPercentage = (step / 5) * 100;

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col font-body-md overflow-x-hidden relative bg-background text-on-background">
      
      {/* Top Header Progress Indicator */}
      <header className="w-full fixed top-0 z-50 px-container-margin py-md flex items-center justify-center bg-surface/80 backdrop-blur-md">
        <div className="w-full max-w-[448px] md:max-w-[600px]">
          <div className="flex justify-between items-center mb-xs">
            <span className="font-label-md text-label-md text-primary uppercase tracking-widest font-bold">Step {step} of 5</span>
            <span className="font-label-md text-label-md text-outline font-semibold">{Math.round(progressPercentage)}%</span>
          </div>
          <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-500 ease-out" 
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-grow flex items-center justify-center pt-24 px-container-margin pb-xl z-10 w-full max-w-[448px] md:max-w-[600px] lg:max-w-[800px] mx-auto">
        <div className="w-full relative min-h-[500px]">

          {/* Error Alert Message */}
          {error && (
            <div className="w-full p-md bg-error-container text-on-error-container rounded-lg font-label-sm text-label-sm mb-md flex items-center gap-sm shadow-sm">
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: INCOME TYPE */}
          {step === 1 && (
            <section className="flex flex-col h-full space-y-md">
              <div className="bg-surface-container-lowest rounded-[24px] p-lg shadow-[0px_4px_20px_rgba(0,0,0,0.04)] border border-outline-variant/30 flex-grow flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 bg-secondary-container rounded-xl flex items-center justify-center mb-md">
                    <span className="material-symbols-outlined text-primary text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
                  </div>
                  <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface mb-sm font-bold">What is your income type?</h1>
                  <p className="font-body-md text-body-md text-on-surface-variant">We tailor your budgeting advice based on your occupational category.</p>
                </div>
                
                <div className="grid grid-cols-2 gap-sm my-lg">
                  {[
                    { id: "Student", label: "Student", icon: "school" },
                    { id: "Intern", label: "Intern", icon: "badge" },
                    { id: "Salaried", label: "Salaried", icon: "work" },
                    { id: "Freelancer", label: "Freelancer", icon: "payments" }
                  ].map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setIncomeType(type.id as any)}
                      className={`p-md rounded-2xl border flex flex-col items-center justify-center gap-xs cursor-pointer active:scale-95 transition-all ${
                        incomeType === type.id 
                          ? "border-primary bg-secondary-container/40 text-primary font-bold shadow-sm" 
                          : "border-outline-variant/50 hover:border-primary/50 text-on-surface-variant"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[32px]">{type.icon}</span>
                      <span className="font-label-sm text-label-sm">{type.label}</span>
                    </button>
                  ))}
                </div>

                <button
                  disabled={!incomeType}
                  onClick={() => setStep(2)}
                  className="w-full py-md bg-primary hover:bg-on-primary-container text-on-primary font-headline-md text-headline-md rounded-[16px] transition-all flex items-center justify-center gap-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-lg"
                >
                  Continue
                  <span className="material-symbols-outlined">arrow_forward</span>
                </button>
              </div>
            </section>
          )}

          {/* STEP 2: MONTHLY INCOME */}
          {step === 2 && (
            <section className="flex flex-col h-full space-y-md">
              <div className="bg-surface-container-lowest rounded-[24px] p-lg shadow-[0px_4px_20px_rgba(0,0,0,0.04)] border border-outline-variant/30 flex-grow flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 bg-secondary-container rounded-xl flex items-center justify-center mb-md">
                    <span className="material-symbols-outlined text-primary text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>payments</span>
                  </div>
                  <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface mb-sm font-bold">What's your monthly income?</h1>
                  <p className="font-body-md text-body-md text-on-surface-variant">Tell us how much you take home each month to start your budget.</p>
                </div>

                <div className="my-lg">
                  <div className="recessed-input rounded-2xl p-lg border border-transparent focus-within:border-primary focus-within:ring-2 focus-within:ring-primary-container/20">
                    <label className="font-label-sm text-label-sm text-outline uppercase mb-xs block">Estimated Net Income</label>
                    <div className="flex items-center">
                      <span className="font-display-lg text-display-lg text-primary mr-xs font-bold">$</span>
                      <input 
                        autoFocus
                        type="number"
                        placeholder="0.00"
                        value={income}
                        onChange={(e) => setIncome(e.target.value)}
                        className="w-full bg-transparent border-none focus:outline-none focus:ring-0 font-display-lg text-display-lg text-on-surface p-0 placeholder:text-surface-container-highest font-bold"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-md">
                  <button 
                    onClick={() => setStep(1)}
                    className="flex-shrink-0 w-14 h-14 bg-surface-container-high text-on-surface-variant rounded-[16px] hover:bg-surface-container-highest transition-colors flex items-center justify-center cursor-pointer"
                  >
                    <span className="material-symbols-outlined">arrow_back</span>
                  </button>
                  <button
                    disabled={!income || numericIncome <= 0}
                    onClick={() => setStep(3)}
                    className="flex-grow py-md bg-primary hover:bg-on-primary-container text-on-primary font-headline-md text-headline-md rounded-[16px] transition-all flex items-center justify-center gap-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-lg"
                  >
                    Next
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* STEP 3: MONTHLY BUDGET */}
          {step === 3 && (
            <section className="flex flex-col h-full space-y-md">
              <div className="bg-surface-container-lowest rounded-[24px] p-lg shadow-[0px_4px_20px_rgba(0,0,0,0.04)] border border-outline-variant/30 flex-grow flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 bg-secondary-container rounded-xl flex items-center justify-center mb-md">
                    <span className="material-symbols-outlined text-primary text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>track_changes</span>
                  </div>
                  <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface mb-sm font-bold">Set your monthly budget</h1>
                  <p className="font-body-md text-body-md text-on-surface-variant">How much do you want to spend this month? We'll help you stay under this cap.</p>
                </div>

                <div className="my-md">
                  <div className="recessed-input rounded-2xl p-lg border border-transparent focus-within:border-primary focus-within:ring-2 focus-within:ring-primary-container/20">
                    <label className="font-label-sm text-label-sm text-outline uppercase mb-xs block">Target Monthly Budget</label>
                    <div className="flex items-center">
                      <span className="font-display-lg text-display-lg text-primary mr-xs font-bold">$</span>
                      <input 
                        autoFocus
                        type="number"
                        placeholder="0.00"
                        value={monthlyBudget}
                        onChange={(e) => setMonthlyBudget(e.target.value)}
                        className="w-full bg-transparent border-none focus:outline-none focus:ring-0 font-display-lg text-display-lg text-on-surface p-0 placeholder:text-surface-container-highest font-bold"
                      />
                    </div>
                  </div>
                  
                  {/* Smart Recommendation Info Box */}
                  <div className="mt-md p-md bg-surface-container-low rounded-xl flex items-start gap-md border border-outline-variant/20">
                    <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
                    <p className="font-label-md text-label-md text-on-surface-variant">
                      Recommended: <span className="font-bold text-primary">${Math.round(numericIncome * 0.8)}</span> (saving 20% of your income).
                    </p>
                  </div>
                </div>

                <div className="flex gap-md">
                  <button 
                    onClick={() => setStep(2)}
                    className="flex-shrink-0 w-14 h-14 bg-surface-container-high text-on-surface-variant rounded-[16px] hover:bg-surface-container-highest transition-colors flex items-center justify-center cursor-pointer"
                  >
                    <span className="material-symbols-outlined">arrow_back</span>
                  </button>
                  <button
                    disabled={!monthlyBudget || numericBudget <= 0 || numericBudget > numericIncome}
                    onClick={() => setStep(4)}
                    className="flex-grow py-md bg-primary hover:bg-on-primary-container text-on-primary font-headline-md text-headline-md rounded-[16px] transition-all flex items-center justify-center gap-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-lg"
                  >
                    Next
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* STEP 4: FIXED EXPENSES */}
          {step === 4 && (
            <section className="flex flex-col h-full space-y-md">
              <div className="bg-surface-container-lowest rounded-[24px] p-lg shadow-[0px_4px_20px_rgba(0,0,0,0.04)] border border-outline-variant/30 flex-grow flex flex-col justify-between">
                <div>
                  <div className="text-center mb-md">
                    <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface mb-xs font-bold">Fixed Expenses</h1>
                    <p className="font-body-md text-body-md text-on-surface-variant">Log bills that repeat every month to isolate your daily allowance.</p>
                  </div>

                  {/* Expenses List */}
                  <div className="space-y-sm max-h-[300px] overflow-y-auto pr-xs">
                    {fixedExpenses.map((expense, idx) => (
                      <div key={idx} className="glass-card p-md rounded-xl border border-outline-variant/30 flex items-center justify-between">
                        <div className="flex items-center gap-sm">
                          <div className="w-10 h-10 rounded-lg bg-secondary-container/40 flex items-center justify-center text-primary">
                            <span className="material-symbols-outlined">
                              {expense.category === "Rent" ? "home" : 
                               expense.category === "Food" ? "restaurant" : 
                               expense.category === "Travel" ? "commute" : 
                               expense.category === "Other" ? "pending_actions" : "star"}
                            </span>
                          </div>
                          <span className="font-label-md text-label-md font-semibold text-on-surface">{expense.category}</span>
                        </div>
                        <div className="flex items-center gap-xs">
                          <span className="text-outline font-semibold">$</span>
                          <input 
                            type="number"
                            placeholder="0.00"
                            value={expense.amount}
                            onChange={(e) => {
                              const updated = [...fixedExpenses];
                              updated[idx].amount = e.target.value;
                              setFixedExpenses(updated);
                            }}
                            className="w-20 bg-surface-container-low border-none rounded-lg px-2 py-1 font-body-md text-body-md text-right focus:outline-none focus:ring-2 focus:ring-primary-container"
                          />
                        </div>
                      </div>
                    ))}

                    {/* Custom Input Block */}
                    {showCustomInput ? (
                      <div className="p-md rounded-xl border border-primary/40 bg-secondary-container/10 flex flex-col gap-sm">
                        <input 
                          type="text" 
                          placeholder="Category Name" 
                          value={customCategory}
                          onChange={(e) => setCustomCategory(e.target.value)}
                          className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 font-label-sm text-label-sm focus:outline-none focus:ring-2 focus:ring-primary-container"
                        />
                        <div className="flex gap-sm">
                          <input 
                            type="number" 
                            placeholder="Amount" 
                            value={customAmount}
                            onChange={(e) => setCustomAmount(e.target.value)}
                            className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 font-label-sm text-label-sm focus:outline-none focus:ring-2 focus:ring-primary-container"
                          />
                          <button 
                            onClick={handleAddCustomExpense}
                            className="bg-primary text-on-primary px-4 rounded-lg font-label-sm text-label-sm cursor-pointer"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setShowCustomInput(true)}
                        className="w-full flex items-center justify-center gap-sm py-md border-2 border-dashed border-outline-variant/30 rounded-xl font-label-sm text-label-sm text-outline hover:border-primary/50 hover:text-primary transition-all cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[18px]">add_circle</span>
                        Add custom expense
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex gap-md mt-lg">
                  <button 
                    onClick={() => setStep(3)}
                    className="flex-shrink-0 w-14 h-14 bg-surface-container-high text-on-surface-variant rounded-[16px] hover:bg-surface-container-highest transition-colors flex items-center justify-center cursor-pointer"
                  >
                    <span className="material-symbols-outlined">arrow_back</span>
                  </button>
                  <button
                    disabled={totalFixedExpenses > numericBudget}
                    onClick={() => setStep(5)}
                    className="flex-grow py-md bg-primary hover:bg-on-primary-container text-on-primary font-headline-md text-headline-md rounded-[16px] transition-all flex items-center justify-center gap-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-lg"
                  >
                    Summary
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* STEP 5: BUDGET SUMMARY */}
          {step === 5 && (
            <section className="flex flex-col h-full space-y-md">
              <div className="bg-surface-container-lowest rounded-[24px] p-lg shadow-[0px_4px_20px_rgba(0,0,0,0.04)] border border-outline-variant/30 flex-grow flex flex-col justify-between">
                <div>
                  <div className="text-center mb-md">
                    <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface mb-xs font-bold">Your Smart Summary</h1>
                    <p className="font-body-md text-body-md text-on-surface-variant">Here is your daily spending limit computed from onboarding inputs.</p>
                  </div>

                  {/* Summary Metric Bento Grid */}
                  <div className="space-y-sm">
                    {/* Hero Metric - Monthly Budget */}
                    <div className="p-md rounded-2xl bg-gradient-to-br from-white to-surface-container border border-outline-variant/30 text-center shadow-sm relative overflow-hidden">
                      <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider mb-xs block">Monthly Target Budget</span>
                      <h2 className="font-display-lg text-display-lg text-primary font-extrabold">${numericBudget.toFixed(2)}</h2>
                    </div>

                    {/* Bento split grid */}
                    <div className="grid grid-cols-2 gap-sm">
                      <div className="p-md rounded-2xl bg-surface-container-low border border-outline-variant/20">
                        <span className="font-label-sm text-label-sm text-outline block mb-xs">Fixed Bills</span>
                        <h4 className="font-headline-md text-headline-md text-on-surface font-bold">${totalFixedExpenses.toFixed(2)}</h4>
                      </div>
                      <div className="p-md rounded-2xl bg-surface-container-low border border-outline-variant/20">
                        <span className="font-label-sm text-label-sm text-outline block mb-xs">Remaining</span>
                        <h4 className="font-headline-md text-headline-md text-on-surface font-bold">${remainingBudget.toFixed(2)}</h4>
                      </div>
                    </div>

                    {/* Suggested Targets */}
                    <div className="grid grid-cols-2 gap-sm">
                      <div className="p-md rounded-2xl bg-secondary-container/20 border border-outline-variant/20 flex flex-col justify-between">
                        <div>
                          <span className="material-symbols-outlined text-primary mb-xs">bolt</span>
                          <span className="font-label-sm text-label-sm text-outline block">Daily Limit</span>
                        </div>
                        <h4 className="font-headline-lg text-headline-lg text-primary font-bold mt-sm">${suggestedDailyTarget.toFixed(2)}</h4>
                      </div>
                      <div className="p-md rounded-2xl bg-secondary-container/20 border border-outline-variant/20 flex flex-col justify-between">
                        <div>
                          <span className="material-symbols-outlined text-primary mb-xs">calendar_view_week</span>
                          <span className="font-label-sm text-label-sm text-outline block">Weekly Limit</span>
                        </div>
                        <h4 className="font-headline-lg text-headline-lg text-primary font-bold mt-sm">${suggestedWeeklyTarget.toFixed(2)}</h4>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-md mt-lg">
                  <button 
                    disabled={loading}
                    onClick={() => setStep(4)}
                    className="flex-shrink-0 w-14 h-14 bg-surface-container-high text-on-surface-variant rounded-[16px] hover:bg-surface-container-highest transition-colors flex items-center justify-center cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined">arrow_back</span>
                  </button>
                  <button
                    disabled={loading}
                    onClick={handleCompleteSetup}
                    className="flex-grow py-md bg-primary hover:bg-on-primary-container text-on-primary font-headline-md text-headline-md rounded-[16px] transition-all flex items-center justify-center gap-sm cursor-pointer shadow-lg disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="w-6 h-6 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>
                        Start Tracking
                        <span className="material-symbols-outlined">arrow_forward</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </section>
          )}

        </div>
      </main>

      {/* Ambient Radial Background Blurs */}
      <div className="fixed inset-0 -z-10 pointer-events-none opacity-40 overflow-hidden">
        <div className="absolute top-[10%] right-[-10%] w-96 h-96 bg-primary/5 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[10%] left-[-10%] w-[500px] h-[500px] bg-secondary-container/10 rounded-full blur-[120px]"></div>
      </div>
    </div>
  );
}
