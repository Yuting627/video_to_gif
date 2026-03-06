import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { videoToGif } from "@/lib/video-to-gif";
import { Upload, Film, Download, Loader2, Save, Play, Pause } from "lucide-react";

type Step = "idle" | "ready" | "converting" | "done" | "error";

const MAX_CLIP_SEC = 5;

function getSuggestedName(file: File | null): string {
  if (!file) return "output.gif";
  return file.name.replace(/\.[^.]+$/, "") + ".gif";
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  /** 剪辑起点/终点（秒）。null 表示未圈选（仅当 duration >= 5 时出现） */
  const [clipStart, setClipStart] = useState<number | null>(null);
  const [clipEnd, setClipEnd] = useState<number | null>(null);
  /** 起止输入框的本地字符串（便于只允许数字） */
  const [startInput, setStartInput] = useState("");
  const [endInput, setEndInput] = useState("");
  const [inputError, setInputError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<"start" | "end" | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  /** 播放范围锁定：timeupdate 时若超出 clipEnd 则暂停 */
  const stopAtEndRef = useRef<() => void>(() => {});

  const hasSelection = clipStart !== null && clipEnd !== null;
  const clipDurationSec = hasSelection ? clipEnd - clipStart : 0;
  const isValidClip = hasSelection && clipDurationSec > 0 && clipDurationSec <= MAX_CLIP_SEC;
  const isShortVideo = videoDuration > 0 && videoDuration < MAX_CLIP_SEC;

  // 视频加载后：总时长 < 5 秒则全选；否则默认圈选 0～5 秒
  useEffect(() => {
    if (videoDuration <= 0) return;
    if (videoDuration < MAX_CLIP_SEC) {
      setClipStart(0);
      setClipEnd(videoDuration);
      setStartInput("0");
      setEndInput(String(Math.round(videoDuration * 10) / 10));
      setInputError(false);
    } else {
      setClipStart(0);
      setClipEnd(MAX_CLIP_SEC);
      setStartInput("0");
      setEndInput("5");
      setInputError(false);
    }
  }, [videoDuration]);

  // 结束点-开始点>5秒时，自动将结束点更新为 开始点+5秒
  useEffect(() => {
    if (!hasSelection || videoDuration <= 0) return;
    if (clipEnd! - clipStart! <= MAX_CLIP_SEC) return;
    const newEnd = Math.min(videoDuration, clipStart! + MAX_CLIP_SEC);
    setClipEnd(newEnd);
    setEndInput(String(Math.round(newEnd * 10) / 10));
    setInputError(false);
  }, [hasSelection, clipStart, clipEnd, videoDuration]);

  // 播放范围锁定：到结束点自动暂停；进度条拖出范围则回弹到起点并暂停
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;
    const onTimeUpdate = () => {
      if (!hasSelection) return;
      if (video.currentTime >= clipEnd! - 0.05) {
        video.pause();
        video.currentTime = clipEnd!;
        setIsPlaying(false);
        stopAtEndRef.current = () => {};
      }
    };
    const onSeeked = () => {
      // 进度条回弹：若用户拖到圈选范围外，回弹到起点并暂停
      if (!hasSelection) return;
      if (video.currentTime < clipStart! || video.currentTime > clipEnd!) {
        video.pause();
        video.currentTime = clipStart!;
        setIsPlaying(false);
      }
    };
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("seeked", onSeeked);
    stopAtEndRef.current = onTimeUpdate;
    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("seeked", onSeeked);
    };
  }, [videoUrl, hasSelection, clipStart, clipEnd]);

  // 圈选变更时若正在播放则暂停并定位到新起点
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hasSelection) return;
    video.pause();
    video.currentTime = clipStart!;
    setIsPlaying(false);
  }, [clipStart, clipEnd]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("video/")) {
      setError("请选择视频文件（如 MP4、WebM）");
      return;
    }
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (gifUrl) URL.revokeObjectURL(gifUrl);
    setError(null);
    setGifUrl(null);
    setFile(f);
    setVideoUrl(URL.createObjectURL(f));
    setStep("ready");
    setVideoDuration(0);
    setClipStart(null);
    setClipEnd(null);
    setStartInput("");
    setEndInput("");
    setInputError(false);
  }, [videoUrl, gifUrl]);

  // 时间轴拖拽：根据 clientX 计算秒数，并做 5 秒限制吸附
  const clientXToSec = useCallback((clientX: number) => {
    const el = timelineRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return x * videoDuration;
  }, [videoDuration]);

  const setStartFromSec = useCallback((sec: number) => {
    const end = clipEnd ?? videoDuration;
    const s = Math.max(0, Math.min(sec, videoDuration));
    // 开始点拖拽：小于结束点时圈选为 (s, end)；大于等于结束点时结束点自动变为 start+5 秒
    const newEnd = s < end ? end : Math.min(videoDuration, s + MAX_CLIP_SEC);
    setClipStart(s);
    setClipEnd(newEnd);
    setStartInput(String(Math.round(s * 10) / 10));
    setEndInput(String(Math.round(newEnd * 10) / 10));
    setInputError(false);
  }, [clipEnd, videoDuration]);

  const setEndFromSec = useCallback((sec: number) => {
    const start = clipStart ?? 0;
    const maxEnd = Math.min(videoDuration, start + MAX_CLIP_SEC); // 5秒限制：结束点最多拖到 start+5
    const e = Math.max(start, Math.min(sec, videoDuration, maxEnd));
    setClipStart(start);
    setClipEnd(e);
    setStartInput(String(Math.round(start * 10) / 10));
    setEndInput(String(Math.round(e * 10) / 10));
    setInputError(false);
  }, [clipStart, videoDuration]);

  const handleTimelinePointerDown = useCallback((e: React.PointerEvent, kind: "start" | "end") => {
    e.preventDefault();
    draggingRef.current = kind;
    if (kind === "start") setStartFromSec(clientXToSec(e.clientX));
    else setEndFromSec(clientXToSec(e.clientX));
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [clientXToSec, setStartFromSec, setEndFromSec]);

  const setStartFromSecRef = useRef(setStartFromSec);
  const setEndFromSecRef = useRef(setEndFromSec);
  setStartFromSecRef.current = setStartFromSec;
  setEndFromSecRef.current = setEndFromSec;

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (draggingRef.current === null) return;
      const sec = clientXToSec(e.clientX);
      if (draggingRef.current === "start") setStartFromSecRef.current(sec);
      else setEndFromSecRef.current(sec);
    };
    const onUp = () => { draggingRef.current = null; };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
    };
  }, [clientXToSec]);

  const handleStartInputChange = useCallback((v: string) => {
    setStartInput(v.replace(/\D/g, ""));
    const n = Math.max(0, Math.min(parseFloat(v.replace(/\D/g, "")) || 0, videoDuration));
    const end = clipEnd ?? videoDuration;
    if (n >= end) {
      // 开始 ≥ 结束：结束点自动更新为 开始+5 秒
      const newEnd = Math.min(videoDuration, n + MAX_CLIP_SEC);
      setInputError(false);
      setClipStart(n);
      setClipEnd(newEnd);
      setEndInput(String(Math.round(newEnd * 10) / 10));
    } else if (end - n > MAX_CLIP_SEC) {
      setInputError(true);
      setClipStart(end - MAX_CLIP_SEC);
      setStartInput(String(Math.round((end - MAX_CLIP_SEC) * 10) / 10));
    } else {
      setInputError(false);
      setClipStart(n);
      setClipEnd(end);
    }
  }, [clipEnd, videoDuration]);

  const handleEndInputChange = useCallback((v: string) => {
    setEndInput(v.replace(/\D/g, ""));
    const n = parseFloat(v.replace(/\D/g, "")) || 0;
    const start = clipStart ?? 0;
    if (n - start > MAX_CLIP_SEC) {
      setInputError(true);
      setClipEnd(start + MAX_CLIP_SEC);
      setEndInput(String(Math.round((start + MAX_CLIP_SEC) * 10) / 10));
    } else {
      setInputError(false);
      setClipStart(start);
      setClipEnd(n);
    }
  }, [clipStart, videoDuration]);

  const handleConvert = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !file || !isValidClip || clipStart === null || clipEnd === null) return;
    setStep("converting");
    setError(null);
    setProgress(0);
    try {
      const blob = await videoToGif(video, {
        maxWidth: 480,
        fps: 10,
        maxDuration: 6,
        numColors: 128,
        startTime: clipStart,
        endTime: clipEnd,
        onProgress: setProgress,
      });
      if (gifUrl) URL.revokeObjectURL(gifUrl);
      setGifUrl(URL.createObjectURL(blob));
      setStep("done");
      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "转换失败");
      setStep("error");
    }
  }, [file, gifUrl, isValidClip, clipStart, clipEnd]);

  const handleDownload = useCallback(() => {
    if (!gifUrl || !file) return;
    const a = document.createElement("a");
    a.href = gifUrl;
    a.download = getSuggestedName(file);
    a.click();
  }, [gifUrl, file]);

  const handleSaveAs = useCallback(async () => {
    if (!gifUrl || !file) return;
    if (!window.showSaveFilePicker) {
      handleDownload();
      return;
    }
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: getSuggestedName(file),
        types: [{ description: "GIF 图片", accept: { "image/gif": [".gif"] } }],
      });
      const w = await handle.createWritable();
      const blob = await fetch(gifUrl).then((r) => r.blob());
      await w.write(blob);
      await w.close();
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError("另存为失败，请尝试使用「下载」");
    }
  }, [gifUrl, file, handleDownload]);

  const handleReset = useCallback(() => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (gifUrl) URL.revokeObjectURL(gifUrl);
    setFile(null);
    setVideoUrl(null);
    setGifUrl(null);
    setStep("idle");
    setError(null);
    setProgress(0);
    setVideoDuration(0);
    setClipStart(null);
    setClipEnd(null);
    setStartInput("");
    setEndInput("");
    setInputError(false);
  }, [videoUrl, gifUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, [videoUrl]);

  const handlePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      if (hasSelection) {
        video.currentTime = clipStart!;
      }
      video.play();
    } else {
      video.pause();
    }
  }, [hasSelection, clipStart]);

  const startPercent = videoDuration > 0 && hasSelection ? (clipStart! / videoDuration) * 100 : 0;
  const endPercent = videoDuration > 0 && hasSelection ? (clipEnd! / videoDuration) * 100 : 100;

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] p-4 md:p-8">
      <div className="pointer-events-none fixed right-8 top-12 h-8 w-8 rounded-full border-[3px] border-[#1a1a1a] bg-[var(--accent-yellow)]" />
      <div className="pointer-events-none fixed bottom-24 left-12 text-2xl text-[#1a1a1a] opacity-60">✦</div>
      <div className="pointer-events-none fixed right-20 top-1/3 text-xl text-[#1a1a1a] opacity-50">★</div>

      <div className="mx-auto max-w-4xl space-y-6">
        <header className="relative rounded-2xl border-[3px] border-[#1a1a1a] bg-white p-6 shadow-[5px_5px_0_0_#1a1a1a]">
          <h1 className="text-3xl font-extrabold tracking-tight text-[#1a1a1a]">视频转 GIF</h1>
          <p className="mt-2 text-[#555]">上传视频，圈选片段（最长 5 秒）后转换为 GIF</p>
        </header>

        <Card className="relative overflow-hidden border-[3px] border-[#1a1a1a] bg-white shadow-[5px_5px_0_0_#1a1a1a]">
          <CardHeader>
            <CardTitle className="text-xl text-[#1a1a1a]">上传视频</CardTitle>
            <CardDescription>支持 MP4、WebM；左侧为 Video Cutter，圈选后仅转换该片段</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-[3px] border-dashed border-[#1a1a1a] bg-[var(--pastel-yellow)] p-8 transition-colors hover:bg-[var(--pastel-lavender)]">
              <input type="file" accept="video/*" className="hidden" onChange={handleFileChange} />
              <Upload className="mb-3 h-12 w-12 text-[#1a1a1a]" />
              <span className="font-bold text-[#1a1a1a]">{file ? file.name : "点击选择视频文件"}</span>
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 左侧：Video Cutter — 仅播放/暂停 + 时间轴起止点 + 起止输入 */}
              <div className="rounded-xl border-[3px] border-[#1a1a1a] bg-[#f5f5f5] p-2 min-h-[200px] flex flex-col">
                <p className="text-sm font-semibold text-[#1a1a1a] mb-2">Video Cutter</p>
                {videoUrl ? (
                  <div className="flex flex-col flex-1 gap-2">
                    <div className="relative flex-1 flex flex-col rounded-lg overflow-hidden bg-black/5">
                      <video
                        ref={videoRef}
                        src={videoUrl}
                        disablePictureInPicture
                        disableRemotePlayback
                        className="w-full flex-1 object-contain"
                        muted
                        playsInline
                        preload="metadata"
                        onLoadedMetadata={(e) => {
                          const d = e.currentTarget.duration;
                          if (Number.isFinite(d)) setVideoDuration(d);
                        }}
                      />
                      {/* 仅保留播放/暂停按钮 */}
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
                        <Button
                          type="button"
                          size="sm"
                          className="shadow-[3px_3px_0_#1a1a1a]"
                          onClick={handlePlayPause}
                        >
                          {!isPlaying ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    {videoDuration > 0 && (
                      <>
                        {/* 时间轴：仅显示秒数刻度 + 开始点/结束点可拖拽 */}
                        <div ref={timelineRef} className="relative h-10 rounded-lg bg-[#1a1a1a] px-1 flex items-center select-none touch-none">
                          {/* 秒数刻度 */}
                          <div className="absolute inset-x-0 top-0 flex text-[10px] text-white/80 pointer-events-none">
                            {Array.from({ length: Math.ceil(videoDuration) + 1 }, (_, i) => (
                              <span key={i} className="absolute transform -translate-x-1/2" style={{ left: `${(i / videoDuration) * 100}%` }}>{i}s</span>
                            ))}
                          </div>
                          {/* 已选范围高亮 */}
                          {hasSelection && (
                            <div
                              className="absolute top-1 bottom-1 rounded bg-[var(--accent-yellow)]/50 border border-[var(--accent-yellow)]"
                              style={{ left: `${startPercent}%`, width: `${endPercent - startPercent}%` }}
                            />
                          )}
                          {/* 开始点 */}
                          <div
                            role="slider"
                            aria-label="开始点"
                            className="absolute top-0 bottom-0 w-3 -ml-1.5 cursor-ew-resize z-10 rounded-l border-2 border-[#1a1a1a] bg-[var(--accent-yellow)]"
                            style={{ left: `${startPercent}%` }}
                            onPointerDown={(e) => handleTimelinePointerDown(e, "start")}
                          />
                          {/* 结束点 */}
                          <div
                            role="slider"
                            aria-label="结束点"
                            className="absolute top-0 bottom-0 w-3 -ml-1.5 cursor-ew-resize z-10 rounded-r border-2 border-[#1a1a1a] bg-[var(--accent-yellow)]"
                            style={{ left: `${endPercent}%` }}
                            onPointerDown={(e) => handleTimelinePointerDown(e, "end")}
                          />
                        </div>
                        <p className={`text-xs font-bold ${clipDurationSec >= MAX_CLIP_SEC ? "text-green-600" : "text-[#1a1a1a]"}`}>
                          当前时长：{hasSelection ? `${clipDurationSec.toFixed(1)}` : "—"}秒（最大{MAX_CLIP_SEC}秒）
                        </p>
                        {/* 手动输入起止时间（秒） */}
                        <div className="flex gap-2 items-center flex-wrap">
                          <label className="text-xs font-bold text-[#1a1a1a]">开始(秒)</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={startInput}
                            onChange={(e) => handleStartInputChange(e.target.value)}
                            className={`w-16 rounded border-2 px-2 py-1 text-sm ${inputError ? "border-red-500" : "border-[#1a1a1a]"}`}
                            placeholder="0"
                          />
                          <label className="text-xs font-bold text-[#1a1a1a]">结束(秒)</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={endInput}
                            onChange={(e) => handleEndInputChange(e.target.value)}
                            className={`w-16 rounded border-2 px-2 py-1 text-sm ${inputError ? "border-red-500" : "border-[#1a1a1a]"}`}
                            placeholder="5"
                          />
                        </div>
                        {inputError && <p className="text-xs text-red-600">最长仅可剪辑5秒</p>}
                        {isShortVideo && <p className="text-xs text-[#555]">视频不足5秒，已全选</p>}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 rounded-lg bg-[var(--pastel-blue)]/50 border-2 border-dashed border-[#1a1a1a] flex items-center justify-center text-[#555] text-sm">
                    选择视频后显示
                  </div>
                )}
              </div>
              <div className="rounded-xl border-[3px] border-[#1a1a1a] bg-[#f5f5f5] p-2 min-h-[200px] flex flex-col">
                <p className="text-sm font-semibold text-[#1a1a1a] mb-2">GIF 预览</p>
                {step === "converting" && (
                  <div className="flex-1 flex flex-col justify-center rounded-lg bg-[var(--pastel-blue)] p-4">
                    <Loader2 className="h-8 w-8 animate-spin text-[#1a1a1a] mx-auto mb-2" />
                    <p className="font-bold text-[#1a1a1a] text-center text-sm">正在生成 GIF…</p>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white border border-[#1a1a1a]">
                      <div
                        className="h-full rounded-full bg-[var(--accent-yellow)] border-r-2 border-[#1a1a1a] transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}
                {step === "done" && gifUrl && (
                  <img src={gifUrl} alt="生成的 GIF" className="w-full rounded-lg flex-1 object-contain" />
                )}
                {step !== "converting" && step !== "done" && (
                  <div className="flex-1 rounded-lg bg-[var(--pastel-lavender)]/50 border-2 border-dashed border-[#1a1a1a] flex items-center justify-center text-[#555] text-sm">
                    圈选片段后点击「转换 GIF」显示
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="rounded-xl border-[3px] border-[#1a1a1a] bg-[#ffd6d6] p-4 font-medium text-[#1a1a1a]">{error}</div>
            )}
          </CardContent>
          <CardFooter className="flex flex-wrap gap-3">
            {step === "ready" && (
              <Button onClick={handleConvert} size="lg" disabled={!isValidClip}>
                <Film className="mr-2 h-5 w-5" />
                转换 GIF
              </Button>
            )}
            {step === "done" && (
              <>
                <Button onClick={handleSaveAs} size="lg">
                  <Save className="mr-2 h-5 w-5" />
                  另存为…
                </Button>
                <Button variant="secondary" onClick={handleDownload} size="lg">
                  <Download className="mr-2 h-5 w-5" />
                  下载到默认目录
                </Button>
              </>
            )}
            {(step === "ready" || step === "done" || step === "error") && (
              <Button variant="secondary" onClick={handleReset}>
                重新选择
              </Button>
            )}
          </CardFooter>
        </Card>

        <footer className="text-center text-sm text-[#555]">在浏览器中本地转换，视频不会上传到服务器</footer>
      </div>
    </div>
  );
}
