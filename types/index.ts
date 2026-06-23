export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  currency: string;             // default "INR"
  createdAt: Date;
  onboarded: boolean;           // true if Onboarding is complete
  theme: "light" | "dark";
  notifications: boolean;
  activeWorkspaceId: string;    // Defaults to uid, changes if they join a shared group
}

export interface FixedExpense {
  category: string;
  amount: number;
  isPaid: boolean;
}

export interface BudgetConfig {
  id?: string;                  // Firestore document ID
  workspaceId: string;          // Target workspace
  monthYear: string;            // Format: "MM-YYYY" (e.g., "10-2023")
  monthKey: string;             // Format: "YYYY-MM" (e.g., "2023-10")
  month: number;                // 1 - 12
  year: number;                 // e.g. 2026
  income: number;               // Monthly income source
  monthlyBudget: number;        // Target budget spending cap
  dailyTarget: number;          // Calculated: (monthlyBudget - SumOf(FixedExpenses)) / DaysInMonth
  fixedExpenses: FixedExpense[];
  
  // Auditing Fields
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface IncomeRecord {
  id?: string;                  // Firestore document ID
  workspaceId: string;
  monthKey: string;             // Format: "YYYY-MM"
  month: number;                // 1 - 12
  year: number;                 // e.g. 2026
  income: number;
  source: string;               // e.g. "Salary", "Freelance"

  // Auditing Fields
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface ExpenseLog {
  id?: string;
  userId: string;               // Creator of the log
  workspaceId: string;          // Used for queries (allows group sharing)
  amount: number;
  note: string;
  expenseDate: Date;            // Historical date of expense execution
  monthKey: string;             // Format: "YYYY-MM"
  month: number;                // 1 - 12
  year: number;                 // e.g. 2026
  wallet: string;               // e.g. "Main Card", "Cash", "UPI"
  
  // Category Denormalization (Mitigates Read Costs)
  category: {
    id: string;
    name: string;
    icon: string;
    color: string;
  };

  // AI & Budgeting Tags
  tags?: string[];             // e.g., ["discretionary", "wants", "needs"]
  
  // Receipt Attachment Support (Phase 2)
  attachments?: Array<{
    fileUrl: string;
    uploadedAt: Date;
    mimeType: string;
  }>;

  // Recurring bills template metadata (Phase 2)
  recurring?: {
    isRecurring: boolean;
    frequency: "weekly" | "monthly" | "yearly";
    nextDueDate?: Date;
    parentId?: string;
  };

  // Auditing Fields
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface CategoryItem {
  id: string;                   // E.g., system categories or custom hashes
  scope: "personal" | "workspace";
  ownerUserId: string;          // Individual owner
  workspaceId?: string;         // Associated workspace (optional)
  name: string;
  icon: string;                 // Material Icon string
  color: string;                // Hex string color
  transactionCount: number;

  // Auditing Fields
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface TodoTask {
  id?: string;
  userId: string;
  workspaceId: string;
  task: string;
  frequency: "daily" | "weekly" | "monthly";
  dueDate: Date;
  isCompleted: boolean;

  // Auditing Fields
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface SavingsGoal {
  id?: string;
  workspaceId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  dueDate?: Date;

  // Auditing Fields
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface BudgetHealthMetrics {
  score: number;                   // Value from 0 to 100
  status: "healthy" | "warning" | "critical" | "overspent";
}
