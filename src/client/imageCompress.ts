// 用 canvas 把图片缩到长边 ≤ maxDim,再以 JPEG quality 编码。
// 装备 tooltip 截图,1600px + 0.9 quality 肉眼几乎无损,但文件能从 2MB 缩到 300-500KB。
export async function compressImage(
  blob: Blob,
  maxDim = 1600,
  quality = 0.9
): Promise<Blob> {
  // 不是图片就原样返回
  if (!blob.type.startsWith("image/")) return blob;

  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("image decode failed"));
      i.src = url;
    });

    const { naturalWidth: w, naturalHeight: h } = img;
    const longSide = Math.max(w, h);
    const scale = longSide > maxDim ? maxDim / longSide : 1;
    const tw = Math.round(w * scale);
    const th = Math.round(h * scale);

    const canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext("2d");
    if (!ctx) return blob;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, tw, th);

    const compressed = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality);
    });

    if (!compressed) return blob;
    // 比原图还大就放弃压缩(已经是高效编码的小图,二次编码反而变大)
    return compressed.size < blob.size ? compressed : blob;
  } catch {
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}
