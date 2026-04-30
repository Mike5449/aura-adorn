import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authApi, tokenStorage, type LoginResult, type OtpChallengeResponse } from "@/lib/api";
import type { ApiUser } from "@/lib/api-types";

// What login() returns: either the resolved user (regular flow) or the
// pending OTP challenge that the LoginPage must walk the user through.
export type LoginOutcome =
  | { kind: "user"; user: ApiUser }
  | { kind: "otp"; challenge: OtpChallengeResponse };

interface AuthCtx {
  user: ApiUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;       // covers super_admin OR admin (anyone in admin space)
  isStaff: boolean;
  login: (username: string, password: string) => Promise<LoginOutcome>;
  finishOtp: (challengeId: string, code: string) => Promise<ApiUser>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!tokenStorage.get()) {
      setUser(null);
      return;
    }
    try {
      const me = await authApi.me();
      setUser(me);
    } catch {
      tokenStorage.clear();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const login = useCallback(async (username: string, password: string): Promise<LoginOutcome> => {
    const result: LoginResult = await authApi.login(username, password);
    if (result.kind === "otp") {
      // No tokens yet — the LoginPage will collect the 6-digit code and
      // call finishOtp() to complete the sign-in.
      return { kind: "otp", challenge: result.challenge };
    }
    const me = await authApi.me();
    setUser(me);
    return { kind: "user", user: me };
  }, []);

  const finishOtp = useCallback(async (challengeId: string, code: string): Promise<ApiUser> => {
    await authApi.verifyOtp(challengeId, code);
    const me = await authApi.me();
    setUser(me);
    return me;
  }, []);

  const logout = useCallback(() => {
    authApi.logout();
    setUser(null);
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,
      isSuperAdmin: user?.role === "super_admin",
      isAdmin: user?.role === "super_admin" || user?.role === "admin",
      isStaff: ["super_admin", "admin", "manager", "staff"].includes(user?.role ?? ""),
      login,
      finishOtp,
      logout,
      refresh,
    }),
    [user, loading, login, finishOtp, logout, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
