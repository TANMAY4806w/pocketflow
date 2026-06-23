"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/auth-context";
import { ProtectedRoute } from "../../components/auth/protected-route";
import { ExpenseService } from "../../lib/services/expense-service";
import { CategoryService } from "../../lib/services/category-service";
import { ExpenseLog, CategoryItem } from "../../types";
import { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";

type FilterType = "today" | "this-week" | "this-month" | "last-month" | "custom";

export default function ExpensesPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  // Data list states
  const [expenses, setExpenses] = useState<ExpenseLog[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination states
  const [lastVisibleDoc, setLastVisibleDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("this-month");
  
  // Custom Date range
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Edit Modal States
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [expenseDateStr, setExpenseDateStr] = useState("");
  const [selectedCategoryIdx, setSelectedCategoryIdx] = useState<number>(0);
  const [savingEdit, setSavingEdit] = useState(false);

  // Setup Date Range variables based on active filters
  const getDateRange = (): { start: Date; end: Date } => {
    const now = new Date();
    let start = new Date();
    let end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    switch (filter) {
      case "today":
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        break;
      case "this-week":
        const dayOfWeek = now.getDay();
        const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // start from Monday
        start = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0);
        break;
      case "this-month":
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        break;
      case "last-month":
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        break;
      case "custom":
        start = customStart ? new Date(customStart + "T00:00:00") : new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        end = customEnd ? new Date(customEnd + "T23:59:59") : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
    }
    return { start, end };
  };

  // Main loader helper
  const loadExpenses = async (loadMore: boolean = false) => {
    if (authLoading) return;

    if (!user) {
      setLoading(false);
      return;
    }

    if (!profile) {
      setError("User profile could not be loaded. Please try again.");
      setLoading(false);
      return;
    }

    if (loadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const workspaceId = profile.activeWorkspaceId || user.uid;
      const { start, end } = getDateRange();

      // Fetch Categories first for dropdowns/pickers
      const loadedCats = await CategoryService.getCategories(workspaceId, user.uid);
      setCategories(loadedCats);

      const cursor = loadMore ? lastVisibleDoc : null;
      const response = await ExpenseService.getExpensesPaginated(workspaceId, start, end, 15, cursor);

      if (loadMore) {
        setExpenses((prev) => [...prev, ...response.logs]);
      } else {
        setExpenses(response.logs);
      }

      setLastVisibleDoc(response.lastDoc);
      setHasMore(response.logs.length === 15);
    } catch (err: any) {
      console.error("Load Expenses Error:", err);
      setError("Failed to retrieve transaction history. Please try again.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadExpenses(false);
  }, [user, profile, authLoading, filter, customStart, customEnd]);

  // Timeout safety fallback for expenses history loading
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (loading && !authLoading) {
      timeoutId = setTimeout(() => {
        setLoading(false);
        setError("Retrieved history request timed out. Please check your internet connection.");
      }, 8000); // 8-second safety timeout
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [loading, authLoading]);

  // Handle delete action
  const handleDeleteExpense = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expense permanently?")) return;
    try {
      await ExpenseService.deleteExpense(id);
      setExpenses((prev) => prev.filter((item) => item.id !== id));
    } catch (err: any) {
      console.error("Delete Expense Error:", err);
      alert("Failed to delete expense.");
    }
  };

  // Handle edit Modal trigger
  const handleOpenEdit = (expense: ExpenseLog) => {
    setEditingExpenseId(expense.id || null);
    setAmount(expense.amount.toString());
    setNote(expense.note);
    // Format Date to YYYY-MM-DD
    const date = new Date(expense.expenseDate);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    setExpenseDateStr(dateStr);

    const catIdx = categories.findIndex((c) => c.id === expense.category.id);
    setSelectedCategoryIdx(catIdx !== -1 ? catIdx : 0);
    setShowEditModal(true);
  };

  // Save edits action
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0 || !editingExpenseId || !user) return;

    setSavingEdit(true);
    try {
      const selectedCategory = categories[selectedCategoryIdx];
      const targetDate = new Date(expenseDateStr + "T12:00:00"); // Standard midday offset

      await ExpenseService.updateExpense(
        editingExpenseId,
        parsedAmount,
        note.trim() || `${selectedCategory.name} expense`,
        targetDate,
        "Main Wallet",
        selectedCategory
      );

      setShowEditModal(false);
      // Reload active items
      await loadExpenses(false);
    } catch (err: any) {
      console.error("Update Expense Error:", err);
      alert("Failed to save changes.");
    } finally {
      setSavingEdit(false);
    }
  };

  // Grouping by Date calculation
  const groupedExpenses = expenses
    .filter((exp) => {
      // Search filter matches note or category name
      const query = searchQuery.toLowerCase().trim();
      if (!query) return true;
      return (
        exp.note.toLowerCase().includes(query) ||
        exp.category.name.toLowerCase().includes(query)
      );
    })
    .reduce((groups: Record<string, ExpenseLog[]>, expense) => {
      const date = new Date(expense.expenseDate);
      const dateLabel = date.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "short",
        day: "numeric",
      });

      if (!groups[dateLabel]) {
        groups[dateLabel] = [];
      }
      groups[dateLabel].push(expense);
      return groups;
    }, {});

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen pb-32 bg-background text-on-surface">
          <header className="w-full top-0 sticky z-40 bg-surface/90 backdrop-blur-md flex justify-between items-center px-container-margin py-md border-b border-outline-variant/10">
            <div className="flex items-center gap-sm">
              <button 
                onClick={() => router.push("/dashboard")}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-low transition-colors text-outline cursor-pointer"
              >
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              <h1 className="font-headline-md text-headline-md font-bold text-primary">Expense History</h1>
            </div>
          </header>
          <div className="flex flex-col items-center justify-center pt-20">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (error && expenses.length === 0) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen pb-32 bg-background text-on-surface">
          <header className="w-full top-0 sticky z-40 bg-surface/90 backdrop-blur-md flex justify-between items-center px-container-margin py-md border-b border-outline-variant/10">
            <div className="flex items-center gap-sm">
              <button 
                onClick={() => router.push("/dashboard")}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-low transition-colors text-outline cursor-pointer"
              >
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              <h1 className="font-headline-md text-headline-md font-bold text-primary">Expense History</h1>
            </div>
          </header>
          <main className="px-container-margin pt-xl text-center max-w-md mx-auto flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-error-container text-on-error-container rounded-2xl flex items-center justify-center mb-lg shadow-sm">
              <span className="material-symbols-outlined text-[32px]">error</span>
            </div>
            <h2 className="font-headline-md text-headline-md font-bold text-on-surface mb-sm">Something went wrong</h2>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-xs mb-lg">
              {error}
            </p>
            <button
              onClick={() => {
                setLoading(true);
                setError(null);
                loadExpenses(false);
              }}
              className="w-full max-w-[200px] py-md bg-primary hover:bg-on-primary-container text-on-primary font-label-md text-label-md rounded-xl transition-all cursor-pointer shadow-md"
            >
              Retry Connection
            </button>
          </main>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen pb-32 overflow-x-hidden bg-background text-on-surface">
        
        {/* Top Header Navigation */}
        <header className="w-full top-0 sticky z-40 bg-surface/90 backdrop-blur-md flex justify-between items-center px-container-margin py-md border-b border-outline-variant/10">
          <div className="flex items-center gap-sm">
            <button 
              onClick={() => router.push("/dashboard")}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-low transition-colors text-outline cursor-pointer"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <h1 className="font-headline-md text-headline-md font-bold text-primary">Expense History</h1>
          </div>
        </header>

        {/* Audit Search and Filter Boxes */}
        <main className="px-container-margin space-y-md pt-md max-w-md mx-auto">
          {error && (
            <div className="p-md bg-error-container text-on-error-container rounded-lg font-label-sm text-label-sm">
              {error}
            </div>
          )}

          {/* Search bar & Filter selects */}
          <div className="space-y-sm">
            <input 
              type="text" 
              placeholder="Search notes or categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary-container shadow-sm"
            />

            <div className="flex gap-sm">
              <select 
                value={filter}
                onChange={(e) => setFilter(e.target.value as FilterType)}
                className="flex-grow bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-3 py-2.5 font-label-sm text-label-sm focus:outline-none focus:ring-2 focus:ring-primary-container shadow-sm cursor-pointer"
              >
                <option value="today">Today</option>
                <option value="this-week">This Week</option>
                <option value="this-month">This Month</option>
                <option value="last-month">Last Month</option>
                <option value="custom">Custom Date Range</option>
              </select>
            </div>

            {/* Custom Range picker inputs */}
            {filter === "custom" && (
              <div className="grid grid-cols-2 gap-sm p-sm bg-surface-container-low rounded-xl border border-outline-variant/20">
                <div>
                  <label className="font-label-sm text-label-sm text-outline block mb-xs">Start Date</label>
                  <input 
                    type="date" 
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full bg-surface-container-lowest border-none rounded-lg px-2 py-1 font-body-md text-body-md focus:ring-2 focus:ring-primary-container"
                  />
                </div>
                <div>
                  <label className="font-label-sm text-label-sm text-outline block mb-xs">End Date</label>
                  <input 
                    type="date" 
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full bg-surface-container-lowest border-none rounded-lg px-2 py-1 font-body-md text-body-md focus:ring-2 focus:ring-primary-container"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Grouped Logs lists */}
          <section className="space-y-lg">
            {Object.keys(groupedExpenses).length === 0 ? (
              <div className="p-xl rounded-[24px] border border-dashed border-outline-variant/30 text-center bg-surface-container-low/40">
                <span className="material-symbols-outlined text-[48px] text-outline mb-sm">search_off</span>
                <h4 className="font-headline-md text-headline-md font-bold text-on-surface mb-xs">No records found</h4>
                <p className="font-body-md text-body-md text-on-surface-variant max-w-xs mx-auto">No expenses match your search query or selected date parameters.</p>
              </div>
            ) : (
              Object.keys(groupedExpenses).map((dateLabel) => (
                <div key={dateLabel} className="space-y-sm">
                  {/* Date label header */}
                  <h3 className="font-label-sm text-label-sm text-outline font-bold uppercase tracking-wider pl-xs">{dateLabel}</h3>
                  
                  {/* Category Transactions logs */}
                  <div className="space-y-xs">
                    {groupedExpenses[dateLabel].map((expense) => (
                      <div 
                        key={expense.id} 
                        className="p-md bg-surface-container-lowest rounded-[16px] border border-outline-variant/20 flex justify-between items-center shadow-sm"
                      >
                        <div className="flex items-center gap-sm">
                          <div 
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-white" 
                            style={{ backgroundColor: expense.category.color }}
                          >
                            <span className="material-symbols-outlined">{expense.category.icon}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="font-label-md text-label-md font-bold text-on-surface leading-snug">{expense.note}</span>
                            <span className="font-label-sm text-label-sm text-outline">{expense.category.name}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-md">
                          <span className="font-headline-md text-headline-md font-bold text-on-surface">-${expense.amount.toFixed(2)}</span>
                          <div className="flex gap-xs">
                            <button 
                              onClick={() => handleOpenEdit(expense)}
                              className="w-8 h-8 rounded-full bg-surface-container-low text-on-surface-variant flex items-center justify-center cursor-pointer hover:bg-surface-container-high"
                            >
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                            <button 
                              onClick={() => handleDeleteExpense(expense.id!)}
                              className="w-8 h-8 rounded-full bg-error-container/20 text-error flex items-center justify-center cursor-pointer hover:bg-error-container/40"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </section>

          {/* Load More Button */}
          {hasMore && expenses.length > 0 && (
            <button
              disabled={loadingMore}
              onClick={() => loadExpenses(true)}
              className="w-full py-md bg-surface-container-high hover:bg-surface-container-highest font-label-md text-label-md text-on-surface-variant rounded-xl cursor-pointer shadow-sm active:scale-95 transition-all flex items-center justify-center gap-sm"
            >
              {loadingMore ? (
                <div className="w-5 h-5 border-2 border-on-surface-variant border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span className="material-symbols-outlined">expand_more</span>
                  Load More Expenses
                </>
              )}
            </button>
          )}

        </main>

        {/* Edit Modal Dialog */}
        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm">
            <form 
              onSubmit={handleSaveEdit}
              className="w-full max-w-md bg-surface rounded-t-[32px] p-lg shadow-2xl flex flex-col gap-md max-h-[90vh] overflow-y-auto border-t border-outline-variant/20 animate-slide-up"
            >
              <div className="flex justify-between items-center border-b border-outline-variant/15 pb-sm">
                <h2 className="font-headline-md text-headline-md font-bold">Edit Transaction</h2>
                <button 
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="w-8 h-8 rounded-full bg-surface-container-low flex items-center justify-center text-outline cursor-pointer"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* Amount */}
              <div className="space-y-xs">
                <label className="font-label-sm text-label-sm text-outline uppercase block">Amount ($)</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 font-display-lg text-display-lg text-primary font-bold focus:outline-none focus:ring-2 focus:ring-primary-container"
                />
              </div>

              {/* Note */}
              <div className="space-y-xs">
                <label className="font-label-sm text-label-sm text-outline uppercase block">Note</label>
                <input 
                  type="text" 
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary-container"
                />
              </div>

              {/* Date */}
              <div className="space-y-xs">
                <label className="font-label-sm text-label-sm text-outline uppercase block">Date</label>
                <input 
                  type="date" 
                  value={expenseDateStr}
                  onChange={(e) => setExpenseDateStr(e.target.value)}
                  required
                  className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary-container"
                />
              </div>

              {/* Horizontal scrollable Category selector */}
              <div className="space-y-xs">
                <span className="font-label-sm text-label-sm text-outline block uppercase tracking-wider">Select Category</span>
                <div className="flex gap-sm overflow-x-auto py-xs scrollbar-none">
                  {categories.map((cat, idx) => (
                    <button
                      key={cat.id}
                      type="button"
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

              {/* Action Submit */}
              <button 
                type="submit"
                disabled={savingEdit || !amount || parseFloat(amount) <= 0}
                className="w-full py-md bg-primary hover:bg-on-primary-container text-on-primary font-headline-md text-headline-md rounded-[16px] transition-all flex items-center justify-center gap-sm cursor-pointer shadow-lg disabled:opacity-50"
              >
                {savingEdit ? (
                  <div className="w-6 h-6 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span className="material-symbols-outlined">check</span>
                    Save Changes
                  </>
                )}
              </button>
            </form>
          </div>
        )}

      </div>
    </ProtectedRoute>
  );
}
