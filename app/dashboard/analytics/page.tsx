"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../context/auth-context";
import { ProtectedRoute } from "../../../components/auth/protected-route";
import { BudgetService } from "../../../lib/services/budget-service";
import { ExpenseService } from "../../../lib/services/expense-service";
import { CategoryService } from "../../../lib/services/category-service";
import { BudgetConfig, CategoryItem, ExpenseLog } from "../../../types";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, BarChart, Bar, Legend
} from "recharts";
import { BottomNav } from "../../../components/BottomNav";

export default function AnalyticsPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [budgetConfig, setBudgetConfig] = useState<BudgetConfig | null>(null);
  const [currentAggregate, setCurrentAggregate] = useState<{ totalSpent: number; transactionCount: number; categoryTotals: Record<string, number> } | null>(null);
  const [lastAggregate, setLastAggregate] = useState<{ totalSpent: number; transactionCount: number; categoryTotals: Record<string, number> } | null>(null);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseLog[]>([]);

  // Time constants
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const currentMonthKey = `${year}-${String(month).padStart(2, "0")}`;
  
  const lastMonthDate = new Date(year, now.getMonth() - 1, 1);
  const lastMonth = lastMonthDate.getMonth() + 1;
  const lastYear = lastMonthDate.getFullYear();
  const lastMonthKey = `${lastYear}-${String(lastMonth).padStart(2, "0")}`;

  useEffect(() => {
    async function loadData() {
      if (authLoading) return;
      if (!user || !profile) {
        setLoading(false);
        return;
      }

      try {
        const workspaceId = profile.activeWorkspaceId || user.uid;

        const [
          budget, 
          currAgg, 
          prevAgg, 
          loadedCats,
          recentExpensesResponse
        ] = await Promise.all([
          BudgetService.getCurrentBudget(workspaceId, currentMonthKey),
          ExpenseService.getMonthlyAggregate(workspaceId, currentMonthKey),
          ExpenseService.getMonthlyAggregate(workspaceId, lastMonthKey),
          CategoryService.getCategories(workspaceId, user.uid),
          ExpenseService.getExpensesPaginated(
            workspaceId, 
            new Date(year, month - 1, 1), 
            new Date(year, month, 0, 23, 59, 59),
            100 // Get enough for chart
          )
        ]);

        setBudgetConfig(budget);
        setCurrentAggregate(currAgg);
        setLastAggregate(prevAgg);
        setCategories(loadedCats);
        setExpenses(recentExpensesResponse.logs);

      } catch (err: any) {
        console.error("Analytics Load Error:", err);
        setError("Failed to load analytics data.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user, profile, authLoading, currentMonthKey, lastMonthKey, month, year]);

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen pb-32 bg-background flex justify-center items-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </ProtectedRoute>
    );
  }

  // --- Compute Chart Data ---
  
  // 1. Category Breakdown Pie Data
  const pieData = Object.entries(currentAggregate?.categoryTotals || {})
    .map(([catId, amount]) => {
      const cat = categories.find(c => c.id === catId);
      return {
        name: cat ? cat.name : "Unknown",
        value: amount,
        color: cat ? cat.color : "#999999"
      };
    })
    .sort((a, b) => b.value - a.value);

  // 2. Budget Utilization %
  const targetBudget = budgetConfig?.monthlyBudget || 0;
  const currentTotal = currentAggregate?.totalSpent || 0;
  const utilization = targetBudget > 0 ? (currentTotal / targetBudget) * 100 : 0;

  // 3. Month-over-Month Comparison
  const lastTotal = lastAggregate?.totalSpent || 0;
  const momDiff = currentTotal - lastTotal;
  const momPercentage = lastTotal > 0 ? (momDiff / lastTotal) * 100 : 0;

  // 4. Monthly Spend Trend (Daily accumulated or daily amounts)
  // We'll do daily amount sums for the current month
  const daysInMonth = new Date(year, month, 0).getDate();
  const trendData = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const dailyExpenses = expenses.filter(e => new Date(e.expenseDate).getDate() === day);
    const dayTotal = dailyExpenses.reduce((sum, e) => sum + e.amount, 0);
    return {
      day: String(day),
      spent: dayTotal
    };
  });

  return (
    <ProtectedRoute>
      <div className="min-h-screen pb-36 overflow-x-hidden bg-background text-on-surface">
        
        {/* Top Header Navigation */}
        <header className="w-full top-0 sticky z-40 bg-surface/90 backdrop-blur-md flex justify-between items-center px-container-margin py-md border-b border-outline-variant/10">
          <div className="flex items-center gap-sm">
            <button 
              onClick={() => router.push("/dashboard")}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-low transition-colors text-outline cursor-pointer"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <h1 className="font-headline-md text-headline-md font-bold text-primary">Analytics</h1>
          </div>
        </header>

        <main className="px-container-margin space-y-lg pt-md w-full max-w-[448px] md:max-w-[800px] lg:max-w-[1140px] mx-auto">
          {error && (
            <div className="p-md bg-error-container text-on-error-container rounded-lg font-label-sm text-label-sm">
              {error}
            </div>
          )}

          {/* Overview Metrics */}
          <div className="grid grid-cols-2 gap-sm">
            <div className="bg-surface-container-low p-md rounded-[20px] border border-outline-variant/30">
              <span className="font-label-sm text-label-sm text-outline block mb-xs">Budget Utilized</span>
              <div className="flex items-end gap-xs">
                <span className="font-headline-lg text-headline-lg font-bold text-primary">{utilization.toFixed(0)}%</span>
              </div>
              <div className="w-full h-1.5 bg-surface-container-highest rounded-full mt-sm overflow-hidden">
                <div 
                  className={`h-full ${utilization > 100 ? 'bg-error' : 'bg-primary'}`} 
                  style={{ width: `${Math.min(utilization, 100)}%` }} 
                />
              </div>
            </div>

            <div className="bg-surface-container-low p-md rounded-[20px] border border-outline-variant/30">
              <span className="font-label-sm text-label-sm text-outline block mb-xs">vs. Last Month</span>
              <div className="flex items-end gap-xs">
                <span className="font-headline-lg text-headline-lg font-bold text-on-surface">
                  ₹{Math.abs(momDiff).toFixed(0)}
                </span>
              </div>
              <div className={`flex items-center gap-1 mt-sm font-label-sm text-label-sm ${momDiff > 0 ? 'text-error' : 'text-primary'}`}>
                <span className="material-symbols-outlined text-[16px]">
                  {momDiff > 0 ? 'trending_up' : 'trending_down'}
                </span>
                {Math.abs(momPercentage).toFixed(1)}% {momDiff > 0 ? 'more' : 'less'}
              </div>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="bg-surface-container-lowest p-md rounded-[24px] shadow-sm border border-outline-variant/30">
            <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface mb-md">Category Breakdown</h3>
            {pieData.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => `₹${value.toFixed(2)}`}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-center text-outline py-md">No expenses logged yet.</p>
            )}
          </div>

          {/* Monthly Trend */}
          <div className="bg-surface-container-lowest p-md rounded-[24px] shadow-sm border border-outline-variant/30">
            <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface mb-md">Daily Spend Trend</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ccc" opacity={0.3} />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#666' }} />
                  <YAxis hide={true} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                    formatter={(value: number) => [`₹${value.toFixed(2)}`, 'Spent']}
                    labelFormatter={(label) => `Day ${label}`}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="spent" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </main>
        <BottomNav />
      </div>
    </ProtectedRoute>
  );
}
