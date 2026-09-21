import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminDashboard from "@/components/admin-dashboard";
import { getAdminSession } from "@/lib/auth";
import { getGallery } from "@/lib/gallery-repository";

export const metadata: Metadata = {
  title: "我的影像室 · 相册管理",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const session = await getAdminSession();

  if (!session) {
    redirect("/login");
  }

  // Private albums must only be loaded after verifying the administrator.
  const gallery = await getGallery(true);

  return (
    <AdminDashboard
      albums={gallery.albums}
      demo={gallery.demo}
      username={session.username}
    />
  );
}
