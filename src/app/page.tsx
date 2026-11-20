import RebuildForm from "./_components/rebuild-form";

const USAGE = `import { openPrint, rebuild } from "@piro0919/image-to-pdf";

const { html, unclear, usage } = await rebuild(file, {
  provider: "openai", // "anthropic" | "openai" | "google"
  apiKey,             // the user's own key
});

await openPrint(html); // opens the print dialog; choose "Save as PDF"`;

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0d0f12] text-zinc-200">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <header>
          <p className="font-mono text-xs tracking-[0.2em] text-sky-400/80 uppercase">
            npm i @piro0919/image-to-pdf
          </p>
          <h1 className="font-display mt-4 text-4xl leading-tight font-bold text-white sm:text-5xl">
            Photo in, typeset PDF out.
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-zinc-400">
            Turn a photo of a paper document into a clean PDF. The page is read
            by an AI model and typeset again as real text, with its tables and
            boxes laid out like the original. It is not the photo pasted into a
            PDF.
          </p>
        </header>

        <section className="mt-14">
          <RebuildForm />
        </section>

        <section className="mt-16">
          <h2 className="font-display text-xl font-bold text-white">
            Use it in your own app
          </h2>
          <pre className="mt-6 overflow-x-auto rounded-xl border border-white/10 bg-[#11151a] p-5 font-mono text-[13px] leading-relaxed text-zinc-300">
            <code>{USAGE}</code>
          </pre>
        </section>

        <footer className="mt-20 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/10 pt-8 font-mono text-sm text-zinc-500">
          <a
            className="hover:text-sky-300"
            href="https://www.npmjs.com/package/@piro0919/image-to-pdf"
          >
            npm
          </a>
          <a
            className="hover:text-sky-300"
            href="https://github.com/piro0919/image-to-pdf"
          >
            GitHub
          </a>
          <a
            className="hover:text-sky-300"
            href="https://buymeacoffee.com/piro0919"
          >
            Buy Me a Coffee
          </a>
          <a className="hover:text-sky-300" href="https://kkweb.io/">
            kkweb.io
          </a>
          <span className="ml-auto">MIT</span>
        </footer>
      </div>
    </div>
  );
}
