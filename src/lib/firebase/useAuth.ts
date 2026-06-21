"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { watchAuth } from "./client";

/**
 * React hook for the current Firebase auth state.
 *
 * `loading` is true until the first auth-state callback fires, so the UI can
 * avoid flashing the signed-out state for an already-signed-in user.
 */
export function useAuth(): { user: User | null; loading: boolean } {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(
    () =>
      watchAuth((next) => {
        setUser(next);
        setLoading(false);
      }),
    [],
  );

  return { user, loading };
}
