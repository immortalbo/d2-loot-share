import { useEffect, useRef, useState } from "react";
import { createWorker, type Worker as TesseractWorker } from "tesseract.js";
import { uploadItem } from "../api";
import { compressImage } from "../imageCompress";
import { reviewOcrText } from "../../shared/d2-keywords";
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

  async function acceptImage(blob: Blob) {
    setCompressing(true);
    try {
      const compressed = await compressImage(blob);
      setImage(compressed);
    } finally {
      setCompressing(false);
    }
  }
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

  // OCR 状态
  const workerRef = useRef<TesseractWorker | null>(null);
  const [ocrText, setOcrText] = useState<string>("");
  const [ocrStatus, setOcrStatus] = useState<
    "idle" | "loading" | "recognizing" | "done" | "failed"
  >("idle");

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

  // image 变化时跑 OCR
  useEffect(() => {
    let cancelled = false;
    setOcrText("");
    if (!image) {
      setOcrStatus("idle");
      return;
    }
    (async () => {
      try {
        if (!workerRef.current) {
          setOcrStatus("loading");
          workerRef.current = await createWorker("chi_sim+eng");
        }
        if (cancelled) return;
        setOcrStatus("recognizing");
        const ret = await workerRef.current.recognize(image);
        if (cancelled) return;
        const text = ret.data.text || "";
        setOcrText(text);
        setOcrStatus("done");
      } catch (err) {
        if (cancelled) return;
        setOcrText(`OCR 失败: ${String(err).slice(0, 100)}`);
        setOcrStatus("failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [image]);

  // 卸载时关闭 worker
  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
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
        ocr_text: ocrText || undefined,
      });
      onUploaded(item);
      setImage(null);
      setItemName("");
      setNote("");
      setCategory("");
      setQuality("");
      setClasses([]);
      setOcrText("");
      setOcrStatus("idle");

      if (item.ai_review === "suspicious") {
        setInfo(
          "已提交,但 OCR 未在图中检测到装备特征,可能不是装备截图,需要管理员审核后才会展示给其他人。"
        );
      } else {
        setInfo("提交成功 ✓");
      }
      setTimeout(() => setInfo(null), 8000);
    } catch (err) {
      setError(String(err));
    } finally {
      setUploading(false);
    }
  }

  const ocrPassed = ocrStatus === "done" && reviewOcrText(ocrText).ok;
  const ocrFailed = ocrStatus === "done" && !ocrPassed;

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
        <div className="ocr-box">正在压缩图片(几乎无损,只为加速上传)...</div>
      )}
      {image && !compressing && ocrStatus !== "idle" && !ocrPassed && (
        <div className={`ocr-box ${ocrFailed ? "fail" : ""}`}>
          {ocrStatus === "loading" &&
            "正在加载文字识别引擎(首次约 5-10 秒,之后缓存)..."}
          {ocrStatus === "recognizing" && "正在识别图中文字..."}
          {ocrStatus === "done" && !ocrPassed && (
            <>⚠ 本地识别未通过,提交后将调用 AI 进一步识别,请稍候...</>
          )}
          {ocrStatus === "failed" && (
            <>本地 OCR 失败,提交后将由 AI 识别,请稍候...</>
          )}
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
          placeholder="备注 / 属性(可选)"
        />
      </div>

      <div className="row">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as Category | "")}
        >
          <option value="">类型(可选)</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <select
          value={quality}
          onChange={(e) => setQuality(e.target.value as Quality | "")}
        >
          <option value="">品质(可选)</option>
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
          disabled={uploading || !image}
        >
          {uploading ? "上传中..." : "发布"}
        </button>
      </div>

      {info && <div className="info">{info}</div>}
      {error && <div className="error">{error}</div>}
    </div>
  );
}
