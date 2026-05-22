export type Category =
  | "weapon"
  | "helmet"
  | "armor"
  | "gloves"
  | "boots"
  | "belt"
  | "shield"
  | "amulet"
  | "ring"
  | "rune"
  | "charm"
  | "set"
  | "other";

export type Quality =
  | "white"
  | "blue"
  | "yellow"
  | "gold"
  | "set"
  | "runeword";

export type CharClass =
  | "amazon"
  | "assassin"
  | "barbarian"
  | "druid"
  | "paladin"
  | "necromancer"
  | "sorceress"
  | "warlock";

export const CATEGORY_LABELS: Record<Category, string> = {
  weapon: "武器",
  helmet: "头盔",
  armor: "胸甲",
  gloves: "手套",
  boots: "鞋子",
  belt: "腰带",
  shield: "盾牌",
  amulet: "项链",
  ring: "戒指",
  rune: "符文",
  charm: "护身符",
  set: "套装",
  other: "其他",
};

export const QUALITY_LABELS: Record<Quality, string> = {
  white: "白色",
  blue: "蓝色",
  yellow: "黄色",
  gold: "暗金",
  set: "套装",
  runeword: "符文之语",
};

export const QUALITY_COLORS: Record<Quality, string> = {
  white: "#e6e8ec",
  blue: "#5a8eff",
  yellow: "#ffd84a",
  gold: "#c08a3e",
  set: "#4caf50",
  runeword: "#ff8c2a",
};

export const CHAR_CLASS_LABELS: Record<CharClass, string> = {
  amazon: "亚马逊",
  assassin: "刺客",
  barbarian: "野蛮人",
  druid: "德鲁伊",
  paladin: "圣骑士",
  necromancer: "死灵",
  sorceress: "法师",
  warlock: "术士",
};

export const CATEGORIES: Category[] = [
  "weapon",
  "helmet",
  "armor",
  "gloves",
  "boots",
  "belt",
  "shield",
  "amulet",
  "ring",
  "rune",
  "charm",
  "set",
  "other",
];

export const QUALITIES: Quality[] = [
  "white",
  "blue",
  "yellow",
  "gold",
  "set",
  "runeword",
];

export const CHAR_CLASSES: CharClass[] = [
  "amazon",
  "assassin",
  "barbarian",
  "druid",
  "paladin",
  "necromancer",
  "sorceress",
  "warlock",
];

export type Role = "user" | "admin";

export type AiReview = "approved" | "suspicious" | "skipped" | null;

export interface Item {
  id: number;
  nickname: string;
  item_name: string | null;
  note: string | null;
  image_key: string;
  image_url: string;
  category: Category | null;
  quality: Quality | null;
  // 后端存逗号分隔的字符串,前端转数组
  classes: CharClass[];
  claimed_by: string | null;
  claimed_at: number | null;
  deleted_at: number | null;
  deleted_by: string | null;
  ai_review: AiReview;
  ai_review_reason: string | null;
  // 仅管理员可见(普通用户响应里为 null)
  ip_address: string | null;
  created_at: number;
  updated_at: number;
}

export interface AuthResponse {
  ok: boolean;
  role?: Role;
  error?: string;
}

export interface ItemsResponse {
  items: Item[];
}

export interface UploadResponse {
  item: Item;
}
