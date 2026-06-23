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
  limit, 
  serverTimestamp 
} from "firebase/firestore";
import { CategoryItem } from "../../types";

export const CategoryService = {
  /**
   * Fetches all categories available to a workspace.
   * Includes system-wide categories, workspace-specific categories, and personal categories.
   */
  async getCategories(workspaceId: string, userId: string): Promise<CategoryItem[]> {
    const categoriesRef = collection(db, "categories");
    
    // We execute queries to get system defaults + workspace/personal categories
    const qSystem = query(categoriesRef, where("ownerUserId", "==", "system"));
    const qWorkspace = query(categoriesRef, where("workspaceId", "==", workspaceId));
    const qPersonal = query(categoriesRef, where("ownerUserId", "==", userId), where("scope", "==", "personal"));

    const [systemSnap, workspaceSnap, personalSnap] = await Promise.all([
      getDocs(qSystem),
      getDocs(qWorkspace),
      getDocs(qPersonal)
    ]);

    const categoriesMap = new Map<string, CategoryItem>();

    const processSnapshot = (snap: any) => {
      snap.forEach((doc: any) => {
        const data = doc.data();
        categoriesMap.set(doc.id, {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as CategoryItem);
      });
    };

    processSnapshot(systemSnap);
    processSnapshot(workspaceSnap);
    processSnapshot(personalSnap);

    return Array.from(categoriesMap.values());
  },

  /**
   * Creates a new custom category.
   */
  async createCategory(
    createdByUserId: string,
    workspaceId: string,
    name: string,
    icon: string,
    color: string,
    scope: "personal" | "workspace"
  ): Promise<CategoryItem> {
    const categoriesRef = collection(db, "categories");
    
    const timeNow = new Date();
    const categoryData: Omit<CategoryItem, "id"> = {
      scope,
      ownerUserId: createdByUserId,
      workspaceId: scope === "workspace" ? workspaceId : undefined,
      name,
      icon,
      color,
      transactionCount: 0,
      createdAt: timeNow,
      updatedAt: timeNow,
      createdBy: createdByUserId,
    };

    const docRef = await addDoc(categoriesRef, {
      ...categoryData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return {
      id: docRef.id,
      ...categoryData
    };
  },

  /**
   * Edits an existing custom category.
   */
  async updateCategory(
    categoryId: string,
    name: string,
    icon: string,
    color: string
  ): Promise<void> {
    const docRef = doc(db, "categories", categoryId);
    await updateDoc(docRef, {
      name,
      icon,
      color,
      updatedAt: serverTimestamp(),
    });
  },

  /**
   * Deletes a category.
   * Prevents deletion if the category is currently referenced by any expense logs.
   */
  async deleteCategory(categoryId: string): Promise<{ success: boolean; message: string }> {
    // 1. Verify if any expenses use this category ID
    const expensesRef = collection(db, "expenses");
    const q = query(expensesRef, where("category.id", "==", categoryId), limit(1));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      return {
        success: false,
        message: "This category is currently referenced by logged expenses. Please reassign or delete those expenses first."
      };
    }

    // 2. Perform deletion
    const docRef = doc(db, "categories", categoryId);
    await deleteDoc(docRef);
    
    return {
      success: true,
      message: "Category deleted successfully."
    };
  },

  /**
   * Seed default system categories for workspace setup.
   */
  async seedDefaultCategories(createdByUserId: string, workspaceId: string): Promise<void> {
    const categories = await this.getCategories(workspaceId, createdByUserId);
    
    // Seed default cards only if there are no categories
    if (categories.length === 0) {
      const defaults = [
        { name: "Food", icon: "restaurant", color: "#10b981" },
        { name: "Rent", icon: "home", color: "#ef4444" },
        { name: "Travel", icon: "commute", color: "#3b82f6" },
        { name: "Other", icon: "pending_actions", color: "#8b5cf6" },
      ];

      for (const cat of defaults) {
        await this.createCategory(
          createdByUserId,
          workspaceId,
          cat.name,
          cat.icon,
          cat.color,
          "workspace"
        );
      }
    }
  }
};
