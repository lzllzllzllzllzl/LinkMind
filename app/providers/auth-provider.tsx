"use client";

import type { Session, User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { createClient } from "@/utils/supabase/client";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  isAuthenticated: boolean;
  userEmail: string;
  authReady: boolean;
  refreshAuth: () => Promise<void>;
  signOut: () => Promise<{ message: string } | null>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const applySession = useCallback((nextSession: Session | null) => {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);
    setAuthReady(true);
  }, []);

  const refreshAuth = useCallback(async () => {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      setSession(null);
      setUser(null);
      setAuthReady(true);
      return;
    }

    applySession(data.session);
  }, [applySession, supabase]);

  useEffect(() => {
    let mounted = true;

    const applyIfMounted = (nextSession: Session | null) => {
      if (!mounted) return;
      applySession(nextSession);
    };

    const init = async () => {
      const {
        data: { session: initialSession },
      } = await supabase.auth.getSession();

      applyIfMounted(initialSession);
    };

    void init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      applyIfMounted(nextSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [applySession, supabase]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();

    if (!error) {
      applySession(null);
      return null;
    }

    return { message: error.message };
  }, [applySession, supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      isAuthenticated: Boolean(user),
      userEmail: user?.email || "",
      authReady,
      refreshAuth,
      signOut,
    }),
    [authReady, refreshAuth, session, signOut, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth 必须在 AuthProvider 内部使用");
  }

  return context;
}