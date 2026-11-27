import { toJpeg } from "html-to-image";
import { selectorFor } from "./selector";
import { CSS } from "./styles";

/*
 * Embed:
 *   <script src="https://YOUR_HOST/widget.js" data-key="pk_xxx" async></script>
 * Optional: data-api="https://api.host" (defaults to the script's origin)
 */

type Reply = { id: string; body: string; authorName: string; createdAt: string };
type Comment = {
  id: string;
  selector: string;
  offsetX: number;
  offsetY: number;
  pageX: number;
  pageY: number;
  body: string;
  authorName: string;
  status: "open" | "resolved";
  createdAt: string;
  replies: Reply[];
};

type Me = { id: string; name: string; email: string };

type Draft = {
  selector: string;
  offsetX: number;
  offsetY: number;
  pageX: number;
  pageY: number;
  elementText: string;
  screenshot: Promise<string | null>;
};

(function init() {
  if ((window as unknown as { __fbWidget?: boolean }).__fbWidget) return;
  (window as unknown as { __fbWidget?: boolean }).__fbWidget = true;

  const script =
    (document.currentScript as HTMLScriptElement | null) ??
    document.querySelector<HTMLScriptElement>("script[data-key][src*='widget']");
  const KEY = script?.dataset.key;
  if (!KEY) {
    console.warn("[feedback] widget.js is missing data-key");
    return;
  }
  const API = (script?.dataset.api ?? new URL(script!.src).origin).replace(/\/$/, "");
  const TOKEN_KEY = `fb_widget_token:${KEY}`;
  const POS_KEY = "fb_widget_pos";
  const EDGE = 8; // min gap between launcher and viewport edge

  // Launcher position, anchored to the nearest horizontal/vertical edge so it grows
  // toward the middle of the screen when the toolbar opens.
  type Pos = { h: "left" | "right"; x: number; v: "top" | "bottom"; y: number };
  const DEFAULT_POS: Pos = { h: "right", x: 20, v: "bottom", y: 20 };

  // ---------- state ----------
  let open = false; // pins + toolbar visible
  let picking = false; // click-to-comment mode
  let showResolved = false;
  let comments: Comment[] = [];
  let activeId: string | null = null;
  let draft: Draft | null = null;
  let lastUrl = location.href;
  let me: Me | null = null; // signed-in, invited project member
  let signingIn = false; // Google popup open, waiting for the hand-off
  let notice = ""; // short message shown next to the launcher

  // ---------- DOM ----------
  const host = document.createElement("div");
  host.setAttribute("data-feedback-widget", "");
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = CSS;
  const root = document.createElement("div");
  root.className = "root";
  shadow.append(style, root);
  (document.body ?? document.documentElement).appendChild(host);

  const h = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    props: Record<string, unknown> = {},
    ...children: (Node | string | null | false)[]
  ): HTMLElementTagNameMap[K] => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v as EventListener);
      else if (k === "className") el.className = String(v);
      else if (v !== undefined && v !== false) el.setAttribute(k, v === true ? "" : String(v));
    }
    for (const c of children) if (c) el.append(c);
    return el;
  };

  const highlight = h("div", { className: "highlight" });
  highlight.style.display = "none";

  const getToken = () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  };
  const setToken = (t: string | null) => {
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage blocked */
    }
  };

  const loadPos = (): Pos => {
    try {
      const p = JSON.parse(localStorage.getItem(POS_KEY) ?? "null");
      if (
        p &&
        (p.h === "left" || p.h === "right") &&
        (p.v === "top" || p.v === "bottom") &&
        Number.isFinite(p.x) &&
        Number.isFinite(p.y)
      )
        return p;
    } catch {
      /* storage blocked or bad JSON */
    }
    return { ...DEFAULT_POS };
  };
  const savePos = (p: Pos | null) => {
    try {
      if (p) localStorage.setItem(POS_KEY, JSON.stringify(p));
      else localStorage.removeItem(POS_KEY);
    } catch {
      /* storage blocked */
    }
  };
  let pos = loadPos();

  const ago = (iso: string) => {
    const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  };

  // ---------- API ----------
  async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const token = getToken();
    const res = await fetch(API + path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    // Session expired or the person was removed from the project.
    if (res.status === 401) signedOut("Your session ended. Sign in again to comment.");
    if (!res.ok) throw Object.assign(new Error(data.error ?? `Request failed (${res.status})`), { status: res.status });
    return data as T;
  }

  async function load() {
    try {
      const q = new URLSearchParams({ key: KEY!, url: location.href });
      const data = await api<{ comments: Comment[]; user: Me | null }>(`/api/widget/comments?${q}`);
      if (!data.user && getToken()) return signedOut("Your session ended. Sign in again to comment.");
      me = data.user;
      comments = data.comments;
      render();
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 403 || status === 404) setupProblem(status);
      else console.warn("[feedback]", e);
    }
  }

  // The site owner needs to change a setting. Explain it in the console everywhere, and on
  // local/dev addresses also show a notice on the page (real visitors never see it).
  function setupProblem(status: number) {
    const fix =
      status === 403
        ? `This site (${location.origin}) isn't in the project's Allowed origins. Add it in Fixes → project → Settings → Allowed origins (or use the "Allow" button on the Install card).`
        : `The project key "${KEY}" doesn't exist. Copy the snippet again from Fixes → project → Settings → Install.`;
    console.warn(`[Fixes] Widget disabled. ${fix}`);
    const local = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\]|0\.0\.0\.0|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|.+\.local)$/i.test(location.hostname);
    if (!local) return;
    const note = h(
      "div",
      { className: "setup", role: "status" },
      h("strong", {}, "Fixes widget is disabled"),
      h("p", {}, fix),
      h("button", { className: "close", title: "Dismiss", onclick: () => note.remove() }, "×"),
    );
    root.append(note);
  }

  // ---------- sign-in (Google, invited members only) ----------
  // The popup runs on the Fixes domain, signs in with Google and checks the invite. The widget
  // polls for the result with a one-time nonce instead of relying on window.opener, which
  // Google's sign-in pages can cut off.
  function signedOut(message = "") {
    setToken(null);
    me = null;
    comments = [];
    open = picking = false;
    draft = null;
    activeId = null;
    notice = message;
    render();
  }

  let pollTimer = 0;
  function stopSignIn() {
    clearTimeout(pollTimer);
    signingIn = false;
  }

  function signIn() {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const nonce = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    const q = new URLSearchParams({ key: KEY!, origin: location.origin, nonce });
    const w = 480;
    const hgt = 640;
    const popup = window.open(
      `${API}/widget/auth?${q}`,
      "fixes-sign-in",
      `width=${w},height=${hgt},left=${Math.round(screenX + (outerWidth - w) / 2)},top=${Math.round(screenY + (outerHeight - hgt) / 2)}`,
    );
    if (!popup) {
      notice = "Allow pop-ups for this site to sign in.";
      return render();
    }
    stopSignIn();
    signingIn = true;
    notice = "";
    render();

    const deadline = Date.now() + 10 * 60_000;
    const poll = async () => {
      if (!signingIn) return;
      try {
        const res = await api<{ token: string | null; user?: Me }>("/api/widget/session", {
          method: "POST",
          body: JSON.stringify({ key: KEY, nonce }),
        });
        if (!signingIn) return;
        if (res.token && res.user) {
          stopSignIn();
          setToken(res.token);
          me = res.user;
          open = picking = true;
          await load();
          return render();
        }
      } catch (e) {
        console.warn("[feedback] sign-in check failed", e);
      }
      if (Date.now() > deadline) {
        stopSignIn();
        notice = "Sign-in timed out. Try again.";
        return render();
      }
      pollTimer = window.setTimeout(poll, 1500);
    };
    pollTimer = window.setTimeout(poll, 1500);
  }

  async function signOut() {
    try {
      await api("/api/widget/session", { method: "DELETE" });
    } catch {
      /* token already gone */
    }
    signedOut();
  }

  // ---------- positioning ----------
  function pinPoint(c: { selector: string; offsetX: number; offsetY: number; pageX: number; pageY: number }) {
    let el: Element | null = null;
    try {
      el = document.querySelector(c.selector);
    } catch {
      /* invalid selector */
    }
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.width || r.height) return { x: r.left + c.offsetX * r.width, y: r.top + c.offsetY * r.height };
    }
    return { x: c.pageX - scrollX, y: c.pageY - scrollY };
  }

  function placeCard(card: HTMLElement, x: number, y: number) {
    const W = 320;
    const left = x + 24 + W > innerWidth ? Math.max(8, x - W - 16) : x + 24;
    card.style.left = `${left}px`;
    card.style.top = `${Math.max(8, Math.min(y - 20, innerHeight - 260))}px`;
  }

  // ---------- movable launcher ----------
  let launcherEl: HTMLElement | null = null;
  let drag: { sx: number; sy: number; left: number; top: number; w: number; h: number; moved: boolean } | null = null;
  let suppressClick = false;

  const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), Math.max(min, max));

  function placeLauncher() {
    const el = launcherEl;
    if (!el) return;
    // Keep the button order fixed mid-drag; flip it once the drop settles the anchor side.
    if (!drag?.moved) el.classList.toggle("left", pos.h === "left");
    el.classList.toggle("top", pos.v === "top");
    const r = el.getBoundingClientRect();
    const x = clamp(pos.x, EDGE, innerWidth - r.width - EDGE);
    const y = clamp(pos.y, EDGE, innerHeight - r.height - EDGE);
    el.style.left = el.style.right = el.style.top = el.style.bottom = "";
    el.style[pos.h] = `${x}px`;
    el.style[pos.v] = `${y}px`;
  }

  // Convert an absolute top-left into a position anchored to the closest edges.
  function toPos(left: number, top: number, w: number, hgt: number): Pos {
    const leftSide = left + w / 2 < innerWidth / 2;
    const topSide = top + hgt / 2 < innerHeight / 2;
    return {
      h: leftSide ? "left" : "right",
      x: Math.round(leftSide ? left : innerWidth - left - w),
      v: topSide ? "top" : "bottom",
      y: Math.round(topSide ? top : innerHeight - top - hgt),
    };
  }

  function onDragStart(e: PointerEvent) {
    if (e.button !== 0 || !launcherEl) return;
    const r = launcherEl.getBoundingClientRect();
    drag = { sx: e.clientX, sy: e.clientY, left: r.left, top: r.top, w: r.width, h: r.height, moved: false };
  }

  function onDragMove(e: PointerEvent) {
    if (!drag || !launcherEl) return;
    const dx = e.clientX - drag.sx;
    const dy = e.clientY - drag.sy;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < 5) return; // small jitter is still a click
      drag.moved = true;
      launcherEl.classList.add("dragging");
    }
    e.preventDefault();
    const left = clamp(drag.left + dx, EDGE, innerWidth - drag.w - EDGE);
    const top = clamp(drag.top + dy, EDGE, innerHeight - drag.h - EDGE);
    pos = toPos(left, top, drag.w, drag.h);
    placeLauncher();
  }

  function onDragEnd() {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    if (!moved) return;
    launcherEl?.classList.remove("dragging");
    savePos(pos);
    placeLauncher();
    // The click that follows a drag shouldn't toggle the button underneath.
    suppressClick = true;
    setTimeout(() => (suppressClick = false), 0);
  }

  function resetPos() {
    pos = { ...DEFAULT_POS };
    savePos(null);
    placeLauncher();
  }

  // ---------- screenshot ----------
  async function capture(markX: number, markY: number): Promise<string | null> {
    try {
      const w = innerWidth;
      const hgt = innerHeight;
      const shot = await Promise.race([
        toJpeg(document.documentElement, {
          quality: 0.7,
          pixelRatio: 1,
          width: w,
          height: hgt,
          cacheBust: true,
          filter: (n) => n !== host,
          style: { transform: `translate(${-scrollX}px, ${-scrollY}px)` },
        }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("screenshot timeout")), 8000)),
      ]);
      // Draw a marker where the user clicked.
      const img = new Image();
      img.src = shot;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      ctx.beginPath();
      ctx.arc(markX, markY, 14, 0, Math.PI * 2);
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#ef4444";
      ctx.stroke();
      return canvas.toDataURL("image/jpeg", 0.7);
    } catch (e) {
      console.warn("[feedback] screenshot failed", e);
      return null;
    }
  }

  // ---------- picking ----------
  const ownEvent = (e: Event) => e.composedPath().includes(host);

  function targetAt(x: number, y: number): Element | null {
    host.style.display = "none";
    const el = document.elementFromPoint(x, y);
    host.style.display = "";
    return el;
  }

  function onMove(e: MouseEvent) {
    if (!picking || draft) return;
    const el = targetAt(e.clientX, e.clientY);
    if (!el || el === document.documentElement || el === document.body) {
      highlight.style.display = "none";
      return;
    }
    const r = el.getBoundingClientRect();
    Object.assign(highlight.style, {
      display: "block",
      left: `${r.left}px`,
      top: `${r.top}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
    });
  }

  function onClick(e: MouseEvent) {
    if (!picking || ownEvent(e)) return;
    e.preventDefault();
    e.stopPropagation();
    if (draft) {
      draft = null;
      render();
      return;
    }
    const el = targetAt(e.clientX, e.clientY) ?? document.body;
    const r = el.getBoundingClientRect();
    draft = {
      selector: selectorFor(el),
      offsetX: r.width ? (e.clientX - r.left) / r.width : 0,
      offsetY: r.height ? (e.clientY - r.top) / r.height : 0,
      pageX: e.clientX + scrollX,
      pageY: e.clientY + scrollY,
      elementText: (el.textContent ?? "").trim().slice(0, 200),
      screenshot: capture(e.clientX, e.clientY),
    };
    activeId = null;
    highlight.style.display = "none";
    render();
  }

  // Swallow mousedown/up so links and buttons don't react while picking.
  function swallow(e: Event) {
    if (picking && !ownEvent(e)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function onKey(e: KeyboardEvent) {
    if (e.key !== "Escape") return;
    if (draft) draft = null;
    else if (activeId) activeId = null;
    else if (picking) picking = false;
    else return;
    render();
  }

  // ---------- views ----------
  function composer(d: Draft) {
    const text = h("textarea", { placeholder: "Leave a comment…" });
    const shotBox = h("input", { type: "checkbox", checked: true });
    const err = h("div", { className: "err" });
    const submit = h("button", { className: "btn small" }, "Post");

    const send = async () => {
      const body = text.value.trim();
      if (!body) return void (err.textContent = "Comment can't be empty");
      submit.disabled = true;
      submit.textContent = "Posting…";
      try {
        const screenshot = shotBox.checked ? await d.screenshot : null;
        const { comment } = await api<{ comment: Comment }>("/api/widget/comments", {
          method: "POST",
          body: JSON.stringify({
            key: KEY,
            url: location.href,
            selector: d.selector,
            offsetX: d.offsetX,
            offsetY: d.offsetY,
            pageX: d.pageX,
            pageY: d.pageY,
            body,
            screenshot,
            meta: {
              viewport: { w: innerWidth, h: innerHeight },
              scroll: { x: scrollX, y: scrollY },
              devicePixelRatio,
              elementText: d.elementText,
            },
          }),
        });
        comments = [comment, ...comments];
        draft = null;
        activeId = comment.id;
        render();
      } catch (e2) {
        err.textContent = (e2 as Error).message;
        submit.disabled = false;
        submit.textContent = "Post";
      }
    };
    submit.addEventListener("click", send);
    text.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
    });

    const card = h(
      "div",
      { className: "card" },
      h("h4", {}, "New comment", h("button", { className: "close", title: "Cancel", onclick: () => ((draft = null), render()) }, "×")),
      text,
      err,
      h("div", { className: "row" }, h("label", { className: "check" }, shotBox, "Attach screenshot"), submit),
    );
    setTimeout(() => text.focus(), 0);
    return card;
  }

  function thread(c: Comment) {
    const text = h("textarea", { placeholder: "Reply…" });
    text.style.minHeight = "52px";
    const err = h("div", { className: "err" });
    const replyBtn = h("button", { className: "btn small" }, "Reply");
    const toggle = h(
      "button",
      { className: "btn small ghost" },
      c.status === "open" ? "✓ Resolve" : "Reopen",
    );

    replyBtn.addEventListener("click", async () => {
      const body = text.value.trim();
      if (!body) return;
      replyBtn.disabled = true;
      try {
        const { reply } = await api<{ reply: Reply }>(`/api/widget/comments/${c.id}/replies`, {
          method: "POST",
          body: JSON.stringify({ key: KEY, body }),
        });
        c.replies.push(reply);
        render();
      } catch (e) {
        err.textContent = (e as Error).message;
        replyBtn.disabled = false;
      }
    });

    toggle.addEventListener("click", async () => {
      toggle.disabled = true;
      const status = c.status === "open" ? "resolved" : "open";
      try {
        await api(`/api/widget/comments/${c.id}`, {
          method: "PATCH",
          body: JSON.stringify({ key: KEY, status }),
        });
        c.status = status;
        if (status === "resolved" && !showResolved) activeId = null;
        render();
      } catch (e) {
        err.textContent = (e as Error).message;
        toggle.disabled = false;
      }
    });

    const msg = (m: { authorName: string; createdAt: string; body: string }) =>
      h(
        "div",
        { className: "msg" },
        h("div", { className: "who" }, m.authorName, h("span", { className: "when" }, ago(m.createdAt))),
        h("div", { className: "text" }, m.body),
      );

    return h(
      "div",
      { className: "card" },
      h(
        "h4",
        {},
        h("span", { className: `status ${c.status}` }, c.status),
        h("button", { className: "close", title: "Close", onclick: () => ((activeId = null), render()) }, "×"),
      ),
      msg(c),
      ...c.replies.map(msg),
      h("div", { className: "field" }, text),
      err,
      h("div", { className: "row" }, toggle, replyBtn),
    );
  }

  // ---------- render ----------
  let pinEls: { el: HTMLElement; c: Pick<Comment, "selector" | "offsetX" | "offsetY" | "pageX" | "pageY"> }[] = [];
  let cardEl: { el: HTMLElement; c: Pick<Comment, "selector" | "offsetX" | "offsetY" | "pageX" | "pageY"> } | null = null;

  function render() {
    root.replaceChildren();
    pinEls = [];
    cardEl = null;

    const visible = comments.filter((c) => showResolved || c.status === "open");
    const openCount = comments.filter((c) => c.status === "open").length;

    if (open) {
      // Oldest first gets #1.
      const ordered = [...comments].reverse();
      for (const c of visible) {
        const n = ordered.indexOf(c) + 1;
        const el = h(
          "div",
          {
            className: `pin ${c.status === "resolved" ? "resolved" : ""} ${activeId === c.id ? "active" : ""}`,
            title: `${c.authorName}: ${c.body.slice(0, 80)}`,
            onclick: (e: Event) => {
              e.stopPropagation();
              draft = null;
              activeId = activeId === c.id ? null : c.id;
              render();
            },
          },
          String(n),
        );
        pinEls.push({ el, c });
        root.append(el);
      }
      if (draft) {
        const el = h("div", { className: "pin draft" }, "+");
        pinEls.push({ el, c: draft });
        root.append(el);
        const card = composer(draft);
        cardEl = { el: card, c: draft };
        root.append(card);
      } else if (activeId) {
        const c = comments.find((x) => x.id === activeId);
        if (c) {
          const card = thread(c);
          cardEl = { el: card, c };
          root.append(card);
        }
      }
      root.append(highlight);
      if (picking && !draft) root.append(h("div", { className: "hint" }, "Click anywhere to comment · Esc to stop"));
    }

    const launcher = h("div", { className: "launcher" });
    launcher.addEventListener("pointerdown", onDragStart);
    launcher.addEventListener(
      "click",
      (e) => {
        if (!suppressClick) return;
        e.preventDefault();
        e.stopPropagation();
      },
      true,
    );
    launcherEl = launcher;
    if (open && me) {
      launcher.append(
        h(
          "button",
          {
            className: "btn ghost",
            title: `Signed in as ${me.name} (${me.email}). Click to sign out.`,
            onclick: signOut,
          },
          h("span", { className: "avatar" }, (me.name.trim()[0] ?? "?").toUpperCase()),
          "Sign out",
        ),
        h(
          "button",
          {
            className: `btn ghost ${showResolved ? "on" : ""}`,
            title: "Show resolved comments",
            onclick: () => ((showResolved = !showResolved), render()),
          },
          showResolved ? "Hide resolved" : "Show resolved",
        ),
        h(
          "button",
          {
            className: `btn ghost ${picking ? "on" : ""}`,
            onclick: () => {
              picking = !picking;
              draft = null;
              highlight.style.display = "none";
              render();
            },
          },
          picking ? "Stop commenting" : "+ Comment",
        ),
      );
    }
    launcher.append(
      h(
        "button",
        {
          className: "btn",
          title: me ? undefined : "Sign in with Google to leave feedback",
          onclick: () => {
            notice = "";
            if (signingIn) {
              stopSignIn();
              return render();
            }
            if (!me) return signIn();
            open = !open;
            picking = open;
            draft = null;
            activeId = null;
            highlight.style.display = "none";
            if (open) load();
            render();
          },
        },
        signingIn ? "Signing in… (cancel)" : open ? "Close" : "Feedback",
        !open && openCount > 0 && h("span", { className: "badge" }, String(openCount)),
      ),
      h(
        "div",
        {
          className: "grip",
          title: "Drag to move · double-click to reset",
          "aria-hidden": "true",
          ondblclick: resetPos,
        },
        h("span", {}),
        h("span", {}),
        h("span", {}),
        h("span", {}),
        h("span", {}),
        h("span", {}),
      ),
    );
    if (notice) launcher.append(h("div", { className: "notice", role: "status" }, notice));
    root.append(launcher);
    document.documentElement.style.cursor = picking && !draft ? "crosshair" : "";
    reposition();
  }

  function reposition() {
    placeLauncher();
    for (const { el, c } of pinEls) {
      const p = pinPoint(c);
      el.style.left = `${p.x}px`;
      el.style.top = `${p.y}px`;
      el.style.display = p.y < -30 || p.y > innerHeight + 30 ? "none" : "";
    }
    if (cardEl) {
      const p = pinPoint(cardEl.c);
      placeCard(cardEl.el, p.x, p.y);
    }
  }

  let raf = 0;
  const schedule = () => {
    if (!raf)
      raf = requestAnimationFrame(() => {
        raf = 0;
        reposition();
      });
  };

  // ---------- wiring ----------
  document.addEventListener("mousemove", onMove, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("mousedown", swallow, true);
  document.addEventListener("mouseup", swallow, true);
  document.addEventListener("keydown", onKey, true);
  addEventListener("pointermove", onDragMove, { passive: false });
  addEventListener("pointerup", onDragEnd);
  addEventListener("pointercancel", onDragEnd);
  addEventListener("scroll", schedule, { passive: true, capture: true });
  addEventListener("resize", schedule);

  // SPA navigation + periodic refresh while open.
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      draft = null;
      activeId = null;
      comments = [];
      load();
    }
    schedule();
  }, 1000);
  // Skip while a card is open so we never wipe a half-typed reply.
  setInterval(() => open && !draft && !activeId && load(), 20000);

  load();
})();
