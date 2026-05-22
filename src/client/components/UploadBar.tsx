import { useEffect, useRef, useState } from "react";
import { uploadItem } from "../api";
import { compressImage } from "../imageCompress";
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
} from "../../shared/types";

export function UploadBar({
  nickname,
  onUploaded,
}: {
  nickname: string;
  onUploaded: (item: Item) => void;
}) {
  const [image, setImage] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [itemName, setItemName] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [quality, setQuality] = useState<Quality | "">("");
  const [classes, setClasses] = useState<CharClass[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function acceptImage(blob: Blob) {
    setCompressing(true);
    try {
      const compressed = await compressImage(blob);
      setImage(compressed);
    } finally {
      setCompressing(false);
    }
  }

  useEffect(() => {
    if (!image) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(image);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  // 全局监听粘贴事件
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const item = Array.from(e.clipboardData?.items || []).find((i) =>
        i.type.startsWith("image/")
      );
      if (item) {
        const file = item.getAsFile();
        if (file) acceptImage(file);
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = Array.from(e.dataTransfer.files).find((f) =>
      f.type.startsWith("image/")
    );
    if (file) acceptImage(file);
  }

  function toggleClass(cls: CharClass) {
    setClasses((prev) =>
      prev.includes(cls) ? prev.filter((c) => c !== cls) : [...prev, cls]
    );
  }

  async function submit() {
    if (!image) {
      setError("先粘贴一张截图(Ctrl+V)");
      return;
    }
    if (!category) {
      setError("请选择装备类型");
      return;
    }
    if (!quality) {
      setError("请选择装备品质");
      return;
    }
    setUploading(true);
    setError(null);
    setInfo(null);
    try {
      const item = await uploadItem({
        nickname,
        item_name: itemName.trim() || undefined,
        note: note.trim() || undefined,
        category: category || null,
        quality: quality || null,
        classes,
        image,
      });
      onUploaded(item);
      setImage(null);
      setItemName("");
      setNote("");
      setCategory("");
      setQuality("");
      setClasses([]);

      if (item.ai_review === "suspicious") {
        setInfo(
          "已提交,但 AI 未识别为装备截图,需要管理员审核后才会展示给其他人。"
        );
      } else {
        setInfo("发布成功 ✓");
      }
      setTimeout(() => setInfo(null), 8000);
    } catch (err) {
      setError(String(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      className={`upload-bar ${dragging ? "dragging" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <div className="hint">
        粘贴截图(Ctrl+V / ⌘+V),或把图片拖进来,或
        <button
          type="button"
          style={{ marginLeft: 8, padding: "4px 10px" }}
          onClick={() => fileInputRef.current?.click()}
        >
          选择文件
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) acceptImage(f);
          }}
        />
      </div>

      {previewUrl && <img className="preview" src={previewUrl} alt="预览" />}

      {compressing && (
        <div className="ocr-box">正在处理图片...</div>
      )}
      {uploading && (
        <div className="ocr-box">
          正在审核(AI 识别约 3-5 秒,请稍候)...
        </div>
      )}

      <div className="row">
        <input
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          placeholder="装备名(可选)"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="备注(可选;留空会用图中识别出的属性自动填充)"
        />
      </div>

      <div className="row">
        <select
          className={!category ? "required-empty" : ""}
          value={category}
          onChange={(e) => setCategory(e.target.value as Category | "")}
        >
          <option value="">类型 *(必选)</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <select
          className={!quality ? "required-empty" : ""}
          value={quality}
          onChange={(e) => setQuality(e.target.value as Quality | "")}
        >
          <option value="">品质 *(必选)</option>
          {QUALITIES.map((q) => (
            <option key={q} value={q}>
              {QUALITY_LABELS[q]}
            </option>
          ))}
        </select>
      </div>

      <div className="class-chips">
        <span className="class-chip-label">适用职业:</span>
        {CHAR_CLASSES.map((cls) => (
          <button
            type="button"
            key={cls}
            className={`chip ${classes.includes(cls) ? "active" : ""}`}
            onClick={() => toggleClass(cls)}
          >
            {CHAR_CLASS_LABELS[cls]}
          </button>
        ))}
      </div>

      <div>
        <button
          className="primary"
          onClick={submit}
          disabled={uploading || compressing || !image}
        >
          {uploading ? "审核中..." : "发布"}
        </button>
      </div>

      {info && <div className="info">{info}</div>}
      {error && <div className="error">{error}</div>}
    </div>
  );
}
