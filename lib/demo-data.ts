import type { Album, Photo } from "@/lib/gallery";

const sample = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1400&q=85`;

function photo(id: string, albumId: string, title: string, image: string, width: number, height: number): Photo {
  return {
    id, albumId, title,
    description: "这是一张用于展示排版的示例照片，图片来自 Unsplash。连接数据库后，你可以用自己的照片开始记录。",
    location: "示例影像 · Unsplash",
    src: sample(image), width, height,
    createdAt: "2026-09-01T00:00:00.000Z",
    likes: 0,
  };
}

/** Read-only examples; never inserted into the owner's database. */
export const demoAlbums: Album[] = [
  {
    id: "demo-wilderness", title: "山野来信",
    description: "走进山野，让目光在远方停一会儿。关于旷野、风和不赶时间的旅行。",
    visibility: "PUBLIC", createdAt: "2026-09-03T00:00:00.000Z",
    photos: [
      photo("demo-wilderness-1", "demo-wilderness", "风经过的地方", "photo-1500530855697-b586d89ba3ee", 1600, 1067),
      photo("demo-wilderness-2", "demo-wilderness", "一整个晴天", "photo-1500534623283-312aade485b7", 1200, 1500),
    ],
  },
  {
    id: "demo-city", title: "城市漫游",
    description: "拐过一条陌生的街，找到属于自己的日常切片。",
    visibility: "PUBLIC", createdAt: "2026-09-02T00:00:00.000Z",
    photos: [
      photo("demo-city-1", "demo-city", "日落之前", "photo-1555881400-74d7acaacd8b", 1200, 1500),
      photo("demo-city-2", "demo-city", "街角的故事", "photo-1501339847302-ac426a4a7cbb", 1600, 1067),
    ],
  },
  {
    id: "demo-everyday", title: "日常微光",
    description: "一片叶子，一束窗光。那些微小的、美好的、不想忘记的瞬间。",
    visibility: "PUBLIC", createdAt: "2026-09-01T00:00:00.000Z",
    photos: [
      photo("demo-everyday-1", "demo-everyday", "绿意慢慢", "photo-1497250681960-ef046c08a56e", 1200, 1500),
      photo("demo-everyday-2", "demo-everyday", "午后的房间", "photo-1494438639946-1ebd1d20bf85", 1600, 1067),
    ],
  },
];
