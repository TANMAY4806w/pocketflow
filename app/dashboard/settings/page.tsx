"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/auth-context";
import { useRouter } from "next/navigation";
import { AuthService } from "../../../lib/services/auth-service";
import { BudgetService } from "../../../lib/services/budget-service";
import { BudgetConfig, FixedExpense } from "../../../types";
import Link from "next/link";

export default function SettingsPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Budget data
  const [budgetConfig, setBudgetConfig] = useState<BudgetConfig | null>(null);
  const [budgetLoading, setBudgetLoading] = useState(true);

  // Editable fields
  const [editingBudget, setEditingBudget] = useState(false);
  const [editIncome, setEditIncome] = useState("");
  const [editMonthlyBudget, setEditMonthlyBudget] = useState("");
  const [editFixedExpenses, setEditFixedExpenses] = useState<Array<{ category: string; amount: string; isPaid: boolean }>>([]);
  const [savingBudget, setSavingBudget] = useState(false);

  // Add custom expense
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [newExpenseCategory, setNewExpenseCategory] = useState("");
  const [newExpenseAmount, setNewExpenseAmount] = useState("");

  // Time
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const monthName = now.toLocaleString("default", { month: "long" });
  const daysInMonth = new Date(year, month, 0).getDate();

  // Load budget config
  useEffect(() => {
    async function loadBudget() {
      if (!user || !profile) {
        setBudgetLoading(false);
        return;
      }
      try {
        const workspaceId = profile.activeWorkspaceId || user.uid;
        const budget = await BudgetService.getCurrentBudget(workspaceId, monthKey);
        setBudgetConfig(budget);
        if (budget) {
          setEditIncome(String(budget.income));
          setEditMonthlyBudget(String(budget.monthlyBudget));
          setEditFixedExpenses(
            budget.fixedExpenses.map((e) => ({
              category: e.category,
              amount: String(e.amount),
              isPaid: e.isPaid,
            }))
          );
        }
      } catch (err: any) {
        console.error("Failed to load budget:", err);
      } finally {
        setBudgetLoading(false);
      }
    }
    loadBudget();
  }, [user, profile, monthKey]);

  // Save budget changes
  const handleSaveBudget = async () => {
    if (!user || !profile) return;
    setSavingBudget(true);
    setError(null);
    setSuccess(null);
    try {
      const workspaceId = profile.activeWorkspaceId || user.uid;
      const income = parseFloat(editIncome) || 0;
      const budget = parseFloat(editMonthlyBudget) || 0;
      const fixedExpenses: FixedExpense[] = editFixedExpenses
        .filter((e) => parseFloat(e.amount) > 0 || e.category.trim())
        .map((e) => ({
          category: e.category,
          amount: parseFloat(e.amount) || 0,
          isPaid: e.isPaid,
        }));

      await BudgetService.saveBudget(user.uid, workspaceId, monthKey, income, budget, fixedExpenses);

      // Reload the config
      const updatedBudget = await BudgetService.getCurrentBudget(workspaceId, monthKey);
      setBudgetConfig(updatedBudget);
      setEditingBudget(false);
      setSuccess("Budget updated successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error("Failed to save budget:", err);
      setError("Failed to save budget changes. Please try again.");
    } finally {
      setSavingBudget(false);
    }
  };

  // Toggle paid status
  const handleTogglePaid = (index: number) => {
    setEditFixedExpenses((prev) =>
      prev.map((e, i) => (i === index ? { ...e, isPaid: !e.isPaid } : e))
    );
  };

  // Remove fixed expense
  const handleRemoveExpense = (index: number) => {
    setEditFixedExpenses((prev) => prev.filter((_, i) => i !== index));
  };

  // Add custom fixed expense
  const handleAddExpense = () => {
    if (!newExpenseCategory.trim()) return;
    setEditFixedExpenses((prev) => [
      ...prev,
      { category: newExpenseCategory.trim(), amount: newExpenseAmount || "0", isPaid: false },
    ]);
    setNewExpenseCategory("");
    setNewExpenseAmount("");
    setShowAddExpense(false);
  };

  // Icon helper for categories
  const getCategoryIcon = (cat: string) => {
    const lower = cat.toLowerCase();
    if (lower.includes("rent") || lower.includes("home")) return "home";
    if (lower.includes("subscri") || lower.includes("netflix") || lower.includes("spotify")) return "subscriptions";
    if (lower.includes("travel") || lower.includes("transport")) return "commute";
    if (lower.includes("sip") || lower.includes("invest")) return "trending_up";
    if (lower.includes("emi") || lower.includes("loan")) return "account_balance";
    if (lower.includes("insur")) return "health_and_safety";
    if (lower.includes("electric") || lower.includes("bill") || lower.includes("utility")) return "bolt";
    if (lower.includes("phone") || lower.includes("mobile") || lower.includes("recharge")) return "smartphone";
    if (lower.includes("gym") || lower.includes("fitness")) return "fitness_center";
    return "pending_actions";
  };

  // Computed values
  const totalFixed = editFixedExpenses.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0);
  const numericBudget = parseFloat(editMonthlyBudget) || 0;
  const remaining = Math.max(0, numericBudget - totalFixed);
  const dailyTarget = remaining / daysInMonth;

  const handleSignOut = async () => {
    try {
      setLoading(true);
      await AuthService.signOutUser();
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Failed to sign out.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmDelete = window.confirm(
      "Are you absolutely sure you want to delete your account? This action cannot be undone and you will lose access to all your financial data."
    );
    if (!confirmDelete) return;

    try {
      setLoading(true);
      await AuthService.deleteAccount();
      router.push("/");
    } catch (err: any) {
      if (err.code === "auth/requires-recent-login") {
        setError("For security reasons, you must sign out and sign back in before deleting your account.");
      } else {
        setError(err.message || "Failed to delete account.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-surface pb-36">
      {/* Top App Bar */}
      <header className="sticky top-0 z-40 bg-surface/80 backdrop-blur-md flex items-center px-container-margin py-md border-b border-outline-variant/20">
        <Link href="/dashboard" className="w-12 h-12 flex items-center justify-center -ml-3 rounded-full hover:bg-surface-container transition-colors active:bg-surface-container-high">
          <span className="material-symbols-outlined text-[24px]">arrow_back</span>
        </Link>
        <h1 className="font-headline-sm text-headline-sm flex-1 text-center pr-9">Settings</h1>
      </header>

      <main className="px-container-margin py-xl space-y-xl w-full max-w-[448px] md:max-w-[768px] mx-auto">
        {/* Profile Info */}
        <section className="flex flex-col items-center bg-surface-container-lowest border border-outline-variant/30 rounded-[24px] p-lg shadow-sm">
          <div className="w-24 h-24 rounded-full overflow-hidden mb-md border-4 border-primary-container shadow-md">
            {profile?.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-primary flex items-center justify-center text-on-primary font-headline-lg text-headline-lg">
                {profile?.displayName?.charAt(0) || user?.email?.charAt(0) || "U"}
              </div>
            )}
          </div>
          <h2 className="font-headline-md text-headline-md text-on-surface font-bold">{profile?.displayName || "User"}</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">{user?.email}</p>
        </section>

        {/* Notifications */}
        {error && (
          <div className="bg-error-container text-on-error-container p-md rounded-xl font-body-sm text-body-sm flex items-center gap-sm">
            <span className="material-symbols-outlined text-[20px]">error</span>
            {error}
          </div>
        )}
        {success && (
          <div className="bg-secondary-container text-on-secondary-container p-md rounded-xl font-body-sm text-body-sm flex items-center gap-sm">
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            {success}
          </div>
        )}

        {/* ============== BUDGET SETTINGS ============== */}
        <section className="space-y-sm">
          <h3 className="font-label-md text-label-md text-primary uppercase tracking-wider mb-sm pl-xs">
            Budget Settings — {monthName} {year}
          </h3>

          {budgetLoading ? (
            <div className="flex items-center justify-center p-xl">
              <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : !budgetConfig ? (
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-[16px] p-lg text-center space-y-md">
              <span className="material-symbols-outlined text-[48px] text-outline">savings</span>
              <p className="font-body-md text-body-md text-on-surface-variant">No budget set up for this month yet.</p>
              <button
                onClick={() => router.push("/onboarding")}
                className="px-6 py-3 bg-primary text-on-primary rounded-xl font-label-md text-label-md font-bold cursor-pointer hover:bg-on-primary-container transition-colors"
              >
                Set Up Budget
              </button>
            </div>
          ) : editingBudget ? (
            /* ============ EDIT MODE ============ */
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-[24px] p-lg space-y-lg shadow-sm">
              {/* Income */}
              <div className="space-y-xs">
                <label className="font-label-sm text-label-sm text-outline uppercase block">Monthly Income</label>
                <div className="flex items-center gap-xs bg-surface-container-low rounded-xl p-md">
                  <span className="font-headline-md text-headline-md text-primary font-bold">₹</span>
                  <input
                    type="number"
                    value={editIncome}
                    onChange={(e) => setEditIncome(e.target.value)}
                    className="flex-1 bg-transparent text-on-surface font-headline-md text-headline-md font-bold focus:outline-none w-0"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Monthly Budget */}
              <div className="space-y-xs">
                <label className="font-label-sm text-label-sm text-outline uppercase block">Monthly Budget</label>
                <div className="flex items-center gap-xs bg-surface-container-low rounded-xl p-md">
                  <span className="font-headline-md text-headline-md text-primary font-bold">₹</span>
                  <input
                    type="number"
                    value={editMonthlyBudget}
                    onChange={(e) => setEditMonthlyBudget(e.target.value)}
                    className="flex-1 bg-transparent text-on-surface font-headline-md text-headline-md font-bold focus:outline-none w-0"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Fixed Expenses */}
              <div className="space-y-sm">
                <div className="flex items-center justify-between">
                  <label className="font-label-sm text-label-sm text-outline uppercase">Fixed Monthly Bills</label>
                  <span className="font-label-sm text-label-sm text-primary font-bold">₹{totalFixed.toFixed(0)}</span>
                </div>

                <div className="space-y-xs">
                  {editFixedExpenses.map((expense, idx) => (
                    <div key={idx} className="flex items-center gap-sm bg-surface-container-low rounded-xl p-sm pr-xs">
                      <div className="w-10 h-10 rounded-lg bg-secondary-container/40 flex items-center justify-center text-primary flex-shrink-0">
                        <span className="material-symbols-outlined text-[20px]">{getCategoryIcon(expense.category)}</span>
                      </div>
                      <span className="font-label-md text-label-md text-on-surface font-semibold flex-shrink-0 min-w-[80px]">{expense.category}</span>
                      <div className="flex items-center gap-xs flex-1">
                        <span className="text-outline font-semibold text-sm">₹</span>
                        <input
                          type="number"
                          value={expense.amount}
                          onChange={(e) => {
                            setEditFixedExpenses((prev) =>
                              prev.map((ex, i) => (i === idx ? { ...ex, amount: e.target.value } : ex))
                            );
                          }}
                          className="w-full bg-transparent text-on-surface font-label-md text-label-md font-bold focus:outline-none"
                          placeholder="0"
                        />
                      </div>
                      <button
                        onClick={() => handleTogglePaid(idx)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer ${
                          expense.isPaid
                            ? "bg-primary text-on-primary"
                            : "bg-surface-container-high text-outline"
                        }`}
                        title={expense.isPaid ? "Mark unpaid" : "Mark paid"}
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {expense.isPaid ? "check" : "close"}
                        </span>
                      </button>
                      <button
                        onClick={() => handleRemoveExpense(idx)}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-error hover:bg-error-container/20 flex-shrink-0 cursor-pointer transition-colors"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add custom expense */}
                {showAddExpense ? (
                  <div className="flex items-center gap-sm bg-surface-container-low rounded-xl p-sm">
                    <input
                      type="text"
                      value={newExpenseCategory}
                      onChange={(e) => setNewExpenseCategory(e.target.value)}
                      placeholder="Category name"
                      className="flex-1 bg-transparent font-label-md text-label-md focus:outline-none"
                    />
                    <div className="flex items-center gap-1">
                      <span className="text-outline text-sm">₹</span>
                      <input
                        type="number"
                        value={newExpenseAmount}
                        onChange={(e) => setNewExpenseAmount(e.target.value)}
                        placeholder="0"
                        className="w-20 bg-transparent font-label-md text-label-md font-bold focus:outline-none"
                      />
                    </div>
                    <button onClick={handleAddExpense} className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center cursor-pointer">
                      <span className="material-symbols-outlined text-[16px]">add</span>
                    </button>
                    <button onClick={() => setShowAddExpense(false)} className="w-8 h-8 rounded-full bg-surface-container-high text-outline flex items-center justify-center cursor-pointer">
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddExpense(true)}
                    className="w-full flex items-center justify-center gap-xs p-sm text-primary font-label-sm text-label-sm font-bold border border-dashed border-primary/30 rounded-xl hover:bg-primary/5 cursor-pointer transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">add_circle</span>
                    Add fixed expense
                  </button>
                )}
              </div>

              {/* Computed Summary */}
              <div className="bg-surface-container rounded-xl p-md space-y-xs">
                <div className="flex justify-between font-label-sm text-label-sm">
                  <span className="text-outline">Remaining after bills</span>
                  <span className="text-on-surface font-bold">₹{remaining.toFixed(0)}</span>
                </div>
                <div className="flex justify-between font-label-sm text-label-sm">
                  <span className="text-outline">Daily spending limit</span>
                  <span className="text-primary font-bold">₹{dailyTarget.toFixed(2)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-sm">
                <button
                  onClick={() => {
                    // Reset to original values
                    if (budgetConfig) {
                      setEditIncome(String(budgetConfig.income));
                      setEditMonthlyBudget(String(budgetConfig.monthlyBudget));
                      setEditFixedExpenses(
                        budgetConfig.fixedExpenses.map((e) => ({
                          category: e.category,
                          amount: String(e.amount),
                          isPaid: e.isPaid,
                        }))
                      );
                    }
                    setEditingBudget(false);
                  }}
                  className="flex-1 py-md bg-surface-container-high text-on-surface-variant font-label-md text-label-md rounded-[16px] hover:bg-surface-container-highest transition-colors cursor-pointer font-bold"
                >
                  Cancel
                </button>
                <button
                  disabled={savingBudget}
                  onClick={handleSaveBudget}
                  className="flex-1 py-md bg-primary text-on-primary font-label-md text-label-md rounded-[16px] hover:bg-on-primary-container transition-colors cursor-pointer shadow-md disabled:opacity-50 font-bold flex items-center justify-center gap-sm"
                >
                  {savingBudget ? (
                    <div className="w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">save</span>
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* ============ VIEW MODE ============ */
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-[24px] p-lg space-y-md shadow-sm">
              {/* Budget Overview */}
              <div className="grid grid-cols-2 gap-sm">
                <div className="bg-surface-container-low rounded-xl p-md">
                  <span className="font-label-sm text-label-sm text-outline block mb-xs">Monthly Income</span>
                  <span className="font-headline-md text-headline-md text-on-surface font-bold">₹{budgetConfig.income.toLocaleString()}</span>
                </div>
                <div className="bg-surface-container-low rounded-xl p-md">
                  <span className="font-label-sm text-label-sm text-outline block mb-xs">Monthly Budget</span>
                  <span className="font-headline-md text-headline-md text-primary font-bold">₹{budgetConfig.monthlyBudget.toLocaleString()}</span>
                </div>
              </div>

              {/* Fixed expenses list */}
              <div className="space-y-xs">
                <span className="font-label-sm text-label-sm text-outline uppercase block mb-xs">Fixed Monthly Bills</span>
                {budgetConfig.fixedExpenses.filter(e => e.amount > 0).length === 0 ? (
                  <p className="text-on-surface-variant font-body-md text-body-md text-center py-sm">No fixed bills set.</p>
                ) : (
                  budgetConfig.fixedExpenses
                    .filter((e) => e.amount > 0)
                    .map((expense, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-surface-container-low rounded-xl p-sm px-md">
                        <div className="flex items-center gap-sm">
                          <div className="w-8 h-8 rounded-lg bg-secondary-container/40 flex items-center justify-center text-primary">
                            <span className="material-symbols-outlined text-[18px]">{getCategoryIcon(expense.category)}</span>
                          </div>
                          <span className="font-label-md text-label-md text-on-surface font-semibold">{expense.category}</span>
                        </div>
                        <div className="flex items-center gap-sm">
                          <span className="font-label-md text-label-md text-on-surface font-bold">₹{expense.amount.toLocaleString()}</span>
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center ${expense.isPaid ? "bg-primary text-on-primary" : "bg-surface-container-high text-outline"}`}>
                            <span className="material-symbols-outlined text-[14px]">{expense.isPaid ? "check" : "close"}</span>
                          </span>
                        </div>
                      </div>
                    ))
                )}
              </div>

              {/* Summary line */}
              <div className="bg-surface-container rounded-xl p-md flex justify-between items-center">
                <span className="font-label-sm text-label-sm text-outline">Daily Spending Limit</span>
                <span className="font-headline-md text-headline-md text-primary font-bold">₹{budgetConfig.dailyTarget.toFixed(2)}</span>
              </div>

              {/* Edit button */}
              <button
                onClick={() => setEditingBudget(true)}
                className="w-full flex items-center justify-center gap-sm py-md bg-secondary-container/30 hover:bg-secondary-container/50 text-primary font-label-md text-label-md font-bold rounded-[16px] transition-colors cursor-pointer border border-primary/10"
              >
                <span className="material-symbols-outlined text-[18px]">edit</span>
                Edit Budget & Bills
              </button>
            </div>
          )}
        </section>

        {/* Account Actions */}
        <section className="space-y-sm">
          <h3 className="font-label-md text-label-md text-primary uppercase tracking-wider mb-sm pl-xs">Account Management</h3>
          
          <button 
            onClick={handleSignOut}
            disabled={loading}
            className="w-full flex items-center justify-between p-md bg-surface-container-lowest hover:bg-surface-container-low border border-outline-variant/30 rounded-[16px] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-md text-on-surface">
              <span className="material-symbols-outlined text-outline">logout</span>
              <span className="font-label-md text-label-md font-bold">Sign Out</span>
            </div>
            <span className="material-symbols-outlined text-outline-variant">chevron_right</span>
          </button>
        </section>

        {/* Danger Zone */}
        <section className="space-y-sm pt-md">
          <h3 className="font-label-md text-label-md text-error uppercase tracking-wider mb-sm pl-xs">Danger Zone</h3>
          
          <button 
            onClick={handleDeleteAccount}
            disabled={loading}
            className="w-full flex items-center justify-between p-md bg-error-container/30 hover:bg-error-container/50 border border-error/20 rounded-[16px] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-md text-error">
              <span className="material-symbols-outlined">delete_forever</span>
              <div className="text-left">
                <span className="font-label-md text-label-md font-bold block">Delete Account</span>
                <span className="font-label-sm text-label-sm opacity-80">Permanently erase your data</span>
              </div>
            </div>
            <span className="material-symbols-outlined text-error/50">chevron_right</span>
          </button>
        </section>
      </main>
    </div>
  );
}
