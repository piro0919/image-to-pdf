"use client";

import { useState } from "react";
import {
  openPrint,
  type Provider,
  type RebuildResult,
  rebuild,
} from "@piro0919/image-to-pdf";

const PROVIDERS: { id: Provider; label: string }[] = [
  { id: "anthropic", label: "Claude" },
  { id: "openai", label: "OpenAI" },
  { id: "google", label: "Gemini" },
];

// 試作（spike/run.ts）で比べた各社の上位と下位。先頭がパッケージの既定
const MODELS: Record<Provider, string[]> = {
  anthropic: ["claude-sonnet-5-5", "claude-haiku-5-5"],
  openai: ["gpt-6.2-sol", "gpt-6-luna"],
  google: ["gemini-3.8-flash", "gemini-3.5-flash-lite"],
};

function Band<T extends string>({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: T) => void;
  options: { id: T; label: string }[];
  value: T;
}) {
  return (
    <div
      aria-label={label}
      className="flex rounded-lg border border-white/10 bg-white/[0.03] p-1"
      role="radiogroup"
    >
      {options.map((option) => (
        <button
          aria-checked={value === option.id}
          className={`flex-1 rounded-md px-3 py-2 text-sm transition-colors ${
            value === option.id
              ? "bg-sky-400/15 text-sky-200"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
          key={option.id}
          onClick={() => onChange(option.id)}
          role="radio"
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default function RebuildForm() {
  const [provider, setProvider] = useState<Provider>("anthropic");
  const [model, setModel] = useState(MODELS.anthropic[0] ?? "");
  const [apiKey, setApiKey] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RebuildResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const label = PROVIDERS.find((p) => p.id === provider)?.label ?? "";

  async function run() {
    if (!photo || !apiKey) return;
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      setResult(
        await rebuild(photo, { provider, model, apiKey: apiKey.trim() }),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-5">
      <Band
        label="Provider"
        onChange={(next) => {
          setProvider(next);
          setModel(MODELS[next][0] ?? "");
        }}
        options={PROVIDERS}
        value={provider}
      />

      <Band
        label="Model"
        onChange={setModel}
        options={MODELS[provider].map((id) => ({ id, label: id }))}
        value={model}
      />

      <div>
        <input
          aria-label={`${label} API key`}
          autoComplete="off"
          className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 font-mono text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-sky-400/50 focus:outline-none"
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={`${label} API key`}
          spellCheck={false}
          type="password"
          value={apiKey}
        />
        <p className="mt-2 text-xs text-zinc-500">
          Your key goes from this browser straight to {label}. It is not
          stored.
        </p>
      </div>

      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-dashed border-white/15 px-4 py-3 text-sm transition-colors hover:border-sky-400/40">
        <span className={photo ? "truncate text-zinc-200" : "text-zinc-500"}>
          {photo ? photo.name : "Choose a photo"}
        </span>
        <input
          accept="image/*"
          className="sr-only"
          onChange={(event) => {
            setPhoto(event.target.files?.[0] ?? null);
            setResult(null);
          }}
          type="file"
        />
      </label>

      <div className="flex flex-wrap items-center gap-4">
        <button
          className="rounded-lg bg-sky-400 px-5 py-2.5 text-sm font-medium text-[#0d0f12] transition-colors hover:bg-sky-300 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
          disabled={!photo || !apiKey.trim() || running}
          onClick={run}
          type="button"
        >
          {running ? "Rebuilding" : "Rebuild"}
        </button>
        {result ? (
          <button
            className="rounded-lg border border-sky-400/60 px-5 py-2.5 text-sm text-sky-200 transition-colors hover:border-sky-300 hover:text-sky-100"
            onClick={() => void openPrint(result.html)}
            type="button"
          >
            Save as PDF
          </button>
        ) : null}
      </div>

      {result ? (
        <dl className="flex flex-wrap gap-x-8 gap-y-3 font-mono text-sm">
          <Stat label="unclear" value={result.unclear} />
          <Stat label="tokens in" value={result.usage.inputTokens} />
          <Stat label="tokens out" value={result.usage.outputTokens} />
          <div>
            <dt className="text-xs text-zinc-500">model</dt>
            <dd className="text-zinc-200">{result.model}</dd>
          </div>
        </dl>
      ) : null}

      {error ? (
        <p className="text-sm break-words text-red-300">{error}</p>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="text-lg text-zinc-100">{value.toLocaleString("en-US")}</dd>
    </div>
  );
}
