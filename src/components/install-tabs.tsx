"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CopyButton } from "./settings-forms";

type Platform = { id: string; label: string; steps: React.ReactNode; code: string };

function platforms(src: string, key: string): Platform[] {
  const tag = `<script src="${src}" data-key="${key}" async></script>`;
  return [
    {
      id: "html",
      label: "HTML",
      steps: <>Paste before the closing <code>&lt;/body&gt;</code> tag on every page you want reviewed.</>,
      code: tag,
    },
    {
      id: "next",
      label: "Next.js",
      steps: (
        <>
          Add to <code>app/layout.tsx</code> (App Router) or <code>pages/_app.tsx</code>, inside <code>&lt;body&gt;</code>.
        </>
      ),
      code: `import Script from "next/script";

// inside <body>
<Script src="${src}" data-key="${key}" strategy="afterInteractive" />`,
    },
    {
      id: "react",
      label: "React / Vite",
      steps: <>Add to <code>index.html</code> before <code>&lt;/body&gt;</code>. It works with any client-side router.</>,
      code: tag,
    },
    {
      id: "wordpress",
      label: "WordPress",
      steps: (
        <>
          Use a header/footer code plugin (e.g. <em>WPCode</em>) and add this to the <strong>footer</strong>, or paste it into your
          theme&apos;s <code>footer.php</code> before <code>&lt;/body&gt;</code>.
        </>
      ),
      code: tag,
    },
    {
      id: "nocode",
      label: "Shopify / Webflow",
      steps: (
        <>
          <strong>Webflow:</strong> Site settings → Custom code → Footer code. <strong>Shopify:</strong> Online Store → Themes → Edit
          code → <code>theme.liquid</code>, before <code>&lt;/body&gt;</code>. Publish afterwards.
        </>
      ),
      code: tag,
    },
    {
      id: "gtm",
      label: "Google Tag Manager",
      steps: <>New tag → Custom HTML → paste this → trigger: All Pages → Submit / Publish.</>,
      code: `<script>
  (function () {
    var s = document.createElement("script");
    s.src = "${src}";
    s.async = true;
    s.setAttribute("data-key", "${key}");
    document.body.appendChild(s);
  })();
</script>`,
    },
  ];
}

export function InstallTabs({ src, publicKey }: { src: string; publicKey: string }) {
  const list = platforms(src, publicKey);
  const [active, setActive] = useState(list[0].id);
  const cur = list.find((p) => p.id === active)!;
  return (
    <div>
      <div role="tablist" aria-label="Platform" className="-mx-1 flex flex-wrap gap-1 pb-3">
        {list.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={p.id === active}
            onClick={() => setActive(p.id)}
            className={`h-7 rounded-md px-2.5 text-[13px] font-medium transition-colors ${
              p.id === active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <p className="text-[13px] text-muted-foreground [&_code]:font-mono [&_code]:text-xs [&_code]:text-foreground">{cur.steps}</p>
      <div className="mt-3 flex items-start gap-2">
        <pre className="min-w-0 flex-1 overflow-x-auto rounded-md border border-border bg-muted px-3 py-2.5 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
          {cur.code}
        </pre>
        <CopyButton text={cur.code} />
      </div>
    </div>
  );
}

/**
 * Drag-to-bookmarks link that injects the widget into whatever page is open.
 * React blocks `javascript:` hrefs, so the href is set on the DOM node directly.
 */
export function Bookmarklet({ src, publicKey }: { src: string; publicKey: string }) {
  const code = `javascript:(function(){if(window.__fbWidget){alert('Fixes is already on this page');return;}var s=document.createElement('script');s.src=${JSON.stringify(
    src,
  )}+'?t='+Date.now();s.async=true;s.setAttribute('data-key',${JSON.stringify(publicKey)});s.onerror=function(){alert('Fixes: could not load the widget. The site may block external scripts (CSP).');};document.body.appendChild(s);})();`;
  return (
    <a
      ref={(el) => {
        if (el) el.setAttribute("href", code);
      }}
      href="#"
      onClick={(e) => {
        e.preventDefault();
        alert("Drag this button to your bookmarks bar, then click it on any page to start reviewing.");
      }}
      draggable
      className="inline-flex h-8 cursor-grab items-center gap-1.5 rounded-md border border-dashed border-border px-3 text-[13px] font-medium hover:bg-accent active:cursor-grabbing"
      title="Drag to your bookmarks bar"
    >
      ⠿ Review with Fixes
    </a>
  );
}

/** Re-fetches the server data for the current page (e.g. to re-check install status). */
export function CheckAgainButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
      className="shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-60"
    >
      {pending ? "Checking…" : "Check again"}
    </button>
  );
}
