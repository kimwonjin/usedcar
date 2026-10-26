// 올리기 전에 휴대폰에서 사진 품질을 간단히 본다: 너무 어두운지, 흔들려 흐린지.
// 작게 줄인 흑백 이미지의 평균 밝기와 라플라시안(경계 선명도) 분산으로 판단한다. 판단이 틀릴 수 있어 막지는 않고 묻기만 한다.
const SIZE = 320;
export const DARK_BELOW = 50; // 평균 밝기 0~255
export const BLURRY_BELOW = 30; // 라플라시안 분산

export type PhotoQuality = { brightness: number; sharpness: number; dark: boolean; blurry: boolean };

export async function checkPhotoQuality(blob: Blob): Promise<PhotoQuality | null> {
  try {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, SIZE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const { data } = ctx.getImageData(0, 0, w, h);

    const gray = new Float32Array(w * h);
    let sum = 0;
    for (let i = 0; i < w * h; i++) {
      gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
      sum += gray[i];
    }
    const brightness = sum / (w * h);

    let lapSum = 0;
    let lapSq = 0;
    let n = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const lap = gray[i - w] + gray[i + w] + gray[i - 1] + gray[i + 1] - 4 * gray[i];
        lapSum += lap;
        lapSq += lap * lap;
        n++;
      }
    }
    const mean = n ? lapSum / n : 0;
    const sharpness = n ? lapSq / n - mean * mean : 0;
    return { brightness, sharpness, dark: brightness < DARK_BELOW, blurry: sharpness < BLURRY_BELOW };
  } catch {
    return null; // 판단할 수 없으면 그냥 올린다
  }
}
