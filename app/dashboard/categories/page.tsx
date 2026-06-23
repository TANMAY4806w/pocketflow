"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../context/auth-context";
import { ProtectedRoute } from "../../../components/auth/protected-route";
import { CategoryService } from "../../../lib/services/category-service";
import { CategoryItem } from "../../../types";

function CategoriesContent() {
  const { user, profile } = useAuth();
  const router = useRouter();
  
  // Data States
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form / Modal States
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  // Inputs
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"personal" | "workspace">("workspace");
  const [selectedIcon, setSelectedIcon] = useState("restaurant");
  const [selectedColor, setSelectedColor] = useState("#10b981");
  const [saving, setSaving] = useState(false);

  // Presets
  const presetIcons = [
    "restaurant", "home", "commute", "pending_actions", 
    "local_mall", "fitness_center", "movie", "school", 
    "medical_services", "savings", "redeem", "flight"
  ];

  const presetColors = [
    "#10b981", "#ef4444", "#3b82f6", "#8b5cf6", 
    "#f59e0b", "#06b6d4", "#ec4899", "#6366f1", "#f97316"
  ];

  const fetchCategories = async () => {
    if (!user || !profile) return;
    try {
      const workspaceId = profile.activeWorkspaceId || user.uid;
      
      // Seed defaults if list empty
      await CategoryService.seedDefaultCategories(user.uid, workspaceId);
      
      const loaded = await CategoryService.getCategories(workspaceId, user.uid);
      setCategories(loaded);
    } catch (err: any) {
      console.error("Fetch Categories Error:", err);
      setError("Failed to load categories.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [user, profile]);

  const handleOpenCreate = () => {
    setModalMode("create");
    setSelectedCategoryId(null);
    setName("");
    setScope("workspace");
    setSelectedIcon("restaurant");
    setSelectedColor("#10b981");
    setError(null);
    setSuccessMessage(null);
    setShowModal(true);
  };

  const handleOpenEdit = (cat: CategoryItem) => {
    setModalMode("edit");
    setSelectedCategoryId(cat.id);
    setName(cat.name);
    setScope(cat.scope);
    setSelectedIcon(cat.icon);
    setSelectedColor(cat.color);
    setError(null);
    setSuccessMessage(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (!user || !profile) return;

    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const workspaceId = profile.activeWorkspaceId || user.uid;
      
      if (modalMode === "create") {
        await CategoryService.createCategory(
          user.uid,
          workspaceId,
          name.trim(),
          selectedIcon,
          selectedColor,
          scope
        );
        setSuccessMessage("Category created successfully!");
      } else if (modalMode === "edit" && selectedCategoryId) {
        await CategoryService.updateCategory(
          selectedCategoryId,
          name.trim(),
          selectedIcon,
          selectedColor
        );
        setSuccessMessage("Category updated successfully!");
      }

      setShowModal(false);
      await fetchCategories();
    } catch (err: any) {
      console.error("Save Category Error:", err);
      setError(err.message || "Failed to save category.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (categoryId: string) => {
    if (!confirm("Are you sure you want to delete this category?")) return;
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await CategoryService.deleteCategory(categoryId);
      if (result.success) {
        setSuccessMessage(result.message);
        await fetchCategories();
      } else {
        setError(result.message);
      }
    } catch (err: any) {
      console.error("Delete Category Error:", err);
      setError("An error occurred during category deletion.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-on-background">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32 overflow-x-hidden bg-background text-on-surface">
      
      {/* Top Navigation Bar */}
      <header className="w-full top-0 sticky z-40 bg-surface/90 backdrop-blur-md flex justify-between items-center px-container-margin py-md border-b border-outline-variant/10">
        <div className="flex items-center gap-sm">
          <button 
            onClick={() => router.push("/dashboard")}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-low transition-colors text-outline cursor-pointer"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="font-headline-md text-headline-md font-bold text-primary">Manage Categories</h1>
        </div>
        <button 
          onClick={handleOpenCreate}
          className="w-10 h-10 bg-primary text-on-primary flex items-center justify-center rounded-full shadow-md cursor-pointer hover:bg-on-primary-container transition-colors active:scale-95"
          title="Create Custom Category"
        >
          <span className="material-symbols-outlined">add</span>
        </button>
      </header>

      {/* Main Container */}
      <main className="px-container-margin space-y-lg pt-md max-w-md mx-auto">

        {/* Messaging Logs */}
        {error && (
          <div className="p-md bg-error-container text-on-error-container rounded-lg font-label-sm text-label-sm flex items-center gap-sm shadow-sm">
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
            <span>{error}</span>
          </div>
        )}
        {successMessage && (
          <div className="p-md bg-secondary-container text-on-secondary-container rounded-lg font-label-sm text-label-sm flex items-center gap-sm shadow-sm">
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            <span>{successMessage}</span>
          </div>
        )}

        {/* List of Custom Categories */}
        <section className="space-y-sm">
          <div className="flex justify-between items-center">
            <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Active Category List</span>
            <span className="font-label-sm text-label-sm text-outline-variant">{categories.length} total</span>
          </div>

          <div className="space-y-xs">
            {categories.map((cat) => (
              <div 
                key={cat.id} 
                className="p-md bg-surface-container-lowest rounded-[16px] border border-outline-variant/20 flex justify-between items-center shadow-sm hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center gap-sm">
                  {/* Category Visual Circle */}
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white" 
                    style={{ backgroundColor: cat.color }}
                  >
                    <span className="material-symbols-outlined">{cat.icon}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-label-md text-label-md font-bold text-on-surface leading-snug">{cat.name}</span>
                    <span className="font-label-sm text-label-sm text-outline flex items-center gap-xs">
                      {cat.scope === "personal" ? (
                        <>
                          <span className="material-symbols-outlined text-[14px]">person</span>
                          Personal
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[14px]">groups</span>
                          Workspace
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* CRUD Controls (Do not edit system defaults) */}
                {cat.ownerUserId !== "system" ? (
                  <div className="flex items-center gap-xs">
                    <button 
                      onClick={() => handleOpenEdit(cat)}
                      className="w-8 h-8 rounded-full bg-surface-container-low text-on-surface-variant flex items-center justify-center cursor-pointer hover:bg-surface-container-high transition-colors"
                      title="Edit"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button 
                      onClick={() => handleDelete(cat.id)}
                      className="w-8 h-8 rounded-full bg-error-container/20 text-error flex items-center justify-center cursor-pointer hover:bg-error-container/40 transition-colors"
                      title="Delete"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                ) : (
                  <span className="font-label-sm text-label-sm text-outline italic">System default</span>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Create / Edit Modal Dialog */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm">
          <form 
            onSubmit={handleSubmit}
            className="w-full max-w-md bg-surface rounded-t-[32px] p-lg shadow-2xl flex flex-col gap-md max-h-[90vh] overflow-y-auto border-t border-outline-variant/20 animate-slide-up"
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-outline-variant/15 pb-sm">
              <h2 className="font-headline-md text-headline-md font-bold">
                {modalMode === "create" ? "Add Custom Category" : "Edit Category"}
              </h2>
              <button 
                type="button"
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full bg-surface-container-low flex items-center justify-center text-outline cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Input name */}
            <div className="space-y-xs">
              <label className="font-label-sm text-label-sm text-outline uppercase tracking-wider block">Category Name</label>
              <input 
                autoFocus
                type="text" 
                placeholder="e.g. Subscriptions" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                required
                className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary-container"
              />
            </div>

            {/* Toggle Scope */}
            {modalMode === "create" && (
              <div className="space-y-xs">
                <label className="font-label-sm text-label-sm text-outline uppercase tracking-wider block">Scope Profile</label>
                <div className="grid grid-cols-2 gap-sm">
                  <button
                    type="button"
                    onClick={() => setScope("personal")}
                    className={`py-2 border rounded-xl font-label-sm text-label-sm flex items-center justify-center gap-xs cursor-pointer ${
                      scope === "personal" 
                        ? "border-primary bg-secondary-container/30 text-primary font-semibold" 
                        : "border-outline-variant/40 bg-surface-container-lowest text-outline"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">person</span>
                    Personal
                  </button>
                  <button
                    type="button"
                    onClick={() => setScope("workspace")}
                    className={`py-2 border rounded-xl font-label-sm text-label-sm flex items-center justify-center gap-xs cursor-pointer ${
                      scope === "workspace" 
                        ? "border-primary bg-secondary-container/30 text-primary font-semibold" 
                        : "border-outline-variant/40 bg-surface-container-lowest text-outline"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">groups</span>
                    Workspace
                  </button>
                </div>
              </div>
            )}

            {/* Grid of Icon Options */}
            <div className="space-y-xs">
              <label className="font-label-sm text-label-sm text-outline uppercase tracking-wider block">Select Graphic Icon</label>
              <div className="grid grid-cols-6 gap-sm">
                {presetIcons.map((ico) => (
                  <button
                    key={ico}
                    type="button"
                    onClick={() => setSelectedIcon(ico)}
                    className={`w-12 h-12 rounded-xl flex items-center justify-center cursor-pointer active:scale-95 transition-all ${
                      selectedIcon === ico 
                        ? "bg-primary text-on-primary shadow-md"
                        : "bg-surface-container-low hover:bg-surface-container-high text-outline"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[24px]">{ico}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Grid of Colors */}
            <div className="space-y-xs">
              <label className="font-label-sm text-label-sm text-outline uppercase tracking-wider block">Select Theme Color</label>
              <div className="grid grid-cols-9 gap-sm">
                {presetColors.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setSelectedColor(col)}
                    className={`w-8 h-8 rounded-full border-2 cursor-pointer active:scale-95 transition-all ${
                      selectedColor === col 
                        ? "border-on-surface scale-110 shadow-sm"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: col }}
                  />
                ))}
              </div>
            </div>

            {/* Action Submit */}
            <button 
              type="submit"
              disabled={saving || !name.trim()}
              className="w-full py-md bg-primary hover:bg-on-primary-container text-on-primary font-headline-md text-headline-md rounded-[16px] transition-all flex items-center justify-center gap-sm cursor-pointer shadow-lg disabled:opacity-50 disabled:cursor-not-allowed mt-sm"
            >
              {saving ? (
                <div className="w-6 h-6 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span className="material-symbols-outlined">check</span>
                  Save Category
                </>
              )}
            </button>

          </form>
        </div>
      )}

      {/* Ambient backgrounds */}
      <div className="fixed inset-0 -z-10 pointer-events-none opacity-40 overflow-hidden">
        <div className="absolute top-[10%] right-[-10%] w-96 h-96 bg-primary/5 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[10%] left-[-10%] w-[500px] h-[500px] bg-secondary-container/10 rounded-full blur-[120px]"></div>
      </div>
      
    </div>
  );
}

export default function CategoriesPage() {
  return (
    <ProtectedRoute>
      <CategoriesContent />
    </ProtectedRoute>
  );
}
