import { GIFEncoder, quantize, applyPalette } from "gifenc";

export type ConvertOptions = {
  /** 最大宽度（高度按比例） */
  maxWidth?: number;
  /** 每秒帧数 */
  fps?: number;
  /** 最大时长（秒），超出部分截断 */
  maxDuration?: number;
  /** 片段开始时间（秒） */
  startTime?: number;
  /** 片段结束时间（秒）；不填则用 startTime + maxDuration，且不超过视频总长 */
  endTime?: number;
  /** 调色板颜色数 */
  numColors?: number;
  /** 每帧编码后的进度回调 0-100 */
  onProgress?: (percent: number) => void;
};

const DEFAULT_OPTIONS: Pick<
  ConvertOptions,
  "maxWidth" | "fps" | "maxDuration" | "numColors"
> = {
  maxWidth: 480,
  fps: 10,
  maxDuration: 6,
  numColors: 128,
};

/**
 * 从 video 元素按间隔截取帧，编码为 GIF
 */
export async function videoToGif(
  video: HTMLVideoElement,
  options: ConvertOptions = {}
): Promise<Blob> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const maxWidth = opts.maxWidth ?? 480;
  const fps = opts.fps ?? 10;
  const maxDuration = opts.maxDuration ?? 6;
  const numColors = opts.numColors ?? 128;
  const onProgress = opts.onProgress;
  const startTime = Math.max(0, opts.startTime ?? 0);

  if (video.readyState < 2) {
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("Video load failed"));
    });
  }

  const endTime = opts.endTime != null
    ? Math.min(video.duration, Math.max(startTime, opts.endTime))
    : Math.min(video.duration, startTime + maxDuration);

  const duration = Math.max(0, endTime - startTime);
  if (duration <= 0) throw new Error("片段时长需大于 0");
  const totalFrames = Math.max(1, Math.floor(duration * fps));
  const frameDelay = duration / totalFrames;

  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const scale = maxWidth / Math.max(vw, vh);
  const w = Math.round(scale * vw);
  const h = Math.round(scale * vh);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2d not available");

  const gif = GIFEncoder();
  const delayMs = Math.round(frameDelay * 1000);

  for (let i = 0; i < totalFrames; i++) {
    const t = startTime + (i / (totalFrames - 1 || 1)) * duration;
    video.currentTime = t;
    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error("Seek failed"));
    });

    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    const rgba = new Uint8ClampedArray(imageData.data);

    const palette = quantize(rgba, numColors);
    const index = applyPalette(rgba, palette);
    gif.writeFrame(index, w, h, {
      palette,
      delay: delayMs,
    });
    onProgress?.(Math.round(((i + 1) / totalFrames) * 100));
  }

  gif.finish();
  const bytes = gif.bytes();
  return new Blob([bytes], { type: "image/gif" });
}
