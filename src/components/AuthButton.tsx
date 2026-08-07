"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { getFirebaseAuth, googleProvider } from "@/lib/firebase/client";

export default function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setReady(true);
    });
    return unsubscribe;
  }, []);

  async function handleSignIn() {
    await signInWithPopup(getFirebaseAuth(), googleProvider);
  }

  async function handleSignOut() {
    await signOut(getFirebaseAuth());
  }

  if (!ready) {
    return <div className="h-8" />;
  }

  if (!user) {
    return (
      <button
        type="button"
        onClick={handleSignIn}
        className="text-sm rounded-full border border-black/15 dark:border-white/15 px-4 py-1.5 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
      >
        Đăng nhập với Google
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-black/60 dark:text-white/60">{user.email}</span>
      <button
        type="button"
        onClick={handleSignOut}
        className="text-sm rounded-full border border-black/15 dark:border-white/15 px-4 py-1.5 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
      >
        Đăng xuất
      </button>
    </div>
  );
}
