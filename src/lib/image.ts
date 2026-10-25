const MAX_SIDE = 1600;
const QUALITY = 0.82;

// 휴대폰 원본 사진(4~10MB)을 긴 변 1600px JPEG로 줄여 업로드 시간과 저장 용량을 아낀다.
export async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("image encode failed"))),
      "image/jpeg",
      QUALITY,
    ),
  );
}

// 사진의 일부(번호판 등)를 모자이크로 가린다. rect는 사진 크기 대비 비율(0~1)
export async function pixelateRegion(
  blob: Blob,
  rect: { x: number; y: number; width: number; height: number },
): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const x = Math.round(rect.x * canvas.width);
  const y = Math.round(rect.y * canvas.height);
  const w = Math.max(1, Math.round(rect.width * canvas.width));
  const h = Math.max(1, Math.round(rect.height * canvas.height));
  // 작게 줄였다가 부드럽게 하지 않고 키우면 큰 블록 모자이크가 된다 (글자를 읽을 수 없는 크기)
  const block = Math.max(8, Math.round(Math.min(w, h) / 4));
  const small = document.createElement("canvas");
  small.width = Math.max(1, Math.round(w / block));
  small.height = Math.max(1, Math.round(h / block));
  small.getContext("2d")!.drawImage(canvas, x, y, w, h, 0, 0, small.width, small.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small, 0, 0, small.width, small.height, x, y, w, h);

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (out) => (out ? resolve(out) : reject(new Error("image encode failed"))),
      "image/jpeg",
      QUALITY,
    ),
  );
}
