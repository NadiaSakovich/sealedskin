import type { Metadata } from "next";
import { ContentShell } from "@/components/layout/ContentShell";
import { ProfileView } from "@/components/profile/ProfileView";

export const metadata: Metadata = {
  title: "My account",
  description: "Your saved skincare routines and skin profile.",
  /* Private, auth-gated, and identical for every crawler (a sign-in prompt).
     robots.txt disallows it too; this covers arrival by any other route. */
  robots: { index: false, follow: false, nocache: true },
};

export default function ProfilePage() {
  return (
    <ContentShell>
      <ProfileView />
    </ContentShell>
  );
}
