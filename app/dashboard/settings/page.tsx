"use client";

import { useAuth } from "../../../context/auth-context";
import { useRouter } from "next/navigation";
import { AuthService } from "../../../lib/services/auth-service";
import { useState } from "react";
import Link from "next/link";

export default function SettingsPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignOut = async () => {
    try {
      setLoading(true);
      await AuthService.signOutUser();
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Failed to sign out.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmDelete = window.confirm(
      "Are you absolutely sure you want to delete your account? This action cannot be undone and you will lose access to all your financial data."
    );
    if (!confirmDelete) return;

    try {
      setLoading(true);
      await AuthService.deleteAccount();
      router.push("/");
    } catch (err: any) {
      if (err.code === "auth/requires-recent-login") {
        setError("For security reasons, you must sign out and sign back in before deleting your account.");
      } else {
        setError(err.message || "Failed to delete account.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-surface pb-32">
      {/* Top App Bar */}
      <header className="sticky top-0 z-40 bg-surface/80 backdrop-blur-md flex items-center px-container-margin py-md border-b border-outline-variant/20">
        <Link href="/dashboard" className="w-12 h-12 flex items-center justify-center -ml-3 rounded-full hover:bg-surface-container transition-colors active:bg-surface-container-high">
          <span className="material-symbols-outlined text-[24px]">arrow_back</span>
        </Link>
        <h1 className="font-headline-sm text-headline-sm flex-1 text-center pr-9">Settings</h1>
      </header>

      <main className="px-container-margin py-xl space-y-xl w-full max-w-[448px] md:max-w-[768px] mx-auto">
        {/* Profile Info */}
        <section className="flex flex-col items-center bg-surface-container-lowest border border-outline-variant/30 rounded-[24px] p-lg shadow-sm">
          <div className="w-24 h-24 rounded-full overflow-hidden mb-md border-4 border-primary-container shadow-md">
            {profile?.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-primary flex items-center justify-center text-on-primary font-headline-lg text-headline-lg">
                {profile?.displayName?.charAt(0) || user?.email?.charAt(0) || "U"}
              </div>
            )}
          </div>
          <h2 className="font-headline-md text-headline-md text-on-surface font-bold">{profile?.displayName || "User"}</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">{user?.email}</p>
        </section>

        {error && (
          <div className="bg-error-container text-on-error-container p-md rounded-xl font-body-sm text-body-sm">
            {error}
          </div>
        )}

        {/* Account Actions */}
        <section className="space-y-sm">
          <h3 className="font-label-md text-label-md text-primary uppercase tracking-wider mb-sm pl-xs">Account Management</h3>
          
          <button 
            onClick={handleSignOut}
            disabled={loading}
            className="w-full flex items-center justify-between p-md bg-surface-container-lowest hover:bg-surface-container-low border border-outline-variant/30 rounded-[16px] transition-colors"
          >
            <div className="flex items-center gap-md text-on-surface">
              <span className="material-symbols-outlined text-outline">logout</span>
              <span className="font-label-md text-label-md font-bold">Sign Out</span>
            </div>
            <span className="material-symbols-outlined text-outline-variant">chevron_right</span>
          </button>
        </section>

        {/* Danger Zone */}
        <section className="space-y-sm pt-md">
          <h3 className="font-label-md text-label-md text-error uppercase tracking-wider mb-sm pl-xs">Danger Zone</h3>
          
          <button 
            onClick={handleDeleteAccount}
            disabled={loading}
            className="w-full flex items-center justify-between p-md bg-error-container/30 hover:bg-error-container/50 border border-error/20 rounded-[16px] transition-colors"
          >
            <div className="flex items-center gap-md text-error">
              <span className="material-symbols-outlined">delete_forever</span>
              <div className="text-left">
                <span className="font-label-md text-label-md font-bold block">Delete Account</span>
                <span className="font-label-sm text-label-sm opacity-80">Permanently erase your data</span>
              </div>
            </div>
            <span className="material-symbols-outlined text-error/50">chevron_right</span>
          </button>
        </section>
      </main>
    </div>
  );
}
