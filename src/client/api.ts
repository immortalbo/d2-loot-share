import type { CharClass, Item, Category, Quality } from "../shared/types";

const STORAGE_KEY = "wow-loot-share-auth";

export interface AuthState {
  password: string;
  nickname: string;
}

export function loadAuth(): AuthState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthState) : null;
  } catch {
    return null;
  }
}

export function saveAuth(auth: AuthState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
}

export function clearAuth() {
  localStorage.removeItem(STORAGE_KEY);
}

async function authHeaders(): Promise<HeadersInit> {
  const a = loadAuth();
  return a ? { Authorization: `Bearer ${a.password}` } : {};
}

export async function verifyPassword(password: string): Promise<boolean> {
  const res = await fetch("/api/auth/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  return res.ok;
}

export async function fetchItems(): Promise<Item[]> {
  const res = await fetch("/api/items", { headers: await authHeaders() });
  if (!res.ok) throw new Error(`fetchItems failed: ${res.status}`);
  const data = (await res.json()) as { items: Item[] };
  return data.items;
}

export async function uploadItem(input: {
  nickname: string;
  item_name?: string;
  note?: string;
  category?: Category | null;
  quality?: Quality | null;
  classes?: CharClass[];
  image: Blob;
}): Promise<Item> {
  const fd = new FormData();
  fd.set("nickname", input.nickname);
  if (input.item_name) fd.set("item_name", input.item_name);
  if (input.note) fd.set("note", input.note);
  if (input.category) fd.set("category", input.category);
  if (input.quality) fd.set("quality", input.quality);
  if (input.classes && input.classes.length > 0)
    fd.set("classes", input.classes.join(","));
  fd.set("image", input.image, "screenshot.png");

  const res = await fetch("/api/items", {
    method: "POST",
    headers: await authHeaders(),
    body: fd,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `upload failed: ${res.status}`);
  }
  const data = (await res.json()) as { item: Item };
  return data.item;
}

export async function claimItem(id: number, claimedBy: string | null) {
  const res = await fetch(`/api/items/${id}/claim`, {
    method: "PATCH",
    headers: {
      ...(await authHeaders()),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ claimed_by: claimedBy }),
  });
  if (!res.ok) throw new Error(`claim failed: ${res.status}`);
}

export async function deleteItem(id: number) {
  const res = await fetch(`/api/items/${id}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(`delete failed: ${res.status}`);
}
