"use client";

import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";

// Standalone, print-friendly QR poster pointing at the landing page.
export default function QrPage() {
  const [url, setUrl] = useState("");
  useEffect(() => setUrl(window.location.origin), []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-white p-10 text-center text-zinc-900">
      <div>
        <h1 className="text-6xl font-black tracking-tight">
          crewd<span className="text-violet-600">.</span>
        </h1>
        <p className="mt-3 text-2xl text-zinc-500">Scan to find your hackathon crew</p>
      </div>
      <div className="rounded-3xl border-4 border-zinc-900 p-6 shadow-xl">
        {url ? (
          <QRCodeSVG value={url} size={340} />
        ) : (
          <div className="size-[340px] animate-pulse rounded bg-zinc-100" />
        )}
      </div>
      <p className="font-mono text-sm text-zinc-400">{url}</p>
    </main>
  );
}
