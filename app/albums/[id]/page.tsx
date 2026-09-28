import { notFound } from "next/navigation";
import AlbumViewer from "@/components/album-viewer";
import { getAlbum } from "@/lib/gallery-repository";
import { getAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getAdminSession();
  const album = await getAlbum(id, Boolean(session));
  if (!album) notFound();
  return <AlbumViewer album={album} isAdmin={Boolean(session)} />;
}
