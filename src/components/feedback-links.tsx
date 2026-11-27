"use client";

import { useState } from "react";
import { Check, Hash, Link2, MapPin } from "lucide-react";
import { button } from "./styles";

/** Copy the feedback id / dashboard link, or open the comment pinned on the live page. */
export function FeedbackLinks({ id, link, onPage }: { id: string; link: string; onPage: string | null }) {
  const [copied, setCopied] = useState<"id" | "link" | null>(null);
  const copy = async (what: "id" | "link", text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied((c) => (c === what ? null : c)), 1500);
    } catch {
      prompt("Copy:", text);
    }
  };

  return (
    <>
      <button type="button" onClick={() => copy("id", id)} className={button.ghost} title={`Copy ID ${id}`}>
        {copied === "id" ? <Check size={14} /> : <Hash size={14} />}
        <span className="hidden sm:inline">{copied === "id" ? "Copied" : "Copy ID"}</span>
      </button>
      <button type="button" onClick={() => copy("link", link)} className={button.ghost} title="Copy link to this feedback">
        {copied === "link" ? <Check size={14} /> : <Link2 size={14} />}
        <span className="hidden sm:inline">{copied === "link" ? "Copied" : "Copy link"}</span>
      </button>
      {onPage && (
        <a href={onPage} target="_blank" rel="noopener noreferrer" className={button.ghost} title="Open this comment on the page">
          <MapPin size={14} />
          <span className="hidden md:inline">Open on page</span>
        </a>
      )}
    </>
  );
}

/** Small hover button on a feedback row that copies the item's link (path is made absolute on click). */
export function CopyRowLink({ path, id }: { path: string; id: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const url = new URL(path, window.location.origin).toString();
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          prompt("Copy:", url);
        }
      }}
      title={`Copy link to ${id}`}
      aria-label={`Copy link to ${id}`}
      className={`relative z-10 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:opacity-100 ${
        copied ? "opacity-100" : "opacity-0 group-hover:opacity-100"
      }`}
    >
      {copied ? <Check size={13} /> : <Link2 size={13} />}
    </button>
  );
}
