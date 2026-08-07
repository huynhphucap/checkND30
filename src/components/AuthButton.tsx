"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { LogIn, LogOut } from "lucide-react";
import { getFirebaseAuth, googleProvider } from "@/lib/firebase/client";

export default function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setReady(true);
    });
    return unsubscribe;
  }, []);

  async function handleSignIn() {
    setBusy(true);
    try {
      await signInWithPopup(getFirebaseAuth(), googleProvider);
    } catch {
      // Người dùng đóng popup hoặc bị chặn - bỏ qua, không cần báo lỗi ồn ào.
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    await signOut(getFirebaseAuth());
  }

  if (!ready) {
    return <div className="h-9 w-40" />;
  }

  if (!user) {
    return (
      <button
        type="button"
        onClick={handleSignIn}
        disabled={busy}
        className="inline-flex items-center gap-2 text-sm font-medium rounded-full bg-[var(--card)] border border-[var(--border)] pl-3 pr-4 py-1.5 shadow-sm hover:shadow-md hover:border-[var(--accent)]/40 transition-all disabled:opacity-60"
      >
        <LogIn className="w-4 h-4 text-[var(--accent)]" strokeWidth={2} />
        Đăng nhập với Google
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-full bg-[var(--card)] border border-[var(--border)] pl-1.5 pr-1.5 py-1.5 shadow-sm">
      {user.photoURL ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.photoURL} alt="" className="w-6 h-6 rounded-full" referrerPolicy="no-referrer" />
      ) : (
        <div className="w-6 h-6 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] text-xs font-semibold flex items-center justify-center">
          {(user.email ?? "?")[0]?.toUpperCase()}
        </div>
      )}
      <span className="text-sm text-black/70 dark:text-white/70 max-w-[10rem] truncate">
        {user.email}
      </span>
      <button
        type="button"
        onClick={handleSignOut}
        title="Đăng xuất"
        className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
      >
        <LogOut className="w-4 h-4 text-black/50 dark:text-white/50" strokeWidth={2} />
      </button>
    </div>
  );
}
