import { db } from "../firebase/client";
import { 
  collection, 
  doc, 
  getDoc,
  setDoc,
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter, 
  serverTimestamp,
  runTransaction,
  QueryDocumentSnapshot,
  DocumentData
} from "firebase/firestore";
import { ExpenseLog } from "../../types";

export const ExpenseService = {
  /**
   * Logs a new expense item.
   * Updates monthly aggregate document atomically.
   */
  async logExpense(
    createdByUserId: string,
    workspaceId: string,
    amount: number,
    note: string,
    wallet: string,
    category: { id: string; name: string; icon: string; color: string },
    expenseDate: Date = new Date(),
    tags: string[] = []
  ): Promise<ExpenseLog> {
    const expensesCollectionRef = collection(db, "expenses");
    
    const month = expenseDate.getMonth() + 1; // getMonth() is 0-indexed
    const year = expenseDate.getFullYear();
    const monthKey = `${year}-${String(month).padStart(2, "0")}`;

    const timeNow = new Date();
    const expenseData: Omit<ExpenseLog, "id"> = {
      userId: createdByUserId,
      workspaceId,
      amount,
      note,
      expenseDate,
      monthKey,
      month,
      year,
      wallet,
      category,
      tags,
      createdAt: timeNow,
      updatedAt: timeNow,
      createdBy: createdByUserId,
    };

    const expenseDocRef = doc(expensesCollectionRef);
    const aggregateDocRef = doc(db, "monthly_aggregates", `${workspaceId}_${monthKey}`);

    await runTransaction(db, async (transaction) => {
      // 1. Fetch current monthly aggregate
      const aggregateDoc = await transaction.get(aggregateDocRef);
      
      let totalSpent = amount;
      let transactionCount = 1;
      let categoryTotals: Record<string, number> = { [category.id]: amount };

      if (aggregateDoc.exists()) {
        const data = aggregateDoc.data();
        totalSpent = (data.totalSpent || 0) + amount;
        transactionCount = (data.transactionCount || 0) + 1;
        categoryTotals = { ...(data.categoryTotals || {}) };
        categoryTotals[category.id] = (categoryTotals[category.id] || 0) + amount;
      }

      // 2. Write Monthly Aggregate
      transaction.set(aggregateDocRef, {
        workspaceId,
        monthKey,
        month,
        year,
        totalSpent,
        transactionCount,
        categoryTotals,
        updatedAt: serverTimestamp()
      }, { merge: true });

      // 3. Write Expense Log
      transaction.set(expenseDocRef, {
        ...expenseData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    return {
      id: expenseDocRef.id,
      ...expenseData
    };
  },

  /**
   * Fetches paginated expenses for a month.
   */
  async getExpensesPaginated(
    workspaceId: string,
    startDate: Date,
    endDate: Date,
    pageSize: number = 20,
    lastVisibleDoc: QueryDocumentSnapshot<DocumentData> | null = null
  ): Promise<{ logs: ExpenseLog[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null }> {
    const expensesCollectionRef = collection(db, "expenses");
    
    let q = query(
      expensesCollectionRef,
      where("workspaceId", "==", workspaceId),
      where("expenseDate", ">=", startDate),
      where("expenseDate", "<=", endDate),
      orderBy("expenseDate", "desc"),
      limit(pageSize)
    );

    if (lastVisibleDoc) {
      q = query(q, startAfter(lastVisibleDoc));
    }

    const querySnapshot = await getDocs(q);
    const logs: ExpenseLog[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      logs.push({
        id: doc.id,
        ...data,
        expenseDate: data.expenseDate?.toDate() || new Date(data.createdAt),
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as ExpenseLog);
    });

    const lastDoc = querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] : null;

    return {
      logs,
      lastDoc
    };
  },

  /**
   * Deletes a logged expense.
   * Updates monthly aggregate document atomically.
   */
  async deleteExpense(expenseId: string): Promise<void> {
    const expenseDocRef = doc(db, "expenses", expenseId);

    await runTransaction(db, async (transaction) => {
      const expenseSnap = await transaction.get(expenseDocRef);
      if (!expenseSnap.exists()) {
        throw new Error("Expense document not found");
      }

      const expense = expenseSnap.data() as ExpenseLog;
      const workspaceId = expense.workspaceId;
      const monthKey = expense.monthKey;
      const amount = expense.amount;
      const categoryId = expense.category.id;

      const aggregateDocRef = doc(db, "monthly_aggregates", `${workspaceId}_${monthKey}`);

      // 1. Subtract from aggregate document
      const aggregateSnap = await transaction.get(aggregateDocRef);
      if (aggregateSnap.exists()) {
        const data = aggregateSnap.data();
        const totalSpent = Math.max(0, (data.totalSpent || 0) - amount);
        const transactionCount = Math.max(0, (data.transactionCount || 0) - 1);
        const categoryTotals = { ...(data.categoryTotals || {}) };
        categoryTotals[categoryId] = (categoryTotals[categoryId] || 0) - amount;
        
        if (categoryTotals[categoryId] <= 0) {
          delete categoryTotals[categoryId];
        }

        transaction.set(aggregateDocRef, {
          totalSpent,
          transactionCount,
          categoryTotals,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }

      // 2. Perform deletion
      transaction.delete(expenseDocRef);
    });
  },

  /**
   * Updates an existing expense item.
   * Handles multi-month data correction atomically.
   */
  async updateExpense(
    expenseId: string,
    amount: number,
    note: string,
    expenseDate: Date,
    wallet: string,
    category: { id: string; name: string; icon: string; color: string },
    tags: string[] = []
  ): Promise<void> {
    const expenseDocRef = doc(db, "expenses", expenseId);
    
    const newMonth = expenseDate.getMonth() + 1;
    const newYear = expenseDate.getFullYear();
    const newMonthKey = `${newYear}-${String(newMonth).padStart(2, "0")}`;

    await runTransaction(db, async (transaction) => {
      const expenseSnap = await transaction.get(expenseDocRef);
      if (!expenseSnap.exists()) {
        throw new Error("Expense document not found");
      }
      
      const oldExpense = expenseSnap.data() as ExpenseLog;
      const workspaceId = oldExpense.workspaceId;
      const oldMonth = oldExpense.month;
      const oldYear = oldExpense.year;
      const oldMonthKey = oldExpense.monthKey;
      const oldAmount = oldExpense.amount;
      const oldCategoryId = oldExpense.category.id;

      const oldAggregateDocRef = doc(db, "monthly_aggregates", `${workspaceId}_${oldMonthKey}`);
      const newAggregateDocRef = doc(db, "monthly_aggregates", `${workspaceId}_${newMonthKey}`);

      if (oldMonthKey === newMonthKey) {
        // Same month update
        const aggregateSnap = await transaction.get(oldAggregateDocRef);
        let totalSpent = amount;
        let transactionCount = 1;
        let categoryTotals: Record<string, number> = { [category.id]: amount };

        if (aggregateSnap.exists()) {
          const data = aggregateSnap.data();
          totalSpent = (data.totalSpent || 0) - oldAmount + amount;
          transactionCount = data.transactionCount || 1;
          categoryTotals = { ...(data.categoryTotals || {}) };
          
          categoryTotals[oldCategoryId] = (categoryTotals[oldCategoryId] || 0) - oldAmount;
          categoryTotals[category.id] = (categoryTotals[category.id] || 0) + amount;
          
          if (categoryTotals[oldCategoryId] <= 0) {
            delete categoryTotals[oldCategoryId];
          }
        }

        transaction.set(oldAggregateDocRef, {
          workspaceId,
          monthKey: oldMonthKey,
          month: oldMonth,
          year: oldYear,
          totalSpent,
          transactionCount,
          categoryTotals,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } else {
        // Different month update
        // 1. Deduct from old month aggregate
        const oldAggregateSnap = await transaction.get(oldAggregateDocRef);
        if (oldAggregateSnap.exists()) {
          const data = oldAggregateSnap.data();
          const totalSpent = Math.max(0, (data.totalSpent || 0) - oldAmount);
          const transactionCount = Math.max(0, (data.transactionCount || 0) - 1);
          const categoryTotals = { ...(data.categoryTotals || {}) };
          categoryTotals[oldCategoryId] = (categoryTotals[oldCategoryId] || 0) - oldAmount;
          if (categoryTotals[oldCategoryId] <= 0) {
            delete categoryTotals[oldCategoryId];
          }
          
          transaction.set(oldAggregateDocRef, {
            totalSpent,
            transactionCount,
            categoryTotals,
            updatedAt: serverTimestamp()
          }, { merge: true });
        }

        // 2. Add to new month aggregate
        const newAggregateSnap = await transaction.get(newAggregateDocRef);
        let totalSpent = amount;
        let transactionCount = 1;
        let categoryTotals: Record<string, number> = { [category.id]: amount };

        if (newAggregateSnap.exists()) {
          const data = newAggregateSnap.data();
          totalSpent = (data.totalSpent || 0) + amount;
          transactionCount = (data.transactionCount || 0) + 1;
          categoryTotals = { ...(data.categoryTotals || {}) };
          categoryTotals[category.id] = (categoryTotals[category.id] || 0) + amount;
        }

        transaction.set(newAggregateDocRef, {
          workspaceId,
          monthKey: newMonthKey,
          month: newMonth,
          year: newYear,
          totalSpent,
          transactionCount,
          categoryTotals,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }

      // 3. Update expense document fields
      transaction.update(expenseDocRef, {
        amount,
        note,
        expenseDate,
        month: newMonth,
        year: newYear,
        monthKey: newMonthKey,
        wallet,
        category,
        tags,
        updatedAt: serverTimestamp()
      });
    });
  },

  /**
   * Fetches monthly aggregates for a given month and workspace.
   * Includes auto-seeding legacy testing data for mathematical consistency.
   */
  async getMonthlyAggregate(
    workspaceId: string,
    monthKey: string
  ): Promise<{ totalSpent: number; transactionCount: number; categoryTotals: Record<string, number> }> {
    const docRef = doc(db, "monthly_aggregates", `${workspaceId}_${monthKey}`);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        totalSpent: data.totalSpent || 0,
        transactionCount: data.transactionCount || 0,
        categoryTotals: data.categoryTotals || {},
      };
    }
    
    // Auto-seed: If aggregate missing, fetch all expenses for this month to sync
    try {
      const expensesCollectionRef = collection(db, "expenses");
      const q = query(
        expensesCollectionRef,
        where("workspaceId", "==", workspaceId),
        where("monthKey", "==", monthKey)
      );
      const querySnapshot = await getDocs(q);
      
      let totalSpent = 0;
      let transactionCount = 0;
      const categoryTotals: Record<string, number> = {};
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const amt = data.amount || 0;
        totalSpent += amt;
        transactionCount += 1;
        if (data.category?.id) {
          categoryTotals[data.category.id] = (categoryTotals[data.category.id] || 0) + amt;
        }
      });
      
      if (transactionCount > 0) {
        const [year, month] = monthKey.split("-").map(Number);
        await setDoc(docRef, {
          workspaceId,
          monthKey,
          month,
          year,
          totalSpent,
          transactionCount,
          categoryTotals,
          updatedAt: serverTimestamp()
        });
      }
      
      return {
        totalSpent,
        transactionCount,
        categoryTotals
      };
    } catch (err) {
      console.error("Auto-seeding monthly aggregate failed:", err);
      return {
        totalSpent: 0,
        transactionCount: 0,
        categoryTotals: {},
      };
    }
  }
};
