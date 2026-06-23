import { db } from "../firebase/client";
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp 
} from "firebase/firestore";
import { IncomeRecord } from "../../types";

export const IncomeService = {
  /**
   * Logs a new income record.
   * Format of monthKey: "YYYY-MM" (e.g. "2026-06")
   */
  async addIncomeRecord(
    createdByUserId: string,
    workspaceId: string,
    income: number,
    source: string,
    monthKey: string
  ): Promise<IncomeRecord> {
    const incomeCollectionRef = collection(db, "income_records");
    
    const [year, month] = monthKey.split("-").map(Number);
    const timeNow = new Date();

    const recordData: Omit<IncomeRecord, "id"> = {
      workspaceId,
      monthKey,
      month,
      year,
      income,
      source,
      createdAt: timeNow,
      updatedAt: timeNow,
      createdBy: createdByUserId,
    };

    const docRef = await addDoc(incomeCollectionRef, {
      ...recordData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return {
      id: docRef.id,
      ...recordData
    };
  },

  /**
   * Fetches all income records for a specific month.
   */
  async getIncomeRecordsByMonth(workspaceId: string, monthKey: string): Promise<IncomeRecord[]> {
    const incomeCollectionRef = collection(db, "income_records");
    const q = query(
      incomeCollectionRef,
      where("workspaceId", "==", workspaceId),
      where("monthKey", "==", monthKey)
    );

    const querySnapshot = await getDocs(q);
    const records: IncomeRecord[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      records.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as IncomeRecord);
    });

    return records;
  },

  /**
   * Calculates the total income for a workspace in a given month.
   */
  async getMonthlyTotalIncome(workspaceId: string, monthKey: string): Promise<number> {
    const records = await this.getIncomeRecordsByMonth(workspaceId, monthKey);
    return records.reduce((acc, curr) => acc + curr.income, 0);
  },

  /**
   * Deletes a specific income record.
   */
  async deleteIncomeRecord(recordId: string): Promise<void> {
    const docRef = doc(db, "income_records", recordId);
    await deleteDoc(docRef);
  }
};
