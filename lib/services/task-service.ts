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
  orderBy, 
  serverTimestamp 
} from "firebase/firestore";
import { TodoTask } from "../../types";

export const TaskService = {
  /**
   * Fetches all tasks for a specific workspace.
   */
  async getTasks(workspaceId: string): Promise<TodoTask[]> {
    const tasksCollectionRef = collection(db, "todos");
    const q = query(
      tasksCollectionRef,
      where("workspaceId", "==", workspaceId),
      orderBy("dueDate", "asc")
    );

    const querySnapshot = await getDocs(q);
    const tasks: TodoTask[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      tasks.push({
        id: doc.id,
        ...data,
        dueDate: data.dueDate?.toDate() || new Date(),
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as TodoTask);
    });

    return tasks;
  },

  /**
   * Adds a new financial task.
   */
  async addTask(
    createdByUserId: string,
    workspaceId: string,
    task: string,
    frequency: "daily" | "weekly" | "monthly",
    dueDate: Date
  ): Promise<TodoTask> {
    const tasksCollectionRef = collection(db, "todos");
    
    const timeNow = new Date();
    const taskData: Omit<TodoTask, "id"> = {
      userId: createdByUserId,
      workspaceId,
      task,
      frequency,
      dueDate,
      isCompleted: false,
      createdAt: timeNow,
      updatedAt: timeNow,
      createdBy: createdByUserId,
    };

    const docRef = await addDoc(tasksCollectionRef, {
      ...taskData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return {
      id: docRef.id,
      ...taskData
    };
  },

  /**
   * Toggles task completion state.
   */
  async toggleTaskStatus(taskId: string, isCompleted: boolean): Promise<void> {
    const docRef = doc(db, "todos", taskId);
    await updateDoc(docRef, {
      isCompleted,
      updatedAt: serverTimestamp(),
    });
  },

  /**
   * Deletes a task.
   */
  async deleteTask(taskId: string): Promise<void> {
    const docRef = doc(db, "todos", taskId);
    await deleteDoc(docRef);
  }
};
