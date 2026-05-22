// 仅匹配「需要等级」(允许字符间被 OCR 识别出空格/标点)
const PATTERN = /需\s*要\s*等\s*级/;

export function reviewOcrText(text: string): {
  ok: boolean;
  matched?: string;
} {
  if (!text) return { ok: false };
  const m = text.match(PATTERN);
  return m ? { ok: true, matched: m[0] } : { ok: false };
}
