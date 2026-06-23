"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../context/auth-context";
import { ProtectedRoute } from "../../../components/auth/protected-route";
import { TaskService } from "../../../lib/services/task-service";
import { TodoTask } from "../../../types";

type FrequencyTab = "daily" | "weekly" | "monthly";

export default function TodosPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [tasks, setTasks] = useState<TodoTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState<FrequencyTab>("daily");

  // Create Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTaskStr, setNewTaskStr] = useState("");
  const [newTaskFreq, setNewTaskFreq] = useState<FrequencyTab>("daily");
  const [newTaskDateStr, setNewTaskDateStr] = useState("");
  const [savingTask, setSavingTask] = useState(false);

  const loadTasks = async () => {
    if (authLoading) return;
    if (!user || !profile) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const workspaceId = profile.activeWorkspaceId || user.uid;
      const fetchedTasks = await TaskService.getTasks(workspaceId);
      setTasks(fetchedTasks);
    } catch (err: any) {
      console.error("Load Tasks Error:", err);
      setError("Failed to load tasks.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [user, profile, authLoading]);

  // Handle Create Task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskStr.trim() || !newTaskDateStr || !user || !profile) return;

    setSavingTask(true);
    try {
      const workspaceId = profile.activeWorkspaceId || user.uid;
      const targetDate = new Date(newTaskDateStr + "T12:00:00");
      
      const created = await TaskService.addTask(
        user.uid,
        workspaceId,
        newTaskStr.trim(),
        newTaskFreq,
        targetDate
      );
      
      setTasks((prev) => [...prev, created].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime()));
      
      setShowAddModal(false);
      setNewTaskStr("");
      setNewTaskDateStr("");
    } catch (err: any) {
      console.error("Create Task Error:", err);
      alert("Failed to create task.");
    } finally {
      setSavingTask(false);
    }
  };

  // Handle Toggle Completion
  const handleToggleStatus = async (task: TodoTask) => {
    try {
      const newStatus = !task.isCompleted;
      // Optimistic update
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, isCompleted: newStatus } : t));
      await TaskService.toggleTaskStatus(task.id!, newStatus);
    } catch (err) {
      console.error("Toggle Status Error:", err);
      alert("Failed to update status.");
      // Revert optimistic update on failure
      loadTasks();
    }
  };

  // Handle Delete
  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    try {
      await TaskService.deleteTask(taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (err) {
      console.error("Delete Task Error:", err);
      alert("Failed to delete task.");
    }
  };

  const filteredTasks = tasks.filter(t => t.frequency === activeTab);
  const uncompleted = filteredTasks.filter(t => !t.isCompleted);
  const completed = filteredTasks.filter(t => t.isCompleted);

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen pb-32 bg-background flex justify-center items-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
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
            <h1 className="font-headline-md text-headline-md font-bold text-primary">Todos</h1>
          </div>
          <button 
            onClick={() => {
              setNewTaskFreq(activeTab);
              setShowAddModal(true);
            }}
            className="w-10 h-10 bg-primary text-on-primary rounded-full flex items-center justify-center hover:bg-on-primary-container transition-colors shadow-sm cursor-pointer"
          >
            <span className="material-symbols-outlined">add</span>
          </button>
        </header>

        <main className="px-container-margin space-y-md pt-md max-w-md mx-auto">
          {error && (
            <div className="p-md bg-error-container text-on-error-container rounded-lg font-label-sm text-label-sm">
              {error}
            </div>
          )}

          {/* Frequency Tabs */}
          <div className="flex bg-surface-container-lowest border border-outline-variant/30 rounded-full p-1 shadow-sm">
            {(["daily", "weekly", "monthly"] as FrequencyTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 rounded-full font-label-sm text-label-sm capitalize transition-all cursor-pointer ${
                  activeTab === tab
                    ? "bg-secondary-container text-on-secondary-container font-bold shadow-sm"
                    : "text-on-surface-variant hover:text-primary hover:bg-surface-container-low"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="mt-lg space-y-lg">
            
            {/* Uncompleted List */}
            <div className="space-y-sm">
              <h3 className="font-label-md text-label-md text-outline uppercase tracking-wider pl-xs">To Do</h3>
              {uncompleted.length === 0 ? (
                <div className="p-md border border-dashed border-outline-variant/30 rounded-xl text-center text-on-surface-variant font-body-md text-body-md">
                  No pending {activeTab} tasks.
                </div>
              ) : (
                <div className="space-y-xs">
                  {uncompleted.map(task => (
                    <div key={task.id} className="p-md bg-surface-container-lowest rounded-[16px] border border-outline-variant/20 flex justify-between items-center shadow-sm">
                      <div className="flex items-center gap-md">
                        <button 
                          onClick={() => handleToggleStatus(task)}
                          className="w-6 h-6 rounded-md border-2 border-outline flex items-center justify-center text-transparent hover:border-primary transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">check</span>
                        </button>
                        <div className="flex flex-col">
                          <span className="font-label-md text-label-md font-bold text-on-surface">{task.task}</span>
                          <span className="font-label-sm text-label-sm text-outline flex items-center gap-xs">
                            <span className="material-symbols-outlined text-[14px]">event</span>
                            {task.dueDate.toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDeleteTask(task.id!)}
                        className="w-8 h-8 rounded-full text-error flex items-center justify-center hover:bg-error-container/20 cursor-pointer transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Completed List */}
            {completed.length > 0 && (
              <div className="space-y-sm pt-md border-t border-outline-variant/20">
                <h3 className="font-label-md text-label-md text-outline uppercase tracking-wider pl-xs">Completed</h3>
                <div className="space-y-xs opacity-60">
                  {completed.map(task => (
                    <div key={task.id} className="p-md bg-surface-container-low rounded-[16px] border border-outline-variant/10 flex justify-between items-center">
                      <div className="flex items-center gap-md">
                        <button 
                          onClick={() => handleToggleStatus(task)}
                          className="w-6 h-6 rounded-md bg-primary border-2 border-primary flex items-center justify-center text-on-primary cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">check</span>
                        </button>
                        <div className="flex flex-col line-through">
                          <span className="font-label-md text-label-md font-bold text-on-surface">{task.task}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDeleteTask(task.id!)}
                        className="w-8 h-8 rounded-full text-error flex items-center justify-center hover:bg-error-container/20 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Add Modal Dialog */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm">
            <form 
              onSubmit={handleCreateTask}
              className="w-full max-w-md bg-surface rounded-t-[32px] p-lg shadow-2xl flex flex-col gap-md max-h-[90vh] overflow-y-auto border-t border-outline-variant/20 animate-slide-up"
            >
              <div className="flex justify-between items-center border-b border-outline-variant/15 pb-sm">
                <h2 className="font-headline-md text-headline-md font-bold">New Task</h2>
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-8 h-8 rounded-full bg-surface-container-low flex items-center justify-center text-outline cursor-pointer"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* Task Title */}
              <div className="space-y-xs">
                <label className="font-label-sm text-label-sm text-outline uppercase block">Task Description</label>
                <input 
                  type="text" 
                  value={newTaskStr}
                  onChange={(e) => setNewTaskStr(e.target.value)}
                  placeholder="Review upcoming bills"
                  required
                  className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary-container"
                />
              </div>

              {/* Due Date */}
              <div className="space-y-xs">
                <label className="font-label-sm text-label-sm text-outline uppercase block">Due Date</label>
                <input 
                  type="date" 
                  value={newTaskDateStr}
                  onChange={(e) => setNewTaskDateStr(e.target.value)}
                  required
                  className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary-container"
                />
              </div>

              {/* Frequency Selector */}
              <div className="space-y-xs">
                <label className="font-label-sm text-label-sm text-outline uppercase block">Frequency</label>
                <div className="flex gap-sm">
                  {(["daily", "weekly", "monthly"] as FrequencyTab[]).map(freq => (
                    <button
                      key={freq}
                      type="button"
                      onClick={() => setNewTaskFreq(freq)}
                      className={`flex-1 py-2 rounded-xl font-label-sm text-label-sm capitalize transition-all cursor-pointer ${
                        newTaskFreq === freq
                          ? "bg-secondary-container text-on-secondary-container font-bold border-2 border-primary"
                          : "bg-surface-container-lowest border-2 border-outline-variant/30 text-on-surface-variant"
                      }`}
                    >
                      {freq}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Submit */}
              <button 
                type="submit"
                disabled={savingTask || !newTaskStr.trim() || !newTaskDateStr}
                className="w-full mt-sm py-md bg-primary hover:bg-on-primary-container text-on-primary font-headline-md text-headline-md rounded-[16px] transition-all flex items-center justify-center gap-sm cursor-pointer shadow-lg disabled:opacity-50"
              >
                {savingTask ? (
                  <div className="w-6 h-6 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span className="material-symbols-outlined">add_task</span>
                    Create Task
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
