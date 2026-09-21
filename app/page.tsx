import GalleryApp from "@/components/gallery-app";
import { getGallery } from "@/lib/gallery-repository";
import { getAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [data, session] = await Promise.all([getGallery(), getAdminSession()]);
  return <GalleryApp data={data} isAdmin={Boolean(session)} />;
}
