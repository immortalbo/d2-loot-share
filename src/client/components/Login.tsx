import { useState } from "react";
import { saveAuth, verifyPassword } from "../api";

export function Login({ onLogin }: { onLogin: (nickname: string) => void }) {
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nickname.trim() || !password.trim()) {
      setError("昵称和口令都要填");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { ok, role } = await verifyPassword(password);
      if (!ok || !role) {
        setError("口令错了");
        return;
      }
      saveAuth({ password, nickname: nickname.trim(), role });
      onLogin(nickname.trim());
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login">
      <h2>群友装备共享</h2>
      <form onSubmit={submit}>
        <div className="field">
          <label>游戏昵称</label>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="群里的那个昵称"
            autoFocus
          />
        </div>
        <div className="field">
          <label>口令</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="问群主要"
          />
        </div>
        <button type="submit" className="primary" disabled={loading}>
          {loading ? "验证中..." : "进入"}
        </button>
        {error && <div className="error">{error}</div>}
      </form>
    </div>
  );
}
