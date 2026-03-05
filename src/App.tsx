import { useCallback, useRef, useState } from "react";
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
import { Upload, Film, Download, Loader2, Save } from "lucide-react";

type Step = "idle" | "ready" | "converting" | "done" | "error";

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
  const videoRef = useRef<HTMLVideoElement>(null);

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
  }, [videoUrl, gifUrl]);

  const handleConvert = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !file) return;
    setStep("converting");
    setError(null);
    setProgress(0);
    try {
      const blob = await videoToGif(video, {
        maxWidth: 480,
        fps: 10,
        maxDuration: 6,
        numColors: 128,
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
  }, [file, videoUrl, gifUrl]);

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
      if ((err as Error).name !== "AbortError") {
        setError("另存为失败，请尝试使用「下载」");
      }
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
  }, [videoUrl, gifUrl]);

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] p-4 md:p-8">
      {/* 装饰元素 */}
      <div className="pointer-events-none fixed right-8 top-12 h-8 w-8 rounded-full border-[3px] border-[#1a1a1a] bg-[var(--accent-yellow)]" />
      <div className="pointer-events-none fixed bottom-24 left-12 text-2xl text-[#1a1a1a] opacity-60">✦</div>
      <div className="pointer-events-none fixed right-20 top-1/3 text-xl text-[#1a1a1a] opacity-50">★</div>

      <div className="mx-auto max-w-4xl space-y-6">
        <header className="relative rounded-2xl border-[3px] border-[#1a1a1a] bg-white p-6 shadow-[5px_5px_0_0_#1a1a1a]">
          <h1 className="text-3xl font-extrabold tracking-tight text-[#1a1a1a]">
            视频转 GIF
          </h1>
          <p className="mt-2 text-[#555]">
            上传视频，一键转换为 GIF 动图并下载
          </p>
        </header>

        <Card className="relative overflow-hidden border-[3px] border-[#1a1a1a] bg-white shadow-[5px_5px_0_0_#1a1a1a]">
          <CardHeader>
            <CardTitle className="text-xl text-[#1a1a1a]">上传视频</CardTitle>
            <CardDescription>支持 MP4、WebM 等常见格式，建议时长 6 秒内</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-[3px] border-dashed border-[#1a1a1a] bg-[var(--pastel-yellow)] p-8 transition-colors hover:bg-[var(--pastel-lavender)]">
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <Upload className="mb-3 h-12 w-12 text-[#1a1a1a]" />
              <span className="font-bold text-[#1a1a1a]">
                {file ? file.name : "点击选择视频文件"}
              </span>
            </label>

            {/* 左右并排：视频预览 | GIF 预览 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border-[3px] border-[#1a1a1a] bg-[#f5f5f5] p-2 min-h-[200px] flex flex-col">
                <p className="text-sm font-semibold text-[#1a1a1a] mb-2">视频预览</p>
                {videoUrl ? (
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    controls
                    className="w-full rounded-lg flex-1 object-contain bg-black/5"
                    muted
                    playsInline
                    preload="metadata"
                  />
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
                  <img
                    src={gifUrl}
                    alt="生成的 GIF"
                    className="w-full rounded-lg flex-1 object-contain"
                  />
                )}
                {step !== "converting" && step !== "done" && (
                  <div className="flex-1 rounded-lg bg-[var(--pastel-lavender)]/50 border-2 border-dashed border-[#1a1a1a] flex items-center justify-center text-[#555] text-sm">
                    转换完成后显示
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="rounded-xl border-[3px] border-[#1a1a1a] bg-[#ffd6d6] p-4 font-medium text-[#1a1a1a]">
                {error}
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-wrap gap-3">
            {step === "ready" && (
              <Button onClick={handleConvert} size="lg">
                <Film className="mr-2 h-5 w-5" />
                转为 GIF
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

        <footer className="text-center text-sm text-[#555]">
          在浏览器中本地转换，视频不会上传到服务器
        </footer>
      </div>
    </div>
  );
}
