import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

/* ---------- types ---------- */

export type Role = "candidate" | "interviewer";

interface Profile {
  id: string;
  name: string | null;
  role: Role | null;
}

interface AuthContextValue {
  /** The current Supabase session (null when logged-out). */
  session: Session | null;
  /** Shorthand for session.user. */
  user: User | null;
  /** Profile row from the `profiles` table (null until fetched). */
  profile: Profile | null;
  /** True while we're resolving the initial session / profile. */
  loading: boolean;
  /** Re-fetch the profile from the database (e.g. after role update). */
  refreshProfile: () => Promise<void>;
  /** Sign out and clear local state. */
  signOut: () => Promise<void>;
}

/* ---------- context ---------- */

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/* ---------- provider ---------- */

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  /* Fetch the profile row for a given user id. */
  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, role")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Failed to fetch profile:", error.message);
      setProfile(null);
    } else {
      setProfile(data as Profile);
    }
  };

  /** Public helper so pages (e.g. RolePage) can refresh after update. */
  const refreshProfile = async () => {
    if (session?.user) {
      await fetchProfile(session.user.id);
    }
  };

  /* Bootstrap: get the current session and subscribe to auth changes. */
  useEffect(() => {
    let mounted = true;

    /* 1️⃣  Resolve the existing session (persisted in localStorage by Supabase). */
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted) return;
      setSession(s);
      if (s?.user) {
        fetchProfile(s.user.id).finally(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    /* 2️⃣  Listen for future auth events (login, logout, token refresh). */
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mounted) return;

      const prevUserId = session?.user?.id;
      setSession(s);

      if (s?.user) {
        // A genuinely new sign-in (not a background token refresh for the
        // same user). Set loading so downstream guards (DashboardLayout)
        // don't render until we know the profile & role.
        const isNewSignIn = event === "SIGNED_IN" && s.user.id !== prevUserId;

        if (isNewSignIn) {
          setLoading(true);
        }

        fetchProfile(s.user.id).finally(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  };

  const user = session?.user ?? null;

  return (
    <AuthContext.Provider
      value={{ session, user, profile, loading, refreshProfile, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/* ---------- hook ---------- */

/**
 * Access auth state anywhere inside the component tree.
 *
 * @example
 * const { user, profile, signOut } = useAuth();
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}
