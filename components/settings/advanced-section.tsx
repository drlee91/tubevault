"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { updateSettingsAction } from "@/lib/actions/settings-actions";

type CheckResult =
  | { ok: true; version: string }
  | { ok: false; error: string };

interface Props {
  initial: {
    ytdlpPath: string | null;
    ffmpegPath: string | null;
  };
}

export function AdvancedSection({ initial }: Props) {
  const [ytdlpPath, setYtdlpPath] = useState(initial.ytdlpPath ?? "");
  const [ytdlpResult, setYtdlpResult] = useState<CheckResult | null>(null);
  const [savingYtdlp, startSaveYtdlp] = useTransition();
  const [testingYtdlp, startTestYtdlp] = useTransition();

  const [ffmpegPath, setFfmpegPath] = useState(initial.ffmpegPath ?? "");
  const [ffmpegResult, setFfmpegResult] = useState<CheckResult | null>(null);
  const [savingFfmpeg, startSaveFfmpeg] = useTransition();
  const [testingFfmpeg, startTestFfmpeg] = useTransition();

  function testYtdlp() {
    startTestYtdlp(async () => {
      const res = await fetch("/api/selfcheck/ytdlp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: ytdlpPath || undefined }),
      });
      const data: CheckResult = await res.json();
      setYtdlpResult(data);
    });
  }

  function saveYtdlp() {
    startSaveYtdlp(async () => {
      const r = await updateSettingsAction({ ytdlpPath: ytdlpPath || null });
      if (r.ok) {
        toast.success("yt-dlp path saved");
      } else {
        toast.error("Save failed", { description: r.error.message });
      }
    });
  }

  function testFfmpeg() {
    startTestFfmpeg(async () => {
      const res = await fetch("/api/selfcheck/ffmpeg", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: ffmpegPath || undefined }),
      });
      const data: CheckResult = await res.json();
      setFfmpegResult(data);
    });
  }

  function saveFfmpeg() {
    startSaveFfmpeg(async () => {
      const r = await updateSettingsAction({ ffmpegPath: ffmpegPath || null });
      if (r.ok) {
        toast.success("ffmpeg path saved");
      } else {
        toast.error("Save failed", { description: r.error.message });
      }
    });
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-base font-medium">Advanced</h2>
        <p className="text-sm text-[var(--color-fg-muted)]">
          External tools for downloading and post-processing.
        </p>
      </div>

      {/* yt-dlp */}
      <div className="space-y-2">
        <Label htmlFor="ytdlp-path">yt-dlp path</Label>
        <p className="text-xs text-[var(--color-fg-muted)]">
          Full path to the yt-dlp binary. Leave empty to use the system default.
        </p>
        <div className="flex items-center gap-2 max-w-xl">
          <Input
            id="ytdlp-path"
            value={ytdlpPath}
            onChange={(e) => setYtdlpPath(e.target.value)}
            placeholder="yt-dlp"
            className="flex-1"
          />
          <Button
            variant="outline"
            onClick={saveYtdlp}
            disabled={savingYtdlp}
          >
            {savingYtdlp ? "Saving…" : "Save"}
          </Button>
          <Button
            variant="outline"
            onClick={testYtdlp}
            disabled={testingYtdlp}
          >
            {testingYtdlp ? "Testing…" : "Test"}
          </Button>
        </div>
        {ytdlpResult !== null && (
          <div
            className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm max-w-xl ${
              ytdlpResult.ok
                ? "border-[var(--color-line)] bg-[var(--color-status-bg-available)] text-[var(--color-status-available)]"
                : "border-[var(--color-line)] bg-[var(--color-status-bg-removed)] text-[var(--color-status-removed)]"
            }`}
          >
            {ytdlpResult.ok ? (
              <>
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  <span className="font-medium">OK</span> — {ytdlpResult.version}
                </span>
              </>
            ) : (
              <>
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  <span className="font-medium">Error</span> — {ytdlpResult.error}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* ffmpeg */}
      <div className="space-y-2">
        <Label htmlFor="ffmpeg-path">ffmpeg path</Label>
        <p className="text-xs text-[var(--color-fg-muted)]">
          Full path to the ffmpeg binary. Leave empty to use the system default.
        </p>
        <div className="flex items-center gap-2 max-w-xl">
          <Input
            id="ffmpeg-path"
            value={ffmpegPath}
            onChange={(e) => setFfmpegPath(e.target.value)}
            placeholder="ffmpeg"
            className="flex-1"
          />
          <Button
            variant="outline"
            onClick={saveFfmpeg}
            disabled={savingFfmpeg}
          >
            {savingFfmpeg ? "Saving…" : "Save"}
          </Button>
          <Button
            variant="outline"
            onClick={testFfmpeg}
            disabled={testingFfmpeg}
          >
            {testingFfmpeg ? "Testing…" : "Test"}
          </Button>
        </div>
        {ffmpegResult !== null && (
          <div
            className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm max-w-xl ${
              ffmpegResult.ok
                ? "border-[var(--color-line)] bg-[var(--color-status-bg-available)] text-[var(--color-status-available)]"
                : "border-[var(--color-line)] bg-[var(--color-status-bg-removed)] text-[var(--color-status-removed)]"
            }`}
          >
            {ffmpegResult.ok ? (
              <>
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  <span className="font-medium">OK</span> — {ffmpegResult.version}
                </span>
              </>
            ) : (
              <>
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  <span className="font-medium">Error</span> — {ffmpegResult.error}
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
