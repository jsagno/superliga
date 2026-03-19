import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSupabase } = vi.hoisted(() => ({
  mockSupabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signInWithOAuth: vi.fn(),
    },
    from: vi.fn(),
  },
}));

vi.mock("../lib/supabaseClient", () => ({
  supabase: mockSupabase,
}));

import {
  getSession,
  isAllowedAdminRole,
  resolveAdminIdentity,
  signInWithGoogle,
  signInWithPassword,
  signOut,
} from "./authService";

describe("authService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts ADMIN, SUPER_ADMIN and SUPER_USER roles", () => {
    expect(isAllowedAdminRole("ADMIN")).toBe(true);
    expect(isAllowedAdminRole("SUPER_ADMIN")).toBe(true);
    expect(isAllowedAdminRole("SUPER_USER")).toBe(true);
    expect(isAllowedAdminRole("PLAYER")).toBe(false);
    expect(isAllowedAdminRole(null)).toBe(false);
  });

  it("resolves admin identity as allowed for ADMIN role", async () => {
    const mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { role: "ADMIN" },
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValue(mockChain);

    const identity = await resolveAdminIdentity({ user: { id: "u-1" } });

    expect(identity).toEqual({
      appUserId: "u-1",
      role: "ADMIN",
      isAdmin: true,
    });
  });

  it("resolves non-admin identity as denied", async () => {
    const mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { role: "PLAYER" },
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValue(mockChain);

    const identity = await resolveAdminIdentity({ user: { id: "u-2" } });

    expect(identity).toEqual({
      appUserId: "u-2",
      role: "PLAYER",
      isAdmin: false,
    });
  });

  it("returns null identity when session has no user", async () => {
    const identity = await resolveAdminIdentity(null);
    expect(identity).toBeNull();
  });

  it("signInWithPassword returns session", async () => {
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: { session: { user: { id: "u-1" } } },
      error: null,
    });

    const session = await signInWithPassword({ email: "admin@test.com", password: "123" });
    expect(session?.user?.id).toBe("u-1");
  });

  it("getSession returns current session", async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: "u-1" } } },
      error: null,
    });

    const session = await getSession();
    expect(session?.user?.id).toBe("u-1");
  });

  it("signOut calls supabase signOut", async () => {
    mockSupabase.auth.signOut.mockResolvedValue({ error: null });

    await signOut();
    expect(mockSupabase.auth.signOut).toHaveBeenCalledTimes(1);
  });

  it("signInWithGoogle starts OAuth with google provider", async () => {
    mockSupabase.auth.signInWithOAuth.mockResolvedValue({ error: null });

    await signInWithGoogle();

    expect(mockSupabase.auth.signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "google" }),
    );
  });
});