import type { Metadata } from "next";
import { ContentShell } from "@/components/layout/ContentShell";
import { ProfileView } from "@/components/profile/ProfileView";

export const metadata: Metadata = {
  title: "Your profile — SealedSkin",
  description: "Your saved skincare routines and skin profile.",
};

export default function ProfilePage() {
  return (
    <ContentShell>
      <ProfileView />
    </ContentShell>
  );
}
