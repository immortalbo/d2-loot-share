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

      <div className="legal-notice">
        <strong>点击「进入」即代表你已阅读并自愿同意以下使用须知:</strong>
        <ol>
          <li>
            本工具仅供群友开荒阶段<strong>免费分享</strong>装备使用,
            <strong>严禁任何形式的交易</strong>(包括 RMT、装备买卖、代练、虚拟币交易等)
          </li>
          <li>
            群友间装备赠送均为自愿行为,任何纠纷由当事人自行协商解决,
            与本工具无关
          </li>
          <li>用户上传的内容由发布者本人负责,与本工具运营者无关</li>
          <li>
            装备截图所涉知识产权归 © Blizzard Entertainment 所有,
            本工具仅做转发展示,不存储任何游戏数据
          </li>
          <li>管理员保留对违规、与开荒无关内容的删除权</li>
          <li>使用本工具即视为接受以上条款,如不同意请关闭页面</li>
        </ol>
      </div>
    </div>
  );
}
