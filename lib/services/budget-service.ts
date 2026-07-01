import { db } from "../firebase/client";
import { 
  collection,
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  addDoc,
  query,
  where,
  limit,
  getDocs,
  serverTimestamp 
} from "firebase/firestore";
import { BudgetConfig, FixedExpense, UserProfile } from "../../types";

export const BudgetService = {
  /**
   * Fetches the budget configuration for a specific month and workspace.
   * Format of monthKey: "YYYY-MM" (e.g. "2026-06")
   */
  async getCurrentBudget(workspaceId: string, monthKey: string): Promise<BudgetConfig | null> {
    const budgetsRef = collection(db, "budgets");
    const q = query(
      budgetsRef,
      where("workspaceId", "==", workspaceId),
      where("monthKey", "==", monthKey),
      limit(1)
    );
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const budgetDoc = querySnapshot.docs[0];
      const data = budgetDoc.data();
      return {
        id: budgetDoc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as BudgetConfig;
    }
    return null;
  },

  /**
   * Sets up or updates the budget configuration. Calculates the dailyTarget parameter.
   */
  async saveBudget(
    createdByUserId: string,
    workspaceId: string,
    monthKey: string,
    income: number,
    monthlyBudget: number,
    fixedExpenses: FixedExpense[]
  ): Promise<BudgetConfig> {
    const budgetsRef = collection(db, "budgets");
    const q = query(
      budgetsRef,
      where("workspaceId", "==", workspaceId),
      where("monthKey", "==", monthKey),
      limit(1)
    );
    const querySnapshot = await getDocs(q);
    const timeNow = new Date();
    
    // Calculate daily target spending limit
    const [year, month] = monthKey.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const totalFixed = fixedExpenses.reduce((acc, curr) => acc + curr.amount, 0);
    const dailyTarget = Math.max(0, (monthlyBudget - totalFixed) / daysInMonth);

    // Compute legacy monthYear for structural safety
    const monthYear = `${String(month).padStart(2, "0")}-${year}`;

    if (!querySnapshot.empty) {
      const budgetDoc = querySnapshot.docs[0];
      const existingData = budgetDoc.data() as BudgetConfig;
      
      const budgetData: BudgetConfig = {
        workspaceId,
        monthYear,
        monthKey,
        month,
        year,
        income,
        monthlyBudget,
        dailyTarget,
        fixedExpenses,
        createdAt: existingData.createdAt || timeNow,
        updatedAt: timeNow,
        createdBy: existingData.createdBy || createdByUserId,
      };

      await updateDoc(doc(db, "budgets", budgetDoc.id), {
        ...budgetData,
        updatedAt: serverTimestamp()
      });
      
      return { id: budgetDoc.id, ...budgetData };
    } else {
      const budgetData: BudgetConfig = {
        workspaceId,
        monthYear,
        monthKey,
        month,
        year,
        income,
        monthlyBudget,
        dailyTarget,
        fixedExpenses,
        createdAt: timeNow,
        updatedAt: timeNow,
        createdBy: createdByUserId,
      };

      const docRef = await addDoc(budgetsRef, {
        ...budgetData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      return { id: docRef.id, ...budgetData };
    }
  },

  /**
   * Completes onboarding by saving initial budget and updating user onboarded flag.
   */
  async completeOnboarding(
    userId: string,
    workspaceId: string,
    monthKey: string,
    income: number,
    monthlyBudget: number,
    fixedExpenses: FixedExpense[]
  ): Promise<void> {
    // 1. Save target budget config
    await this.saveBudget(userId, workspaceId, monthKey, income, monthlyBudget, fixedExpenses);

    // 2. Mark user profile as onboarded
    const userDocRef = doc(db, "users", userId);
    await updateDoc(userDocRef, {
      onboarded: true,
      activeWorkspaceId: workspaceId,
    });
  },
  /**
   * Copies the budget configuration from the previous month to the given monthKey.
   * Returns the new budget if found, or null if no previous month budget exists.
   */
  async copyFromPreviousMonth(
    userId: string,
    workspaceId: string,
    monthKey: string
  ): Promise<BudgetConfig | null> {
    // Derive the previous month key
    const [year, month] = monthKey.split("-").map(Number);
    const prevDate = new Date(year, month - 2, 1); // month-2 because month is 1-indexed and Date is 0-indexed
    const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

    // Fetch previous month budget
    const prevBudget = await this.getCurrentBudget(workspaceId, prevMonthKey);
    if (!prevBudget) return null;

    // Save a copy for the new month
    return this.saveBudget(
      userId,
      workspaceId,
      monthKey,
      prevBudget.income,
      prevBudget.monthlyBudget,
      // Reset isPaid to false for the new month — bills start unpaid
      prevBudget.fixedExpenses.map(e => ({ ...e, isPaid: false }))
    );
  },
};
