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

type TabKey = "all" | "mine" | "claimed_by_me" | "done";

const TAB_LABELS: Record<TabKey, string> = {
  all: "全部",
  mine: "我发布的",
  claimed_by_me: "我领取的",
  done: "已领完",
};

const TABS: TabKey[] = ["all", "mine", "claimed_by_me", "done"];

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

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchItems();
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
  }

  // 按 tab + 筛选计算列表
  const filteredItems = useMemo(() => {
    if (!auth) return [];
    return items.filter((it) => {
      // tab 过滤
      if (tab === "mine" && it.nickname !== auth.nickname) return false;
      if (tab === "claimed_by_me" && it.claimed_by !== auth.nickname)
        return false;
      if (tab === "done" && !it.claimed_by) return false;
      // 全部 tab 默认隐藏已领取的(除非要看 done)
      if (tab === "all" && it.claimed_by) return false;

      // 维度筛选
      if (filterCategory && it.category !== filterCategory) return false;
      if (filterQuality && it.quality !== filterQuality) return false;
      if (filterClass && !it.classes.includes(filterClass)) return false;

      return true;
    });
  }, [items, auth, tab, filterCategory, filterQuality, filterClass]);

  // 统计每个 tab 的数量
  const counts = useMemo(() => {
    if (!auth) return { all: 0, mine: 0, claimed_by_me: 0, done: 0 };
    return {
      all: items.filter((it) => !it.claimed_by).length,
      mine: items.filter((it) => it.nickname === auth.nickname).length,
      claimed_by_me: items.filter((it) => it.claimed_by === auth.nickname)
        .length,
      done: items.filter((it) => !!it.claimed_by).length,
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

  return (
    <div className="app">
      <div className="header">
        <h1>公会装备共享</h1>
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
        {TABS.map((k) => (
          <button
            key={k}
            className={`tab ${tab === k ? "active" : ""}`}
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
        {hasFilter && (
          <button
            onClick={() => {
              setFilterCategory("");
              setFilterQuality("");
              setFilterClass("");
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
