/** Public, serializable gallery contracts shared by server and client components. */
export type Photo = {
  id: string;
  albumId: string;
  title: string;
  description: string;
  location: string;
  src: string;
  width: number;
  height: number;
  createdAt: string;
  likes: number;
};

export type Album = {
  id: string;
  title: string;
  description: string;
  visibility: "PUBLIC" | "PRIVATE";
  createdAt: string;
  photos: Photo[];
};

export type GalleryData = { albums: Album[]; demo: boolean };

export type Comment = {
  id: string;
  author: string;
  body: string;
  createdAt: string;
};
