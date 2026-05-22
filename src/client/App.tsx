import { useEffect, useMemo, useState } from "react";
import { Login } from "./components/Login";
import { UploadBar } from "./components/UploadBar";
import { ItemCard } from "./components/ItemCard";
import { clearAuth, fetchItems, loadAuth } from "./api";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  CHAR_CLASSES,
  CHAR_CLASS_LABELS,
  QUALITIES,
  QUALITY_LABELS,
  type Category,
  type CharClass,
  type Item,
  type Quality,
} from "../shared/types";

type TabKey =
  | "all"
  | "mine"
  | "claimed_by_me"
  | "done"
  | "admin_all"
  | "admin_suspicious"
  | "admin_deleted";

const TAB_LABELS: Record<TabKey, string> = {
  all: "全部",
  mine: "我发布的",
  claimed_by_me: "我领取的",
  done: "已领完",
  admin_all: "全部条目",
  admin_suspicious: "可疑",
  admin_deleted: "已删",
};

const USER_TABS: TabKey[] = ["all", "mine", "claimed_by_me", "done"];
const ADMIN_TABS: TabKey[] = ["admin_all", "admin_suspicious", "admin_deleted"];

export function App() {
  const [auth, setAuth] = useState(() => loadAuth());
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("all");

  // 筛选
  const [filterCategory, setFilterCategory] = useState<Category | "">("");
  const [filterQuality, setFilterQuality] = useState<Quality | "">("");
  const [filterClass, setFilterClass] = useState<CharClass | "">("");
  const [filterNickname, setFilterNickname] = useState("");
  const [filterIp, setFilterIp] = useState("");

  const isAdmin = auth?.role === "admin";

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchItems(isAdmin);
      setItems(list);
    } catch (err) {
      const msg = String(err);
      if (msg.includes("401")) {
        clearAuth();
        setAuth(null);
        return;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!auth) return;
    refresh();
    const t = setInterval(refresh, 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.password]);

  function logout() {
    clearAuth();
    setAuth(null);
    setItems([]);
    setTab("all");
  }

  // 按 tab + 筛选计算列表
  const filteredItems = useMemo(() => {
    if (!auth) return [];
    return items.filter((it) => {
      // 普通 tab: 不展示已删除
      if (USER_TABS.includes(tab) && it.deleted_at) return false;

      if (tab === "mine" && it.nickname !== auth.nickname) return false;
      if (tab === "claimed_by_me" && it.claimed_by !== auth.nickname)
        return false;
      if (tab === "done" && !it.claimed_by) return false;
      if (tab === "all" && it.claimed_by) return false;

      // admin tab
      if (tab === "admin_suspicious" && it.ai_review !== "suspicious")
        return false;
      if (tab === "admin_deleted" && !it.deleted_at) return false;
      // admin_all 显示全部(不过滤)

      // 维度筛选
      if (filterCategory && it.category !== filterCategory) return false;
      if (filterQuality && it.quality !== filterQuality) return false;
      if (filterClass && !it.classes.includes(filterClass)) return false;

      // admin 专属筛选:昵称 / IP(子串匹配,不区分大小写)
      if (
        filterNickname &&
        !it.nickname.toLowerCase().includes(filterNickname.toLowerCase())
      )
        return false;
      if (
        filterIp &&
        !(it.ip_address || "").toLowerCase().includes(filterIp.toLowerCase())
      )
        return false;

      return true;
    });
  }, [
    items,
    auth,
    tab,
    filterCategory,
    filterQuality,
    filterClass,
    filterNickname,
    filterIp,
  ]);

  // 统计每个 tab 的数量
  const counts = useMemo(() => {
    const base = {
      all: 0,
      mine: 0,
      claimed_by_me: 0,
      done: 0,
      admin_all: 0,
      admin_suspicious: 0,
      admin_deleted: 0,
    };
    if (!auth) return base;
    const live = items.filter((it) => !it.deleted_at);
    return {
      all: live.filter((it) => !it.claimed_by).length,
      mine: live.filter((it) => it.nickname === auth.nickname).length,
      claimed_by_me: live.filter((it) => it.claimed_by === auth.nickname)
        .length,
      done: live.filter((it) => !!it.claimed_by).length,
      admin_all: items.length,
      admin_suspicious: items.filter((it) => it.ai_review === "suspicious")
        .length,
      admin_deleted: items.filter((it) => !!it.deleted_at).length,
    };
  }, [items, auth]);

  if (!auth) {
    return (
      <div className="app">
        <Login onLogin={() => setAuth(loadAuth())} />
      </div>
    );
  }

  const hasFilter = filterCategory || filterQuality || filterClass;
  const visibleTabs = isAdmin ? [...USER_TABS, ...ADMIN_TABS] : USER_TABS;

  return (
    <div className="app">
      <div className="header">
        <h1>
          公会装备共享
          {isAdmin && <span className="admin-badge">ADMIN</span>}
        </h1>
        <div className="user">
          <span>
            你是{" "}
            <strong style={{ color: "var(--accent)" }}>{auth.nickname}</strong>
          </span>
          <button onClick={refresh} disabled={loading}>
            {loading ? "刷新中..." : "刷新"}
          </button>
          <button onClick={logout}>登出</button>
        </div>
      </div>

      <UploadBar
        nickname={auth.nickname}
        onUploaded={(item) => setItems((prev) => [item, ...prev])}
      />

      <div className="tabs">
        {visibleTabs.map((k) => (
          <button
            key={k}
            className={`tab ${tab === k ? "active" : ""} ${
              ADMIN_TABS.includes(k) ? "tab-admin" : ""
            }`}
            onClick={() => setTab(k)}
          >
            {TAB_LABELS[k]}
            <span className="tab-count">{counts[k]}</span>
          </button>
        ))}
      </div>

      <div className="filter-bar">
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value as Category | "")}
        >
          <option value="">所有类型</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <select
          value={filterQuality}
          onChange={(e) => setFilterQuality(e.target.value as Quality | "")}
        >
          <option value="">所有品质</option>
          {QUALITIES.map((q) => (
            <option key={q} value={q}>
              {QUALITY_LABELS[q]}
            </option>
          ))}
        </select>
        <select
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value as CharClass | "")}
        >
          <option value="">所有职业</option>
          {CHAR_CLASSES.map((c) => (
            <option key={c} value={c}>
              {CHAR_CLASS_LABELS[c]}
            </option>
          ))}
        </select>
        {isAdmin && (
          <>
            <input
              className="filter-input"
              placeholder="筛选昵称"
              value={filterNickname}
              onChange={(e) => setFilterNickname(e.target.value)}
            />
            <input
              className="filter-input"
              placeholder="筛选 IP"
              value={filterIp}
              onChange={(e) => setFilterIp(e.target.value)}
            />
          </>
        )}
        {(hasFilter || filterNickname || filterIp) && (
          <button
            onClick={() => {
              setFilterCategory("");
              setFilterQuality("");
              setFilterClass("");
              setFilterNickname("");
              setFilterIp("");
            }}
          >
            清除筛选
          </button>
        )}
      </div>

      {error && <div className="error">{error}</div>}

      {filteredItems.length === 0 ? (
        <div className="empty">
          {items.length === 0
            ? "还没有装备,粘贴一张截图(Ctrl+V / ⌘+V)开始分享。"
            : "当前筛选下没有装备"}
        </div>
      ) : (
        <div className="grid">
          {filteredItems.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              currentNickname={auth.nickname}
              isAdmin={isAdmin}
              onChanged={(updated) =>
                setItems((prev) =>
                  prev.map((x) => (x.id === updated.id ? updated : x))
                )
              }
              onDeleted={(id) =>
                setItems((prev) => prev.filter((x) => x.id !== id))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
