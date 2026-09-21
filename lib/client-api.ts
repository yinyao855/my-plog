export async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "操作失败，请稍后重试。");
  return data as T;
}

export async function copyShareLink(path: string) {
  const url = new URL(path, window.location.origin).href;
  if (!navigator.clipboard) throw new Error(`请复制浏览器地址分享：${url}`);
  await navigator.clipboard.writeText(url);
}
