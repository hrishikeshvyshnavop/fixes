import { toJpeg } from "html-to-image";
import { selectorFor } from "./selector";
import { CSS } from "./styles";
import { ICON, type IconName } from "./icons";

/*
 * Embed:
 *   <script src="https://YOUR_HOST/widget.js" data-key="pk_xxx" async></script>
 * Optional: data-api="https://api.host" (defaults to the script's origin)
 */

type Reaction = { emoji: string; count: number; mine: boolean; names: string[] };
type Reply = {
  id: string;
  commentId: string;
  body: string;
  authorName: string;
  authorId: string | null;
  authorAvatarUrl?: string | null;
  editedAt: string | null;
  createdAt: string;
  reactions: Reaction[];
};
type Thread = {
  id: string;
  number: number;
  pageUrl: string;
  fullUrl: string;
  selector: string;
  offsetX: number;
  offsetY: number;
  pageX: number;
  pageY: number;
  body: string;
  authorName: string;
  authorId: string | null;
  authorAvatarUrl?: string | null;
  editedAt: string | null;
  status: "open" | "resolved";
  meta: { quote?: string; element?: string; elementText?: string };
  createdAt: string;
  hasScreenshot: boolean;
  reactions: Reaction[];
  replies: Reply[];
};
type Me = { id: string; name: string; email: string; role: "owner" | "member"; avatarUrl?: string | null };
type Member = { id: string; name: string; email: string; avatarUrl?: string | null };
type Anchor = { selector: string; offsetX: number; offsetY: number; pageX: number; pageY: number };
type Details = { label: string; size: string; text: string };
type Draft = Anchor & {
  details: Details;
  quote?: string;
  screenshot?: Promise<string | null>; // started on send (or when details open), never while typing
  shotAt: { x: number; y: number; w: number; h: number; sx: number; sy: number }; // area + scroll at click time
  shot?: string | null; // resolved screenshot, for the preview
  noShot?: boolean; // user turned the screenshot off
  showDetails?: boolean; // element details expanded in the composer
};
type Pos = { h: "left" | "right"; x: number; v: "top" | "bottom"; y: number };

const REACTIONS = ["👍", "❤️", "😄", "🎉", "👀", "🚀", "✅", "🔥"];
const THREAD_PARAM = "fixes_thread";

(function init() {
  const w = window as unknown as { __fbWidget?: boolean };
  if (w.__fbWidget) return;
  w.__fbWidget = true;

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
  const EDGE = 8;

  // ---------- storage ----------
  const store = {
    get(k: string) {
      try {
        return localStorage.getItem(k);
      } catch {
        return null;
      }
    },
    set(k: string, v: string | null) {
      try {
        if (v === null) localStorage.removeItem(k);
        else localStorage.setItem(k, v);
      } catch {
        /* storage blocked */
      }
    },
  };
  const loadPos = (): Pos | null => {
    try {
      const p = JSON.parse(store.get(POS_KEY) ?? "null");
      if (p && (p.h === "left" || p.h === "right") && (p.v === "top" || p.v === "bottom") && Number.isFinite(p.x) && Number.isFinite(p.y))
        return p;
    } catch {
      /* bad JSON */
    }
    return null; // null = centred at the bottom
  };

  // ---------- state ----------
  let me: Me | null = null;
  let project: { name: string; prefix: string } | null = null;
  let all: Thread[] = []; // every thread in the project (inbox); this page's are filtered from it
  let members: Member[] = [];
  let commenting = false;
  let showPins = true;
  let showResolvedPins = false;
  let inbox = false;
  let inboxScope: "page" | "all" = "page";
  let inboxFilter: "open" | "resolved" | "all" = "open";
  let activeId: string | null = null;
  let draft: Draft | null = null;
  let editing: string | null = null; // comment/reply id being edited
  let reactFor: string | null = null; // id whose emoji palette is open
  let accountMenu = false; // the docked pill's menu panel
  let menuQuery = "";
  let menuIndex = 0;
  let inspecting = false; // CSS inspector mode
  let inspected: Element | null = null; // element pinned in the inspector
  let peekHidden = ""; // latest activity time the unread preview was dismissed at
  let signingIn = false;
  let toast = "";
  let toastTimer = 0;
  let selBubble: { rect: DOMRect; range: Range } | null = null;
  let mention: { key: string; start: number; query: string; index: number } | null = null;
  const texts: Record<string, string> = {}; // unsent text per box, survives re-renders
  const errors: Record<string, string> = {};
  let busy: Record<string, boolean> = {};
  let pos = loadPos();
  peekHidden = store.get(`fb_peek:${KEY}`) ?? "";
  let lastUrl = location.href;

  // ---------- DOM ----------
  const host = document.createElement("div");
  for (const type of ["keydown", "keyup", "keypress"])
    host.addEventListener(type, (e) => {
      const t = e.composedPath()[0];
      if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) e.stopPropagation();
    });
  host.setAttribute("data-feedback-widget", "");
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = CSS;
  const root = document.createElement("div");
  root.className = "root";
  shadow.append(style, root);
  (document.body ?? document.documentElement).appendChild(host);

  // Geist, like the dashboard. Font faces must be declared on the page, not in the shadow root.
  if (!document.querySelector("link[data-fixes-font]")) {
    const font = document.createElement("link");
    font.rel = "stylesheet";
    font.href = "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap";
    font.setAttribute("data-fixes-font", "");
    font.crossOrigin = "anonymous"; // lets the screenshot library read it
    document.head?.appendChild(font);
  }

  type Child = Node | string | null | false | undefined;
  const h = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...children: Child[]): HTMLElementTagNameMap[K] => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v as EventListener);
      else if (k === "className") el.className = String(v);
      else if (v !== undefined && v !== false && v !== null) el.setAttribute(k, v === true ? "" : String(v));
    }
    for (const c of children) if (c) el.append(c);
    return el;
  };
  const icon = (name: IconName) => {
    const s = document.createElement("span");
    s.style.display = "contents";
    s.innerHTML = ICON[name]; // static, trusted markup
    return s;
  };
  const iconBtn = (name: IconName, title: string, onclick: (e: Event) => void, cls = "") =>
    h("button", { className: `icon-btn ${cls}`, title, "aria-label": title, onclick }, icon(name));

  const highlight = h("div", { className: "highlight" });
  const inspectHL = h("div", { className: "highlight pinned" });
  const hlLabel = h("div", { className: "hl-label mono" });
  highlight.style.display = hlLabel.style.display = "none";

  // ---------- helpers ----------
  const ago = (iso: string) => {
    const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    if (s < 86400 * 30) return `${Math.floor(s / 86400)}d`;
    return new Date(iso).toLocaleDateString();
  };
  const hue = (s: string) => {
    let n = 0;
    for (const ch of s) n = (n * 31 + ch.charCodeAt(0)) % 360;
    return n;
  };
  const initials = (name: string) =>
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?";
  // Profile photo when there is one (uploaded photos are served by the Fixes host), else initials.
  const photoUrl = (url?: string | null) => (!url ? null : url.startsWith("/") ? API + url : /^https:\/\//.test(url) ? url : null);
  const avatar = (name: string, size = 24, url?: string | null) => {
    const a = h("span", { className: "avatar", title: name }, initials(name));
    a.style.background = `hsl(${hue(name)} 45% 45%)`;
    if (size !== 24) Object.assign(a.style, { width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.4)}px` });
    const src = photoUrl(url);
    if (src) {
      const img = h("img", { src, alt: "", referrerpolicy: "no-referrer" });
      img.addEventListener("error", () => img.remove());
      a.append(img);
    }
    return a;
  };
  const normalisePage = (url: string) => {
    try {
      const u = new URL(url);
      return u.origin + (u.pathname.replace(/\/$/, "") || "/");
    } catch {
      return url;
    }
  };
  const pathOf = (url: string) => {
    try {
      const u = new URL(url);
      return u.pathname || "/";
    } catch {
      return url;
    }
  };
  const threadLink = (t: Thread) => {
    const u = new URL(t.fullUrl);
    u.searchParams.set(THREAD_PARAM, t.id);
    return u.toString();
  };
  const label = (t: Thread) => (project ? `${project.prefix}-${t.number}` : `#${t.number}`);
  const pageThreads = () => all.filter((t) => t.pageUrl === normalisePage(location.href));
  const findThread = (id: string | null) => (id ? all.find((t) => t.id === id) ?? null : null);
  const canDelete = (authorId: string | null) => !!me && (authorId === me.id || me.role === "owner");

  function flash(msg: string) {
    toast = msg;
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast = "";
      render();
    }, 2600);
    render();
  }

  // ---------- unread (per browser, per user) ----------
  const seenKey = () => `fb_seen:${KEY}:${me?.id ?? ""}`;
  let seen: Record<string, string> = {};
  const loadSeen = () => {
    try {
      seen = JSON.parse(store.get(seenKey()) ?? "{}") ?? {};
    } catch {
      seen = {};
    }
  };
  const lastActivity = (t: Thread) => {
    const last = t.replies[t.replies.length - 1];
    return last ? { at: last.createdAt, by: last.authorId } : { at: t.createdAt, by: t.authorId };
  };
  const isUnread = (t: Thread) => {
    if (!me) return false;
    if (seen[t.id] === "!") return true; // marked unread by hand
    const a = lastActivity(t);
    return a.by !== me.id && (seen[t.id] ?? "") < a.at;
  };
  const markUnread = (t: Thread) => {
    seen[t.id] = "!";
    store.set(seenKey(), JSON.stringify(seen));
  };
  const markSeen = (...ts: Thread[]) => {
    for (const t of ts) seen[t.id] = lastActivity(t).at;
    store.set(seenKey(), JSON.stringify(seen));
  };

  // ---------- API ----------
  async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const token = store.get(TOKEN_KEY);
    const res = await fetch(API + path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && token) signedOut("Your session ended. Sign in again to comment.");
    if (!res.ok) throw Object.assign(new Error(data.error ?? `Request failed (${res.status})`), { status: res.status });
    return data as T;
  }

  let loading = false;
  async function load() {
    if (loading) return;
    loading = true;
    try {
      const q = new URLSearchParams({ key: KEY!, url: location.href, scope: "all" });
      const data = await api<{ comments: Thread[]; user: Me | null; project?: { name: string; prefix: string } }>(`/api/widget/comments?${q}`);
      if (!data.user && store.get(TOKEN_KEY)) return signedOut("Your session ended. Sign in again to comment.");
      const wasSignedOut = !me;
      me = data.user;
      project = data.project ?? null;
      all = data.comments;
      if (me && wasSignedOut) {
        loadSeen();
        loadMembers();
      }
      openFromUrl();
      render();
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 403 || status === 404) setupProblem(status);
      else console.warn("[feedback]", e);
    } finally {
      loading = false;
    }
  }

  async function loadMembers() {
    try {
      members = (await api<{ members: Member[] }>(`/api/widget/members?key=${encodeURIComponent(KEY!)}`)).members;
    } catch {
      members = [];
    }
  }

  // Opened from a "copy link" URL: jump to that thread once.
  function openFromUrl() {
    const u = new URL(location.href);
    const id = u.searchParams.get(THREAD_PARAM);
    if (!id || !me) return;
    u.searchParams.delete(THREAD_PARAM);
    history.replaceState(history.state, "", u.toString());
    lastUrl = location.href;
    const t = findThread(id);
    if (t) focusThread(t);
    else flash("That comment was deleted or is on another page.");
  }

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
    store.set(TOKEN_KEY, null);
    me = null;
    all = [];
    members = [];
    commenting = inbox = accountMenu = false;
    draft = null;
    activeId = editing = reactFor = null;
    if (message) flash(message);
    else render();
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
    const pw = 480;
    const ph = 640;
    const popup = window.open(
      `${API}/widget/auth?${q}`,
      "fixes-sign-in",
      `width=${pw},height=${ph},left=${Math.round(screenX + (outerWidth - pw) / 2)},top=${Math.round(screenY + (outerHeight - ph) / 2)}`,
    );
    if (!popup) return flash("Allow pop-ups for this site to sign in.");
    stopSignIn();
    signingIn = true;
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
          store.set(TOKEN_KEY, res.token);
          me = null; // let load() treat it as a fresh sign-in
          commenting = true;
          await load();
          return flash(`Signed in as ${res.user.name}`);
        }
      } catch (e) {
        console.warn("[feedback] sign-in check failed", e);
      }
      if (Date.now() > deadline) {
        stopSignIn();
        return flash("Sign-in timed out. Try again.");
      }
      pollTimer = window.setTimeout(poll, 1500);
    };
    pollTimer = window.setTimeout(poll, 1500);
  }

  async function signOut() {
    accountMenu = false;
    try {
      await api("/api/widget/session", { method: "DELETE" });
    } catch {
      /* token already gone */
    }
    signedOut("Signed out");
  }

  // ---------- positioning ----------
  function pinPoint(c: Anchor) {
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
    const W = Math.min(340, innerWidth - 16);
    const H = card.offsetHeight || 300;
    // Keep clear of the inbox panel when it's open.
    const panel = inbox ? root.querySelector(".inbox")?.getBoundingClientRect() : null;
    const right = panel && panel.left > W + 24 ? panel.left - 8 : innerWidth - 8;
    let left = x + 24 + W > right ? Math.max(8, x - W - 16) : x + 24;
    if (left + W > right) left = Math.max(8, right - W);
    let top = Math.max(8, Math.min(y - 24, innerHeight - H - 8));
    // ...and of the toolbar.
    const tb = toolbarEl?.getBoundingClientRect();
    if (tb && left < tb.right && left + W > tb.left && top < tb.bottom && top + H > tb.top)
      top = tb.top > innerHeight / 2 ? Math.max(8, tb.top - H - 8) : Math.min(innerHeight - H - 8, tb.bottom + 8);
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
  }

  // ---------- move a pin to another element ----------
  let pinDrag: { t: Thread; el: HTMLElement; sx: number; sy: number; moved: boolean } | null = null;
  let pinDragged = false; // swallow the click that ends a drag
  const canMove = (t: Thread) => !!me && (t.authorId === me.id || me.role === "owner");

  function onPinDown(e: PointerEvent, t: Thread, el: HTMLElement) {
    if (e.button !== 0 || !canMove(t)) return;
    pinDrag = { t, el, sx: e.clientX, sy: e.clientY, moved: false };
  }
  function onPinMove(e: PointerEvent) {
    const d = pinDrag;
    if (!d) return;
    if (!d.moved) {
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 5) return;
      d.moved = true;
      d.el.classList.add("dragging");
      document.documentElement.style.cursor = "grabbing";
    }
    e.preventDefault();
    d.el.style.left = `${e.clientX}px`;
    d.el.style.top = `${e.clientY}px`;
    const target = targetAt(e.clientX, e.clientY);
    if (target && target !== document.documentElement && target !== document.body) {
      const r = target.getBoundingClientRect();
      Object.assign(highlight.style, { display: "block", left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
      hlLabel.replaceChildren(h("span", {}, `Move to ${describe(target).label}`));
      hlLabel.style.display = "flex";
      hlLabel.style.left = `${Math.max(4, r.left)}px`;
      hlLabel.style.top = `${r.top > 26 ? r.top - 24 : Math.min(innerHeight - 22, r.bottom + 4)}px`;
      if (!highlight.isConnected) root.append(highlight, hlLabel);
    }
  }
  function onPinUp(e: PointerEvent) {
    const d = pinDrag;
    pinDrag = null;
    if (!d?.moved) return;
    pinDragged = true;
    setTimeout(() => (pinDragged = false), 0);
    highlight.style.display = hlLabel.style.display = "none";
    document.documentElement.style.cursor = "";
    const target = targetAt(e.clientX, e.clientY) ?? document.body;
    const r = target.getBoundingClientRect();
    const move = {
      selector: selectorFor(target),
      offsetX: r.width ? Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) : 0,
      offsetY: r.height ? Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) : 0,
      pageX: e.clientX + scrollX,
      pageY: e.clientY + scrollY,
    };
    Object.assign(d.t, move); // move it right away; the server confirms in the background
    render();
    api(`/api/widget/comments/${d.t.id}`, { method: "PATCH", body: JSON.stringify({ key: KEY, move }) })
      .then(() => flash(`Moved ${label(d.t)}`))
      .catch((err) => {
        flash((err as Error).message);
        load();
      });
  }

  // ---------- movable toolbar ----------
  let toolbarEl: HTMLElement | null = null;
  let drag: { sx: number; sy: number; left: number; top: number; w: number; h: number; moved: boolean } | null = null;
  let suppressClick = false;
  const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), Math.max(min, max));

  function placeToolbar() {
    const el = toolbarEl;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.left = el.style.right = el.style.top = el.style.bottom = "";
    if (!pos) {
      // Default: docked on the right edge, vertically centred.
      el.style.right = "16px";
      el.style.top = `${Math.round((innerHeight - r.height) / 2)}px`;
    } else {
      el.style[pos.h] = `${clamp(pos.x, EDGE, innerWidth - r.width - EDGE)}px`;
      el.style[pos.v] = `${clamp(pos.y, EDGE, innerHeight - r.height - EDGE)}px`;
    }
    // Panels open towards the middle of the screen, and stay inside the viewport vertically.
    const b = el.getBoundingClientRect();
    el.classList.toggle("left", b.left + b.width / 2 < innerWidth / 2);
    const cmd = el.querySelector<HTMLElement>(".cmd, .peek");
    if (cmd) {
      const ph = cmd.offsetHeight;
      const top = clamp(b.top + b.height / 2 - ph / 2, 12, innerHeight - ph - 12);
      cmd.style.top = `${Math.round(top - b.top)}px`;
    }
  }

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
    if (e.button !== 0 || !toolbarEl) return;
    if ((e.composedPath()[0] as Element)?.closest?.(".menu, .cmd")) return;
    const r = toolbarEl.getBoundingClientRect();
    drag = { sx: e.clientX, sy: e.clientY, left: r.left, top: r.top, w: r.width, h: r.height, moved: false };
  }
  function onDragMove(e: PointerEvent) {
    if (!drag || !toolbarEl) return;
    const dx = e.clientX - drag.sx;
    const dy = e.clientY - drag.sy;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < 5) return;
      drag.moved = true;
      toolbarEl.classList.add("dragging");
    }
    e.preventDefault();
    pos = toPos(
      clamp(drag.left + dx, EDGE, innerWidth - drag.w - EDGE),
      clamp(drag.top + dy, EDGE, innerHeight - drag.h - EDGE),
      drag.w,
      drag.h,
    );
    placeToolbar();
  }
  function onDragEnd() {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    if (!moved) return;
    toolbarEl?.classList.remove("dragging");
    store.set(POS_KEY, JSON.stringify(pos));
    suppressClick = true;
    setTimeout(() => (suppressClick = false), 0);
  }
  function resetPos() {
    pos = null;
    store.set(POS_KEY, null);
    placeToolbar();
  }

  // ---------- screenshot: page dimmed, picked element spotlighted ----------
  async function capture(rect: { x: number; y: number; w: number; h: number }): Promise<string | null> {
    try {
      const shot = await Promise.race([
        toJpeg(document.documentElement, {
          quality: 0.75,
          pixelRatio: 1,
          width: innerWidth,
          height: innerHeight,
          cacheBust: true,
          filter: (n) => n !== host,
          style: { transform: `translate(${-scrollX}px, ${-scrollY}px)` },
        }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("screenshot timeout")), 8000)),
      ]);
      const img = new Image();
      img.src = shot;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const pad = 4;
      const x = Math.max(0, rect.x - pad);
      const y = Math.max(0, rect.y - pad);
      const rw = Math.min(canvas.width - x, rect.w + pad * 2);
      const rh = Math.min(canvas.height - y, rect.h + pad * 2);
      // Black overlay everywhere except the element.
      ctx.beginPath();
      ctx.rect(0, 0, canvas.width, canvas.height);
      ctx.rect(x, y, rw, rh);
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fill("evenodd");
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#ffffff";
      ctx.strokeRect(x, y, rw, rh);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "#2563eb";
      ctx.strokeRect(x - 2, y - 2, rw + 4, rh + 4);
      return canvas.toDataURL("image/jpeg", 0.75);
    } catch (e) {
      console.warn("[feedback] screenshot failed", e);
      return null;
    }
  }

  // ---------- picking ----------
  const ownEvent = (e: Event) => e.composedPath().includes(host);
  const editable = (el: EventTarget | null) =>
    el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

  function targetAt(x: number, y: number): Element | null {
    host.style.display = "none";
    const el = document.elementFromPoint(x, y);
    host.style.display = "";
    return el;
  }

  const looksGenerated = (s: string) => /\d{3,}|[a-f0-9]{8,}|^css-|^sc-|^_|__/.test(s);
  function describe(el: Element): Details {
    const tag = el.tagName.toLowerCase();
    const id = el.id && !looksGenerated(el.id) ? `#${el.id}` : "";
    const cls = Array.from(el.classList)
      .filter((c) => !looksGenerated(c) && !c.includes(":"))
      .slice(0, 2)
      .map((c) => `.${c}`)
      .join("");
    const r = el.getBoundingClientRect();
    return {
      label: `${tag}${id}${cls}`,
      size: `${Math.round(r.width)} × ${Math.round(r.height)}`,
      text: (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 140),
    };
  }

  function onMove(e: MouseEvent) {
    if ((!commenting && !inspecting) || draft) return;
    const el = targetAt(e.clientX, e.clientY);
    if (!el || el === document.documentElement || el === document.body) {
      highlight.style.display = hlLabel.style.display = "none";
      return;
    }
    const r = el.getBoundingClientRect();
    Object.assign(highlight.style, { display: "block", left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    const d = describe(el);
    hlLabel.replaceChildren(h("span", {}, d.label), h("span", { className: "dim" }, d.size));
    hlLabel.style.display = "flex";
    hlLabel.style.left = `${Math.max(4, r.left)}px`;
    hlLabel.style.top = `${r.top > 26 ? r.top - 24 : Math.min(innerHeight - 22, r.bottom + 4)}px`;
  }

  function startDraft(el: Element, x: number, y: number, rect: DOMRect, quote?: string) {
    const r = el.getBoundingClientRect();
    const d: Draft = {
      selector: selectorFor(el),
      offsetX: r.width ? Math.min(1, Math.max(0, (x - r.left) / r.width)) : 0,
      offsetY: r.height ? Math.min(1, Math.max(0, (y - r.top) / r.height)) : 0,
      pageX: x + scrollX,
      pageY: y + scrollY,
      details: describe(el),
      quote,
      shotAt: { x: rect.left, y: rect.top, w: rect.width, h: rect.height, sx: scrollX, sy: scrollY },
    };
    draft = d;
    activeId = null;
    editing = reactFor = null;
    texts.new = "";
    errors.new = "";
    highlight.style.display = hlLabel.style.display = "none";
    render();
  }

  /**
   * Screenshots copy the whole page and block the main thread for a moment, so they're taken when
   * the comment is sent (or the details preview is opened), never while someone is typing.
   */
  function ensureShot(d: Draft): Promise<string | null> {
    if (!d.screenshot) {
      const a = d.shotAt;
      d.screenshot = capture({ x: a.x + (a.sx - scrollX), y: a.y + (a.sy - scrollY), w: a.w, h: a.h });
      d.screenshot.then((shot) => {
        d.shot = shot;
        if (draft === d && d.showDetails) render();
      });
    }
    return d.screenshot;
  }

  function onClick(e: MouseEvent) {
    if (ownEvent(e)) return;
    if (accountMenu || reactFor) {
      accountMenu = false;
      reactFor = null;
      render();
    }
    if (inspecting) {
      e.preventDefault();
      e.stopPropagation();
      const el = targetAt(e.clientX, e.clientY);
      inspected = el && el !== document.documentElement ? el : null;
      return render();
    }
    if (!commenting) return;
    e.preventDefault();
    e.stopPropagation();
    if (draft) {
      draft = null;
      return render();
    }
    const el = targetAt(e.clientX, e.clientY) ?? document.body;
    startDraft(el, e.clientX, e.clientY, el.getBoundingClientRect());
  }

  // Swallow mousedown/up so links and buttons don't react while picking.
  function swallow(e: Event) {
    if ((commenting || inspecting) && !ownEvent(e)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  // Select text on the page → a "Comment" bubble appears above it.
  function onMouseUp(e: MouseEvent) {
    if (ownEvent(e) || !me || commenting || inspecting || draft) return;
    setTimeout(() => {
      const sel = getSelection();
      const text = sel?.toString().trim() ?? "";
      if (!sel || sel.isCollapsed || !text || !sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (!rect.width && !rect.height) return;
      selBubble = { rect, range: range.cloneRange() };
      render();
    }, 0);
  }
  function onSelectionChange() {
    if (selBubble && (getSelection()?.isCollapsed ?? true)) {
      selBubble = null;
      render();
    }
  }
  function commentOnSelection() {
    if (!selBubble) return;
    const { range, rect } = selBubble;
    const node = range.commonAncestorContainer;
    const el = (node.nodeType === 1 ? (node as Element) : node.parentElement) ?? document.body;
    const quote = range.toString().trim().slice(0, 500);
    selBubble = null;
    getSelection()?.removeAllRanges();
    if (!showPins) showPins = true;
    startDraft(el, rect.left, rect.top, rect, quote);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") {
      if (mention) mention = null;
      else if (reactFor) reactFor = null;
      else if (accountMenu) accountMenu = false;
      else if (inspected) inspected = null;
      else if (inspecting) inspecting = false;
      else if (editing) editing = null;
      else if (draft) draft = null;
      else if (activeId) activeId = null;
      else if (commenting) commenting = false;
      else if (inbox) inbox = false;
      else return;
      highlight.style.display = hlLabel.style.display = "none";
      return render();
    }
    // Shortcuts work everywhere except while typing. (Check the real target: events from
    // inside the widget's shadow root are retargeted to its host element.)
    if (editable(e.composedPath()[0] ?? e.target) || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === "c") {
      e.preventDefault();
      toggleCommenting();
    } else if (k === "i" && me) {
      e.preventDefault();
      inbox = !inbox;
      render();
    } else if (k === "x") {
      e.preventDefault();
      toggleInspect();
    } else if (k === "h" && me) {
      e.preventDefault();
      togglePins();
    }
  }

  function toggleInspect() {
    inspecting = !inspecting;
    inspected = null;
    commenting = false;
    draft = null;
    accountMenu = false;
    highlight.style.display = hlLabel.style.display = "none";
    render();
  }

  function togglePins() {
    showPins = !showPins;
    if (!showPins) {
      activeId = null;
      draft = null;
      commenting = false;
    }
    render();
  }

  function toggleCommenting() {
    if (!me) return signIn();
    commenting = !commenting;
    inspecting = false;
    inspected = null;
    draft = null;
    showPins = true;
    highlight.style.display = hlLabel.style.display = "none";
    render();
  }

  function focusThread(t: Thread) {
    if (t.pageUrl !== normalisePage(location.href)) {
      location.href = threadLink(t);
      return;
    }
    showPins = true;
    if (t.status === "resolved") showResolvedPins = true;
    draft = null;
    commenting = false;
    activeId = t.id;
    markSeen(t);
    try {
      document.querySelector(t.selector)?.scrollIntoView({ block: "center", behavior: "smooth" });
    } catch {
      scrollTo({ top: t.pageY - innerHeight / 2, behavior: "smooth" });
    }
    render();
  }

  // ---------- actions ----------
  async function run(keyName: string, fn: () => Promise<void>) {
    if (busy[keyName]) return;
    busy = { ...busy, [keyName]: true };
    errors[keyName] = "";
    render();
    try {
      await fn();
    } catch (e) {
      errors[keyName] = (e as Error).message;
    } finally {
      busy = { ...busy, [keyName]: false };
      render();
    }
  }

  const postComment = (d: Draft) =>
    run("new", async () => {
      const body = (texts.new ?? "").trim();
      if (!body) return;
      const screenshot = d.noShot ? null : await ensureShot(d);
      const { comment } = await api<{ comment: Thread }>("/api/widget/comments", {
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
            elementText: d.details.text,
            element: d.details.label,
            quote: d.quote,
          },
        }),
      });
      all = [comment, ...all];
      markSeen(comment);
      texts.new = "";
      draft = null;
      commenting = false;
      activeId = comment.id;
    });

  const postReply = (t: Thread) =>
    run(`reply:${t.id}`, async () => {
      const k = `reply:${t.id}`;
      const body = (texts[k] ?? "").trim();
      if (!body) return;
      const { reply } = await api<{ reply: Reply }>(`/api/widget/comments/${t.id}/replies`, {
        method: "POST",
        body: JSON.stringify({ key: KEY, body }),
      });
      t.replies.push(reply);
      markSeen(t);
      texts[k] = "";
    });

  const toggleResolved = (t: Thread) =>
    run(`status:${t.id}`, async () => {
      const status = t.status === "open" ? "resolved" : "open";
      await api(`/api/widget/comments/${t.id}`, { method: "PATCH", body: JSON.stringify({ key: KEY, status }) });
      t.status = status;
      if (status === "resolved" && !showResolvedPins) activeId = null;
      flash(status === "resolved" ? `Resolved ${label(t)}` : `Reopened ${label(t)}`);
    });

  const saveEdit = (id: string, isReply: boolean) =>
    run(`edit:${id}`, async () => {
      const body = (texts[`edit:${id}`] ?? "").trim();
      if (!body) return;
      const res = await api<{ body: string; editedAt: string }>(isReply ? `/api/widget/replies/${id}` : `/api/widget/comments/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ key: KEY, body }),
      });
      for (const t of all) {
        const target = t.id === id ? t : t.replies.find((r) => r.id === id);
        if (target) Object.assign(target, { body: res.body, editedAt: res.editedAt });
      }
      editing = null;
    });

  const remove = (id: string, isReply: boolean) => {
    if (!confirm(isReply ? "Delete this reply?" : "Delete this comment and all its replies?")) return;
    run(`del:${id}`, async () => {
      await api(`${isReply ? `/api/widget/replies/${id}` : `/api/widget/comments/${id}`}?key=${encodeURIComponent(KEY!)}`, { method: "DELETE" });
      if (isReply) for (const t of all) t.replies = t.replies.filter((r) => r.id !== id);
      else {
        all = all.filter((t) => t.id !== id);
        if (activeId === id) activeId = null;
      }
      flash(isReply ? "Reply deleted" : "Comment deleted");
    });
  };

  const react = (target: Thread | Reply, emoji: string) => {
    reactFor = null;
    // Optimistic toggle.
    const list = target.reactions;
    const r = list.find((x) => x.emoji === emoji);
    if (r?.mine) {
      r.count--;
      r.mine = false;
      r.names = r.names.filter((n) => n !== me?.name);
      if (!r.count) list.splice(list.indexOf(r), 1);
    } else if (r) {
      r.count++;
      r.mine = true;
      r.names.push(me?.name ?? "You");
    } else list.push({ emoji, count: 1, mine: true, names: [me?.name ?? "You"] });
    render();
    api("/api/widget/reactions", { method: "POST", body: JSON.stringify({ key: KEY, targetId: target.id, emoji }) }).catch((e) => {
      flash((e as Error).message);
      load();
    });
  };

  async function copyLink(t: Thread) {
    try {
      await navigator.clipboard.writeText(threadLink(t));
      flash("Link copied");
    } catch {
      prompt("Copy this link:", threadLink(t));
    }
  }

  // ---------- rich text: **bold**, `code`, links, @mentions ----------
  function formatText(body: string): DocumentFragment {
    const frag = document.createDocumentFragment();
    const names = [...members.map((m) => m.name)].sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const mentionRe = names.length ? `@(?:${names.join("|")})` : "@[\\w.-]+";
    const re = new RegExp(`(\\*\\*[^*\\n]+\\*\\*)|(\`[^\`\\n]+\`)|(https?:\\/\\/[^\\s<]+[^\\s<.,;:!?)\\]])|(${mentionRe})`, "g");
    let last = 0;
    for (const m of body.matchAll(re)) {
      if (m.index! > last) frag.append(body.slice(last, m.index));
      const [tok] = m;
      if (m[1]) frag.append(h("strong", {}, tok.slice(2, -2)));
      else if (m[2]) frag.append(h("code", {}, tok.slice(1, -1)));
      else if (m[3]) frag.append(h("a", { href: tok, target: "_blank", rel: "noopener noreferrer" }, tok));
      else frag.append(h("span", { className: "mention" }, tok));
      last = m.index! + tok.length;
    }
    if (last < body.length) frag.append(body.slice(last));
    return frag;
  }

  const plain = (body: string) => body.replace(/\*\*([^*\n]+)\*\*/g, "$1").replace(/`([^`\n]+)`/g, "$1");

  // ---------- text box with @mention autocomplete ----------
  function mentionMatches() {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    return members.filter((m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().startsWith(q)).slice(0, 6);
  }

  function textBox(key: string, placeholder: string, onSubmit: () => void, opts: { autofocus?: boolean; send?: boolean } = {}) {
    const ta = h("textarea", { placeholder, "data-key": key, rows: 1 });
    ta.value = texts[key] ?? "";
    const grow = () => {
      ta.style.height = "auto";
      ta.style.height = `${Math.min(160, ta.scrollHeight)}px`;
    };
    requestAnimationFrame(grow);
    const pick = (m: Member) => {
      if (!mention) return;
      const v = ta.value;
      const caret = ta.selectionStart ?? v.length;
      const next = `${v.slice(0, mention.start)}@${m.name} ${v.slice(caret)}`;
      const at = mention.start + m.name.length + 2;
      texts[key] = next;
      mention = null;
      render();
      const again = root.querySelector<HTMLTextAreaElement>(`[data-key="${key}"]`);
      again?.focus();
      again?.setSelectionRange(at, at);
    };
    ta.addEventListener("input", () => {
      texts[key] = ta.value;
      grow();
      const caret = ta.selectionStart ?? ta.value.length;
      const m = /(^|\s)@([^\s@]{0,30})$/.exec(ta.value.slice(0, caret));
      const prev = mention;
      mention = m && members.length ? { key, start: caret - m[2].length - 1, query: m[2], index: 0 } : null;
      if (prev?.query !== mention?.query || !!prev !== !!mention) render();
      else syncSend();
    });
    ta.addEventListener("keydown", (e) => {
      const list = mention?.key === key ? mentionMatches() : [];
      if (list.length && mention) {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          mention.index = (mention.index + (e.key === "ArrowDown" ? 1 : list.length - 1)) % list.length;
          return render();
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          return pick(list[mention.index]);
        }
      }
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        onSubmit();
      }
    });
    const send = opts.send !== false && h("button", { className: "send", title: "Send (Enter)", "aria-label": "Send", onclick: onSubmit }, icon("send"));
    const syncSend = () => {
      if (send) send.disabled = !(texts[key] ?? "").trim() || !!busy[key];
    };
    syncSend();
    const box = h("div", { className: "box" }, ta, send);
    if (mention?.key === key) {
      const list = mentionMatches();
      if (list.length)
        box.append(
          h(
            "div",
            { className: "mentions" },
            ...list.map((m, i) =>
              h(
                "button",
                {
                  className: `mi ${i === mention!.index ? "sel" : ""}`,
                  onmousedown: (e: Event) => {
                    e.preventDefault();
                    pick(m);
                  },
                },
                avatar(m.name, 20, m.avatarUrl),
                m.name,
                h("small", {}, m.email),
              ),
            ),
          ),
        );
    }
    if (opts.autofocus) autofocusKey = key;
    return box;
  }

  // ---------- views ----------
  function composer(d: Draft) {
    const details = h(
      "div",
      { className: "c-details" },
      h(
        "div",
        { className: "rows" },
        h("span", { className: "k" }, "Element"),
        h("span", { className: "v mono", title: d.selector }, d.details.label),
        h("span", { className: "k" }, "Size"),
        h("span", { className: "v" }, d.details.size),
        d.details.text && h("span", { className: "k" }, "Text"),
        d.details.text && h("span", { className: "v", title: d.details.text }, d.details.text),
        h("span", { className: "k" }, "Page"),
        h("span", { className: "v mono", title: location.href }, pathOf(location.href)),
      ),
      d.noShot
        ? h("div", { className: "shot-wait" }, "Screenshot won't be attached")
        : !d.screenshot
          ? h("div", { className: "shot-wait" }, "A screenshot of this spot is attached when you send")
          : d.shot === undefined
          ? h("div", { className: "shot-wait" }, "Capturing screenshot…")
          : d.shot
            ? h("img", { className: "shot", src: d.shot, alt: "Screenshot that will be attached" })
            : h("div", { className: "shot-wait" }, "Screenshot unavailable on this page"),
    );

    const box = textBox("new", members.length > 1 ? "Add a comment… @ to mention" : "Add a comment…", () => postComment(d), { autofocus: true, send: false });
    const send = h("button", { className: "c-send", title: "Send (Enter)", "aria-label": "Send", onclick: () => postComment(d) }, icon("arrowUp"));
    const syncSend = () => (send.disabled = !(texts.new ?? "").trim() || !!busy.new);
    syncSend();
    box.addEventListener("input", syncSend);

    const mentionBtn = () => {
      const ta = box.querySelector("textarea");
      if (!ta) return;
      const v = ta.value;
      const s0 = ta.selectionStart ?? v.length;
      const add = s0 > 0 && !/\s$/.test(v.slice(0, s0)) ? " @" : "@";
      ta.value = v.slice(0, s0) + add + v.slice(ta.selectionEnd ?? s0);
      ta.focus();
      ta.setSelectionRange(s0 + add.length, s0 + add.length);
      ta.dispatchEvent(new Event("input"));
    };

    return h(
      "div",
      { className: `card composer dk${enter("composer")}`, role: "dialog", "aria-label": "New comment" },
      d.quote && h("div", { className: "c-quote" }, `“${d.quote}”`),
      box,
      errors.new && h("div", { className: "err" }, errors.new),
      d.showDetails && details,
      h(
        "div",
        { className: "c-tools" },
        members.length > 0 && iconBtn("at", "Mention someone", mentionBtn),
        iconBtn(
          "camera",
          d.noShot ? "Screenshot off: click to attach one" : "Screenshot attached: click to leave it out",
          () => ((d.noShot = !d.noShot), render()),
          d.noShot ? "off" : "on",
        ),
        h("span", { className: "c-sep" }),
        iconBtn(
          "info",
          d.showDetails ? "Hide details" : "Element & screenshot details",
          () => {
            d.showDetails = !d.showDetails;
            if (d.showDetails && !d.noShot) ensureShot(d);
            render();
          },
          d.showDetails ? "on" : "",
        ),
        h("span", { className: "c-status mono" }, busy.new ? "Posting…" : d.details.label),
        send,
      ),
    );
  }

  function message(t: Thread, m: Thread | Reply, isReply: boolean) {
    const own = !!me && m.authorId === me.id;
    const k = `edit:${m.id}`;
    const actions = h(
      "div",
      { className: `msg-actions ${reactFor === m.id ? "open" : ""}` },
      iconBtn("smile", "Add reaction", (e) => {
        e.stopPropagation();
        reactFor = reactFor === m.id ? null : m.id;
        render();
      }),
      own &&
        iconBtn("pencil", "Edit", () => {
          editing = m.id;
          texts[k] = m.body;
          autofocusKey = k;
          render();
        }),
      canDelete(m.authorId) && iconBtn("trash", isReply ? "Delete reply" : "Delete thread", () => remove(m.id, isReply), "danger"),
    );
    const body =
      editing === m.id
        ? h(
            "div",
            {},
            textBox(k, "Edit…", () => saveEdit(m.id, isReply), { send: false }),
            errors[k] && h("div", { className: "err" }, errors[k]),
            h(
              "div",
              { className: "edit-actions" },
              h("button", { className: "btn ghost sm", onclick: () => ((editing = null), render()) }, "Cancel"),
              h("button", { className: "btn sm", disabled: !!busy[k], onclick: () => saveEdit(m.id, isReply) }, busy[k] ? "Saving…" : "Save"),
            ),
          )
        : h("div", { className: "msg-text" }, formatText(m.body));
    return h(
      "div",
      { className: "msg" },
      avatar(m.authorName, 24, m.authorAvatarUrl),
      h(
        "div",
        { className: "msg-main" },
        h(
          "div",
          { className: "msg-meta" },
          h("b", {}, m.authorName),
          h("span", { title: new Date(m.createdAt).toLocaleString() }, ago(m.createdAt)),
          m.editedAt && h("span", {}, "(edited)"),
        ),
        body,
        (m.reactions.length > 0 || reactFor === m.id) &&
          h(
            "div",
            {},
            m.reactions.length > 0 &&
              h(
                "div",
                { className: "reactions" },
                ...m.reactions.map((r) =>
                  h("button", { className: `rx ${r.mine ? "mine" : ""}`, title: r.names.join(", "), onclick: () => react(m, r.emoji) }, r.emoji, String(r.count)),
                ),
              ),
            reactFor === m.id &&
              h(
                "div",
                { className: "palette" },
                ...REACTIONS.map((emo) => h("button", { title: emo, onclick: (e: Event) => (e.stopPropagation(), react(m, emo)) }, emo)),
              ),
          ),
      ),
      editing !== m.id && actions,
    );
  }

  function thread(t: Thread) {
    const rk = `reply:${t.id}`;
    const sk = `status:${t.id}`;
    return h(
      "div",
      { className: `card${enter(`card:${t.id}`)}`, role: "dialog", "aria-label": `Comment ${label(t)}` },
      h(
        "div",
        { className: "card-head" },
        h("div", { className: "title" }, h("span", { className: "mono" }, label(t)), t.status === "resolved" && h("span", { className: "badge resolved" }, "Resolved")),
        h(
          "button",
          {
            className: `icon-btn resolve ${t.status === "resolved" ? "done" : ""}`,
            title: t.status === "resolved" ? "Resolved: click to reopen" : "Resolve",
            "aria-label": t.status === "resolved" ? "Reopen" : "Resolve",
            disabled: !!busy[sk],
            onclick: () => toggleResolved(t),
          },
          icon("checkCircle"),
        ),
        iconBtn("unread", "Mark as unread", () => {
          markUnread(t);
          activeId = null;
          editing = reactFor = null;
          flash(`Marked ${label(t)} as unread`);
          render();
        }),
        iconBtn("link", "Copy link", () => copyLink(t)),
        iconBtn("x", "Close (Esc)", () => ((activeId = null), (editing = reactFor = null), render())),
      ),
      h(
        "div",
        { className: "card-body" },
        t.meta?.quote && h("div", { className: "quote" }, `“${t.meta.quote}”`),
        t.meta?.element && h("span", { className: "el-chip mono", title: t.selector }, t.meta.element),
        message(t, t, false),
        ...t.replies.map((r) => message(t, r, true)),
      ),
      h(
        "div",
        { className: "card-foot" },
        textBox(rk, "Reply…", () => postReply(t)),
        errors[rk] && h("div", { className: "err" }, errors[rk]),
        errors[sk] && h("div", { className: "err" }, errors[sk]),
      ),
    );
  }

  function inboxPanel() {
    const here = normalisePage(location.href);
    const source = inboxScope === "page" ? all.filter((t) => t.pageUrl === here) : all;
    const list = source.filter((t) => inboxFilter === "all" || t.status === inboxFilter);
    const unread = source.filter(isUnread);
    const seg = (v: typeof inboxScope, text: string) =>
      h("button", { className: inboxScope === v ? "on" : "", onclick: () => ((inboxScope = v), (listToTop = true), render()) }, text);
    const chip = (v: typeof inboxFilter, text: string) =>
      h("button", { className: `chip ${inboxFilter === v ? "on" : ""}`, onclick: () => ((inboxFilter = v), (listToTop = true), render()) }, text);

    return h(
      "div",
      { className: `inbox${enter("inbox")}`, role: "dialog", "aria-label": "Comments" },
      h(
        "div",
        { className: "inbox-head" },
        h("div", { className: "row1" }, h("h3", {}, project ? `${project.name} · Comments` : "Comments"), iconBtn("x", "Close (Esc)", () => ((inbox = false), render()))),
        h("div", { className: "seg" }, seg("page", "This page"), seg("all", "All pages")),
        h(
          "div",
          { className: "filters" },
          chip("open", "Open"),
          chip("resolved", "Resolved"),
          chip("all", "All"),
          h(
            "button",
            {
              className: `btn ghost sm mark-all ${unread.length ? "" : "hidden"}`,
              "aria-hidden": unread.length ? undefined : "true",
              tabindex: unread.length ? undefined : "-1",
              onclick: () => (markSeen(...unread), render()),
            },
            "Mark all read",
          ),
        ),
      ),
      h(
        "div",
        { className: "list" },
        ...(list.length
          ? list.map((t) => {
              const u = isUnread(t);
              return h(
                "button",
                { className: `item ${u ? "unread" : ""} ${activeId === t.id ? "active" : ""}`, onclick: () => focusThread(t) },
                avatar(t.authorName, 28, t.authorAvatarUrl),
                h(
                  "div",
                  { className: "item-main" },
                  h("div", { className: "item-top" }, h("b", {}, t.authorName), h("span", {}, ago(lastActivity(t).at)), u && h("span", { className: "udot", title: "Unread" })),
                  h("div", { className: "item-body" }, plain(t.body)),
                  h(
                    "div",
                    { className: "item-meta" },
                    h("span", { className: "mono" }, label(t)),
                    t.replies.length > 0 && h("span", {}, `${t.replies.length} ${t.replies.length === 1 ? "reply" : "replies"}`),
                    t.status === "resolved" && h("span", { className: "badge resolved" }, "Resolved"),
                    inboxScope === "all" && h("span", { className: "path mono", title: t.fullUrl }, pathOf(t.fullUrl)),
                  ),
                ),
              );
            })
          : [
              h(
                "div",
                { className: "empty" },
                h("b", {}, inboxFilter === "resolved" ? "No resolved comments" : "No comments yet"),
                inboxScope === "page" ? "Press C or click the comment button, then click anywhere on the page." : "Comments from every page will show up here.",
              ),
            ]),
      ),
    );
  }

  // ---------- docked pill + menu ----------
  type MenuItem = { id: string; label: string; icon: IconName; kbd?: string; badge?: string; danger?: boolean; run: () => void };

  function menuGroups(): { title: string; items: MenuItem[] }[] {
    const close = () => {
      accountMenu = false;
      menuQuery = "";
    };
    const unread = all.filter(isUnread).length;
    const tools: MenuItem[] = [
      { id: "inspect", label: inspecting ? "Stop inspecting" : "Inspect CSS", icon: "inspect", kbd: "X", run: () => (close(), toggleInspect()) },
    ];
    if (!me)
      return [
        {
          title: "Comments",
          items: [
            {
              id: "signin",
              label: signingIn ? "Cancel sign-in" : "Sign in with Google to comment",
              icon: signingIn ? "x" : "google",
              run: () => {
                close();
                if (signingIn) {
                  stopSignIn();
                  render();
                } else signIn();
              },
            },
          ],
        },
        { title: "Tools", items: tools },
      ];
    return [
      {
        title: "Comments",
        items: [
          { id: "comment", label: commenting ? "Stop commenting" : "Comment", icon: "comment", kbd: "C", run: () => (close(), toggleCommenting()) },
          {
            id: "inbox",
            label: "Inbox",
            icon: "inbox",
            kbd: "I",
            badge: unread ? (unread > 99 ? "99+" : String(unread)) : undefined,
            run: () => (close(), (inbox = true), render()),
          },
          { id: "pins", label: showPins ? "Hide comments on page" : "Show comments on page", icon: showPins ? "eyeOff" : "eye", kbd: "H", run: () => (close(), togglePins()) },
          {
            id: "resolved",
            label: showResolvedPins ? "Hide resolved comments" : "Show resolved comments",
            icon: "checkCircle",
            run: () => (close(), (showResolvedPins = !showResolvedPins), render()),
          },
        ],
      },
      { title: "Tools", items: tools },
      { title: "Account", items: [{ id: "signout", label: "Sign out", icon: "logout", danger: true, run: () => (close(), signOut()) }] },
    ];
  }

  function menuPanel() {
    const q = menuQuery.trim().toLowerCase();
    const groups = menuGroups()
      .map((g) => ({ ...g, items: g.items.filter((i) => !q || i.label.toLowerCase().includes(q) || g.title.toLowerCase().includes(q)) }))
      .filter((g) => g.items.length);
    const flat = groups.flatMap((g) => g.items);
    menuIndex = Math.min(menuIndex, Math.max(0, flat.length - 1));

    const input = h("input", { className: "cmd-input", placeholder: "What do you need?", "data-key": "menu", "aria-label": "Search actions", value: menuQuery });
    input.addEventListener("input", () => {
      menuQuery = input.value;
      menuIndex = 0;
      render();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!flat.length) return;
        menuIndex = (menuIndex + (e.key === "ArrowDown" ? 1 : flat.length - 1)) % flat.length;
        render();
      } else if (e.key === "Enter") {
        e.preventDefault();
        flat[menuIndex]?.run();
      }
    });

    const status = h(
      "div",
      { className: "cmd-status" },
      h("span", { className: `live ${me ? "" : "off"}` }),
      h(
        "div",
        { className: "meta" },
        h("b", {}, project?.name ?? "Fixes"),
        h("span", { className: "mono", title: location.href }, pathOf(location.href)),
      ),
      members.length > 0 && h("div", { className: "stack" }, ...members.slice(0, 3).map((m) => avatar(m.name, 24, m.avatarUrl))),
    );

    let n = -1;
    return h(
      "div",
      { className: `cmd dk${enter("menu")}`, role: "dialog", "aria-label": "Fixes menu" },
      h("div", { className: "cmd-head" }, h("span", { className: "cmd-chip" }, "Fixes"), h("div", { className: "cmd-search" }, input, h("span", { className: "kbd" }, "Esc"))),
      h(
        "div",
        { className: "cmd-body" },
        status,
        ...groups.map((g) =>
          h(
            "div",
            { className: "cmd-group" },
            h("div", { className: "cmd-title" }, g.title),
            ...g.items.map((i) => {
              const idx = ++n;
              return h(
                "button",
                {
                  className: `cmd-item ${idx === menuIndex ? "sel" : ""} ${i.danger ? "danger" : ""}`,
                  onmouseenter: () => {
                    if (menuIndex === idx) return;
                    menuIndex = idx;
                    root.querySelectorAll(".cmd-item").forEach((b, j) => b.classList.toggle("sel", j === idx));
                  },
                  onclick: i.run,
                },
                icon(i.icon),
                h("span", { className: "label" }, i.label),
                i.badge && h("span", { className: "count" }, i.badge),
                i.kbd && h("span", { className: "kbd" }, i.kbd),
              );
            }),
          ),
        ),
        !flat.length && h("div", { className: "cmd-empty" }, `Nothing matches “${menuQuery}”`),
      ),
    );
  }

  /** Latest unread comments, beside the pill. Hidden while another panel is open or after dismissing. */
  function unreadPeek() {
    if (!me || inbox || draft || commenting || inspecting || activeId) return null;
    const latest = (t: Thread) => {
      const msgs: (Thread | Reply)[] = [t, ...t.replies].filter((m) => m.authorId !== me!.id);
      return msgs[msgs.length - 1] ?? t;
    };
    const unread = all
      .filter(isUnread)
      .map((t) => ({ t, m: latest(t), at: lastActivity(t).at }))
      .sort((a, b) => (a.at < b.at ? 1 : -1));
    if (!unread.length || unread[0].at <= peekHidden) return null;
    const dismiss = () => {
      peekHidden = unread[0].at;
      store.set(`fb_peek:${KEY}`, peekHidden);
      render();
    };
    return h(
      "div",
      { className: `peek dk${enter("peek")}`, role: "region", "aria-label": "Unread comments" },
      h(
        "div",
        { className: "peek-head" },
        h("span", { className: "udot" }),
        h("b", {}, `${unread.length} unread`),
        h("span", { className: "grow" }),
        h("button", { className: "link", onclick: () => (markSeen(...unread.map((u) => u.t)), render()) }, "Mark all read"),
        iconBtn("x", "Hide for now", dismiss),
      ),
      ...unread.slice(0, 3).map(({ t, m }) =>
        h(
          "button",
          { className: "peek-item", onclick: () => focusThread(t), title: "Open this comment" },
          avatar(m.authorName, 28, m.authorAvatarUrl),
          h(
            "span",
            { className: "peek-text" },
            h(
              "span",
              { className: "peek-meta" },
              h("b", {}, m.authorName),
              h("span", { className: "mono" }, project ? `${project.prefix}-${t.number}` : `#${t.number}`),
              m !== t && h("span", { className: "tag" }, "replied"),
              h("span", {}, ago(m.createdAt)),
            ),
            h("span", { className: "peek-body" }, m.body),
            t.pageUrl !== normalisePage(location.href) && h("span", { className: "peek-page mono" }, pathOf(t.fullUrl)),
          ),
        ),
      ),
      unread.length > 3 && h("button", { className: "peek-more", onclick: () => ((inbox = true), render()) }, `View all ${unread.length} in Inbox`),
    );
  }

  function toolbar() {
    const unread = all.filter(isUnread).length;
    const tb = h("div", { className: "toolbar dock dk", role: "toolbar", "aria-label": "Fixes" });
    tb.addEventListener("pointerdown", onDragStart);
    tb.addEventListener(
      "click",
      (e) => {
        if (!suppressClick) return;
        e.preventDefault();
        e.stopPropagation();
      },
      true,
    );
    // No visible handle: the whole pill drags. Double-click its edge to put it back.
    tb.addEventListener("dblclick", (e) => {
      if (e.composedPath()[0] === tb) resetPos();
    });
    toolbarEl = tb;

    const btn = (name: IconName, title: string, on: boolean, onclick: () => void, extra?: Child) =>
      h("button", { className: `tb ${on ? "on" : ""}`, title, "aria-label": title, "aria-pressed": on ? "true" : "false", onclick }, icon(name), extra);
    tb.append(
      btn("comment", !me ? "Sign in to comment (C)" : commenting ? "Stop commenting (C)" : "Comment (C)", commenting, toggleCommenting),
      me ? btn(
          "inbox",
          unread ? `Inbox: ${unread} unread (I)` : "Inbox (I)",
          inbox,
          () => ((inbox = !inbox), (accountMenu = false), render()),
          unread > 0 && h("span", { className: "ucount" }, unread > 99 ? "99+" : String(unread)),
        ) : "",
      btn("inspect", inspecting ? "Stop inspecting (X)" : "Inspect CSS (X)", inspecting, toggleInspect),
      btn("menu", "Menu", accountMenu, () => {
        accountMenu = !accountMenu;
        menuQuery = "";
        menuIndex = 0;
        if (accountMenu) autofocusKey = "menu";
        render();
      }),
    );
    if (accountMenu) tb.append(menuPanel());
    else {
      const p = unreadPeek();
      if (p) tb.append(p);
    }
    if (toast) tb.append(h("div", { className: "toast", role: "status" }, toast));
    return tb;
  }

  // ---------- CSS inspector ----------
  const hex = (c: string) => {
    const m = c.match(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\)/);
    if (!m) return c;
    const a = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    if (a === 0) return "transparent";
    const hx = [m[1], m[2], m[3]].map((v) => Math.round(+v).toString(16).padStart(2, "0")).join("");
    return a < 1 ? `#${hx} · ${Math.round(a * 100)}%` : `#${hx}`;
  };
  const px = (v: string) => (v.endsWith("px") ? `${Math.round(parseFloat(v) * 10) / 10}` : v);
  const sides = (cs: CSSStyleDeclaration, p: string) => {
    const [t, r, b, l] = ["top", "right", "bottom", "left"].map((s) => px(cs.getPropertyValue(`${p}-${s}${p === "border" ? "-width" : ""}`)));
    return { t, r, b, l, text: t === r && r === b && b === l ? `${t}px` : `${t} ${r} ${b} ${l}` };
  };

  function inspectorPanel() {
    const el = inspected?.isConnected ? inspected : null;
    const panel = h("div", { className: `inspector dk${enter("inspector")}`, role: "dialog", "aria-label": "CSS inspector" });
    const head = h(
      "div",
      { className: "ins-head" },
      icon("inspect"),
      h("b", {}, "Inspect"),
      h("span", { className: "kbd" }, "X"),
      h("span", { className: "grow" }),
      iconBtn("x", "Close inspector (Esc)", () => ((inspecting = false), (inspected = null), render())),
    );
    if (!el) {
      panel.append(head, h("div", { className: "ins-empty" }, h("b", {}, "Pick an element"), "Hover anything on the page, then click it to see its styles."));
      return panel;
    }
    const cs = getComputedStyle(el);
    const d = describe(el);
    const color = (v: string) => h("span", { className: "sw-row" }, h("span", { className: "sw", style: `background:${v}` }), hex(v));
    const row = (k: string, v: Child) => h("div", { className: "ins-row" }, h("span", { className: "k" }, k), h("span", { className: "v" }, v));
    const section = (title: string, ...rows: Child[]) => h("div", { className: "ins-sec" }, h("div", { className: "ins-title" }, title), ...rows);
    const edges = (cls: string, label: string, e: { t: string; r: string; b: string; l: string }, inner: Child) =>
      h(
        "div",
        { className: `bm ${cls}` },
        h("span", { className: "lbl" }, label),
        h("span", { className: "t" }, e.t),
        h("span", { className: "r" }, e.r),
        h("span", { className: "b" }, e.b),
        h("span", { className: "l" }, e.l),
        inner,
      );

    const m = sides(cs, "margin");
    const b = sides(cs, "border");
    const pd = sides(cs, "padding");
    const r = el.getBoundingClientRect();
    const size = `${Math.round(r.width)} × ${Math.round(r.height)}`;
    const box = edges("m", "margin", m, edges("bd", "border", b, edges("p", "padding", pd, h("div", { className: "bm c" }, size))));

    const hasText = !!(el.textContent ?? "").trim();
    const isFlex = /flex|grid/.test(cs.display);
    const css = [
      `/* ${d.label} */`,
      `font: ${cs.fontWeight} ${cs.fontSize}/${cs.lineHeight} ${cs.fontFamily};`,
      `color: ${hex(cs.color)};`,
      `background: ${hex(cs.backgroundColor)};`,
      `margin: ${m.text};`,
      `padding: ${pd.text};`,
      b.text !== "0px" && `border: ${b.text} ${cs.borderTopStyle} ${hex(cs.borderTopColor)};`,
      cs.borderRadius !== "0px" && `border-radius: ${cs.borderRadius};`,
      `display: ${cs.display};`,
      isFlex && cs.gap !== "normal" && `gap: ${cs.gap};`,
    ]
      .filter(Boolean)
      .join("\n");

    panel.append(
      head,
      h("div", { className: "ins-el" }, h("div", { className: "mono name", title: selectorFor(el) }, d.label), h("div", { className: "dim" }, size)),
      h(
        "div",
        { className: "ins-body" },
        section("Box model", box),
        hasText &&
          section(
            "Typography",
            row("Font", cs.fontFamily.split(",")[0].replace(/["']/g, "")),
            row("Size", `${px(cs.fontSize)}px / ${cs.lineHeight === "normal" ? "normal" : `${px(cs.lineHeight)}px`}`),
            row("Weight", cs.fontWeight),
            cs.letterSpacing !== "normal" && row("Tracking", cs.letterSpacing),
            row("Color", color(cs.color)),
            row("Align", cs.textAlign),
          ),
        section(
          "Fill & border",
          row("Background", color(cs.backgroundColor)),
          b.text !== "0px" &&
            row("Border", h("span", { className: "sw-row" }, h("span", { className: "sw", style: `background:${cs.borderTopColor}` }), `${b.text} ${cs.borderTopStyle}`)),
          cs.borderRadius !== "0px" && row("Radius", cs.borderRadius),
          cs.boxShadow !== "none" && row("Shadow", h("span", { className: "clip", title: cs.boxShadow }, cs.boxShadow)),
          cs.opacity !== "1" && row("Opacity", cs.opacity),
        ),
        section(
          "Layout",
          row("Display", cs.display),
          isFlex && row("Direction", cs.flexDirection),
          isFlex && cs.gap !== "normal" && row("Gap", cs.gap),
          isFlex && row("Justify", cs.justifyContent),
          isFlex && row("Align", cs.alignItems),
          cs.position !== "static" && row("Position", cs.position),
          cs.zIndex !== "auto" && row("Z-index", cs.zIndex),
          cs.overflow !== "visible" && row("Overflow", cs.overflow),
        ),
      ),
      h(
        "div",
        { className: "ins-foot" },
        h(
          "button",
          {
            className: "btn outline sm",
            onclick: async () => {
              try {
                await navigator.clipboard.writeText(css);
                flash("CSS copied");
              } catch {
                prompt("Copy CSS:", css);
              }
            },
          },
          "Copy CSS",
        ),
        h(
          "button",
          {
            className: "btn sm",
            onclick: () => {
              if (!me) return signIn();
              const rr = el.getBoundingClientRect();
              inspecting = false;
              inspected = null;
              showPins = true;
              startDraft(el, rr.left + rr.width / 2, rr.top + Math.min(rr.height / 2, 40), rr);
            },
          },
          icon("comment"),
          "Comment on this",
        ),
      ),
    );
    return panel;
  }

  /** Side panels (inspector, inbox) open next to the pill instead of underneath it. */
  function placeInspector() {
    const tb = toolbarEl?.getBoundingClientRect();
    if (!tb) return;
    for (const panel of root.querySelectorAll<HTMLElement>(".inspector, .inbox")) {
      if (tb.left + tb.width / 2 > innerWidth / 2) {
        panel.style.left = "auto";
        panel.style.right = `${Math.round(innerWidth - tb.left + 12)}px`;
      } else {
        panel.style.right = "auto";
        panel.style.left = `${Math.round(tb.right + 12)}px`;
      }
    }
  }

  // ---------- open animations ----------
  // render() rebuilds the DOM, so only add the "enter" class on the render where a panel first appears.
  let listToTop = false;
  let wasOpen = new Set<string>();
  let nowOpen = new Set<string>();
  const enter = (key: string) => {
    nowOpen.add(key);
    return wasOpen.has(key) ? "" : " enter";
  };

  // ---------- render ----------
  let pinEls: { el: HTMLElement; c: Anchor }[] = [];
  let cardEl: { el: HTMLElement; c: Anchor } | null = null;
  let autofocusKey: string | null = null;

  function render() {
    // Keep focus and caret in whichever box was being typed in.
    const active = shadow.activeElement as HTMLTextAreaElement | null;
    const focusKey = active?.dataset?.key ?? null;
    const caret = focusKey ? [active!.selectionStart, active!.selectionEnd] : null;
    const listScroll = root.querySelector(".list")?.scrollTop ?? 0;
    const bodyScroll = root.querySelector(".card-body")?.scrollTop ?? null;

    root.replaceChildren();
    nowOpen = new Set();
    pinEls = [];
    cardEl = null;

    if (me && showPins) {
      const visible = pageThreads().filter((t) => showResolvedPins || t.status === "open" || t.id === activeId);
      for (const t of visible) {
        const el = h(
          "button",
          {
            className: `pin ${t.status === "resolved" ? "resolved" : ""} ${activeId === t.id ? "active" : ""} ${canMove(t) ? "movable" : ""}`,
            title: `${label(t)} · ${t.authorName}: ${t.body.slice(0, 80)}${canMove(t) ? "\nDrag to move it to another element" : ""}`,
            onpointerdown: (e: PointerEvent) => onPinDown(e, t, el),
            onclick: (e: Event) => {
              e.stopPropagation();
              if (pinDragged) return;
              draft = null;
              editing = reactFor = null;
              if (activeId === t.id) activeId = null;
              else {
                activeId = t.id;
                markSeen(t);
              }
              render();
            },
          },
          avatar(t.authorName, 26, t.authorAvatarUrl),
          isUnread(t) && h("span", { className: "dot" }),
        );
        pinEls.push({ el, c: t });
        root.append(el);
      }
      if (draft) {
        const el = h(
          "div",
          { className: "pin draft active" },
          h("span", { className: "plus" }, icon("plus")),
          me && h("span", { className: "me" }, avatar(me.name, 22, me.avatarUrl)),
        );
        pinEls.push({ el, c: draft });
        root.append(el);
        const card = composer(draft);
        cardEl = { el: card, c: draft };
        root.append(card);
      } else {
        const t = findThread(activeId);
        if (t && t.pageUrl === normalisePage(location.href)) {
          const card = thread(t);
          cardEl = { el: card, c: t };
          root.append(card);
        }
      }
    }
    if (inspecting) {
      root.append(highlight, hlLabel, inspectHL, inspectorPanel());
      if (!inspected) root.append(h("div", { className: "hint" }, "Click an element to inspect it", h("span", { className: "kbd" }, "Esc"), "to stop"));
    }
    if (commenting && !draft) {
      root.append(highlight, hlLabel);
      root.append(h("div", { className: "hint" }, "Click anywhere to comment", h("span", { className: "kbd" }, "Esc"), "to cancel"));
    }
    if (selBubble && me && !commenting && !draft) {
      const b = h(
        "button",
        {
          className: "btn sel-bubble",
          onmousedown: (e: Event) => e.preventDefault(),
          onclick: commentOnSelection,
        },
        icon("comment"),
        "Comment",
      );
      b.style.left = `${selBubble.rect.left + selBubble.rect.width / 2}px`;
      b.style.top = `${Math.max(44, selBubble.rect.top)}px`;
      root.append(b);
    }
    if (me && inbox) root.append(inboxPanel());
    root.append(toolbar());

    document.documentElement.style.cursor = (commenting && !draft) || inspecting ? "crosshair" : "";
    wasOpen = nowOpen;
    reposition();

    const list = root.querySelector(".list");
    if (list) list.scrollTop = listToTop ? 0 : listScroll;
    listToTop = false;
    const body = root.querySelector(".card-body");
    if (body && bodyScroll !== null) body.scrollTop = bodyScroll;

    const key = autofocusKey ?? focusKey;
    autofocusKey = null;
    if (key) {
      const ta = root.querySelector<HTMLTextAreaElement>(`[data-key="${key}"]`);
      if (ta) {
        ta.focus({ preventScroll: true });
        if (caret && key === focusKey) ta.setSelectionRange(caret[0] ?? ta.value.length, caret[1] ?? ta.value.length);
        else ta.setSelectionRange(ta.value.length, ta.value.length);
      }
    }
  }

  function reposition() {
    placeToolbar();
    placeInspector();
    if (inspecting && inspected?.isConnected) {
      const r = inspected.getBoundingClientRect();
      Object.assign(inspectHL.style, { display: "block", left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    } else inspectHL.style.display = "none";
    if (cardEl && !toolbarEl?.isConnected) toolbarEl = null;
    for (const { el, c } of pinEls) {
      if (pinDrag?.moved && pinDrag.el === el) continue;
      const p = pinPoint(c);
      el.style.left = `${p.x}px`;
      el.style.top = `${p.y}px`;
      el.style.display = p.y < -30 || p.y > innerHeight + 30 ? "none" : "";
    }
    if (cardEl) {
      const p = pinPoint(cardEl.c);
      placeCard(cardEl.el, p.x, p.y);
    }
    if (selBubble) {
      const r = selBubble.range.getBoundingClientRect();
      if (r.width || r.height) selBubble.rect = r;
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
  document.addEventListener("mouseup", onMouseUp);
  document.addEventListener("selectionchange", onSelectionChange);
  document.addEventListener("keydown", onKey, true);
  addEventListener("pointermove", onDragMove, { passive: false });
  addEventListener("pointermove", onPinMove, { passive: false });
  addEventListener("pointerup", onPinUp);
  addEventListener("pointerup", onDragEnd);
  addEventListener("pointercancel", onDragEnd);
  addEventListener("scroll", schedule, { passive: true, capture: true });
  addEventListener("resize", schedule);

  // SPA navigation + periodic refresh.
  setInterval(() => {
    if (location.href !== lastUrl) {
      const samePage = normalisePage(location.href) === normalisePage(lastUrl);
      lastUrl = location.href;
      if (!samePage) {
        draft = null;
        activeId = editing = null;
        commenting = false;
      }
      load();
    }
    schedule();
  }, 1000);
  // Pull new comments; text being typed is preserved across re-renders.
  const typing = () => {
    const a = shadow.activeElement as HTMLTextAreaElement | HTMLInputElement | null;
    return !!a && /^(INPUT|TEXTAREA)$/.test(a.tagName) && !!a.value;
  };
  setInterval(() => me && !document.hidden && !busy.new && !typing() && load(), 20000);

  load();
})();
