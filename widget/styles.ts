// Mirrors the Fixes dashboard (shadcn "zinc" tokens, Geist, 10px radius), light + dark.
export const CSS = `
:host { all: initial; }
.root {
  --radius: 10px;
  --background: #ffffff;
  --foreground: #09090b;
  --card: #ffffff;
  --primary: #18181b;
  --primary-foreground: #fafafa;
  --muted: #f4f4f5;
  --muted-foreground: #71717a;
  --accent: #f4f4f5;
  --border: #e4e4e7;
  --input: #e4e4e7;
  --ring: #a1a1aa;
  --destructive: #dc2626;
  --success: #16a34a;
  --info: #2563eb;
  --shadow: 0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.08);
  --shadow-lg: 0 2px 4px rgba(0,0,0,.04), 0 16px 48px rgba(0,0,0,.14);
  position: fixed; inset: 0; pointer-events: none; z-index: 2147483000;
  color: var(--foreground); font-size: 13px; line-height: 1.45;
  -webkit-font-smoothing: antialiased;
}
@media (prefers-color-scheme: dark) {
  .root {
    --background: #09090b;
    --foreground: #fafafa;
    --card: #18181b;
    --primary: #e4e4e7;
    --primary-foreground: #18181b;
    --muted: #27272a;
    --muted-foreground: #a1a1aa;
    --accent: #27272a;
    --border: rgba(255,255,255,.1);
    --input: rgba(255,255,255,.15);
    --ring: #71717a;
    --destructive: #f87171;
    --success: #4ade80;
    --info: #60a5fa;
    --shadow: 0 1px 2px rgba(0,0,0,.3), 0 8px 24px rgba(0,0,0,.4);
    --shadow-lg: 0 2px 4px rgba(0,0,0,.3), 0 16px 48px rgba(0,0,0,.5);
  }
}
* { box-sizing: border-box; font-family: Geist, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.root > * { pointer-events: auto; }
button { font: inherit; color: inherit; }
svg { display: block; flex-shrink: 0; }
.mono { font-family: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }

/* ---------- buttons (dashboard: h-8, rounded-md, 13px) ---------- */
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 32px; padding: 0 12px;
  border-radius: calc(var(--radius) - 2px); border: 1px solid transparent; background: var(--primary); color: var(--primary-foreground);
  font-size: 13px; font-weight: 500; cursor: pointer; white-space: nowrap; }
.btn:hover { opacity: .9; }
.btn:disabled { opacity: .5; cursor: default; }
.btn.outline { background: var(--background); color: var(--foreground); border-color: var(--border); box-shadow: 0 1px 2px rgba(0,0,0,.04); }
.btn.outline:hover { background: var(--accent); opacity: 1; }
.btn.ghost { background: transparent; color: var(--muted-foreground); padding: 0 10px; }
.btn.ghost:hover { background: var(--accent); color: var(--foreground); opacity: 1; }
.btn.sm { height: 28px; padding: 0 10px; font-size: 12px; }
.icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: 0; padding: 0;
  border-radius: calc(var(--radius) - 4px); background: transparent; color: var(--muted-foreground); cursor: pointer; }
.icon-btn:hover { background: var(--accent); color: var(--foreground); }
.icon-btn.on { color: var(--success); }
.icon-btn.danger:hover { color: var(--destructive); background: color-mix(in srgb, var(--destructive) 10%, transparent); }

/* ---------- toolbar ---------- */
.toolbar { position: fixed; display: flex; align-items: center; gap: 2px; padding: 4px; border-radius: 999px;
  background: var(--card); border: 1px solid var(--border); box-shadow: var(--shadow-lg);
  user-select: none; -webkit-user-select: none; touch-action: none; cursor: grab; }
.toolbar.dragging, .toolbar.dragging * { cursor: grabbing !important; }
.tb { position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 34px; min-width: 34px;
  padding: 0 9px; border: 0; border-radius: 999px; background: transparent; color: var(--muted-foreground); cursor: pointer; font-size: 13px; font-weight: 500; }
.tb:hover { background: var(--accent); color: var(--foreground); }
.tb.on { background: var(--primary); color: var(--primary-foreground); }
.tb.primary { background: var(--primary); color: var(--primary-foreground); padding: 0 14px; }
.tb.primary:hover { opacity: .9; }
.tb .count { min-width: 18px; height: 18px; padding: 0 5px; margin-left: -1px; border-radius: 999px;
  background: var(--info); color: #fff; font-size: 11px; font-weight: 600; line-height: 18px; text-align: center; }
.sep { width: 1px; height: 20px; background: var(--border); margin: 0 4px; }
.toast { position: absolute; left: 50%; bottom: calc(100% + 10px); transform: translateX(-50%); width: max-content; max-width: 300px;
  background: var(--primary); color: var(--primary-foreground); padding: 7px 12px; border-radius: calc(var(--radius) - 2px);
  font-size: 12px; box-shadow: var(--shadow); pointer-events: none; }
.toolbar.top .toast { bottom: auto; top: calc(100% + 10px); }
.menu { position: absolute; right: 0; bottom: calc(100% + 10px); min-width: 220px; padding: 4px; background: var(--card);
  border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow-lg); }
.toolbar.top .menu { bottom: auto; top: calc(100% + 10px); }
.menu .who { padding: 8px 8px 6px; border-bottom: 1px solid var(--border); margin-bottom: 4px; }
.menu .who b { display: block; font-weight: 500; font-size: 13px; }
.menu .who span { color: var(--muted-foreground); font-size: 12px; }
.mi { display: flex; width: 100%; align-items: center; gap: 8px; height: 32px; padding: 0 8px; border: 0; background: none; text-align: left;
  border-radius: calc(var(--radius) - 4px); color: var(--foreground); font-size: 13px; cursor: pointer; }
.mi:hover { background: var(--accent); }
.mi svg { color: var(--muted-foreground); }
.mi.danger { color: var(--destructive); }
.mi.danger svg { color: var(--destructive); }
.mi .kbd { margin-left: auto; }
.kbd { font-family: "Geist Mono", ui-monospace, monospace; font-size: 11px; color: var(--muted-foreground); border: 1px solid var(--border);
  border-radius: 4px; padding: 0 5px; line-height: 18px; }

/* ---------- picking ---------- */
.highlight { position: fixed; pointer-events: none; outline: 2px solid var(--info); outline-offset: 1px; border-radius: 3px;
  background: color-mix(in srgb, var(--info) 8%, transparent); transition: all 60ms linear; }
.hl-label { position: fixed; pointer-events: none; display: flex; gap: 6px; align-items: center; max-width: 360px; padding: 2px 7px;
  border-radius: 5px; background: var(--info); color: #fff; font-size: 11px; line-height: 18px; white-space: nowrap; overflow: hidden; }
.hl-label .dim { opacity: .75; }
.hint { position: fixed; top: 14px; left: 50%; transform: translateX(-50%); display: flex; gap: 8px; align-items: center;
  background: var(--primary); color: var(--primary-foreground); padding: 6px 12px; border-radius: 999px; font-size: 12px;
  pointer-events: none; box-shadow: var(--shadow); }
.hint .kbd { color: inherit; border-color: color-mix(in srgb, var(--primary-foreground) 30%, transparent); }
.sel-bubble { position: fixed; transform: translate(-50%, calc(-100% - 8px)); }

/* ---------- pins ---------- */
.pin { position: fixed; width: 30px; height: 30px; margin: -32px 0 0 -2px; padding: 2px; border-radius: 15px 15px 15px 3px;
  background: var(--card); box-shadow: 0 2px 8px rgba(0,0,0,.25); cursor: pointer; border: 0; transition: transform 120ms; }
.pin:hover, .pin.active { transform: scale(1.12); transform-origin: bottom left; }
.pin.active { box-shadow: 0 0 0 2px var(--info), 0 2px 8px rgba(0,0,0,.25); }
.pin .avatar { width: 26px; height: 26px; font-size: 11px; border-radius: 13px 13px 13px 2px; }
.pin.resolved { opacity: .55; }
.pin.draft .avatar { background: var(--primary); color: var(--primary-foreground); font-size: 16px; }
.pin .dot { position: absolute; top: -2px; right: -2px; width: 10px; height: 10px; border-radius: 50%; background: var(--info); border: 2px solid var(--card); }

/* ---------- avatars ---------- */
.avatar { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%;
  color: #fff; font-size: 10px; font-weight: 600; flex-shrink: 0; letter-spacing: .02em; position: relative; overflow: hidden; }
.avatar img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }

/* ---------- cards (thread / composer) ---------- */
.card { position: fixed; width: 340px; max-height: min(560px, calc(100vh - 24px)); display: flex; flex-direction: column;
  background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow-lg); overflow: hidden; }
.card-head { display: flex; align-items: center; gap: 4px; padding: 8px 8px 8px 14px; border-bottom: 1px solid var(--border); }
.card-head .title { font-weight: 500; font-size: 13px; margin-right: auto; display: flex; align-items: center; gap: 8px; min-width: 0; }
.card-body { overflow-y: auto; padding: 4px 0; flex: 1; min-height: 0; }
.card-foot { border-top: 1px solid var(--border); padding: 10px; }
.badge { display: inline-flex; align-items: center; height: 20px; padding: 0 7px; border-radius: 999px; font-size: 11px; font-weight: 500;
  border: 1px solid var(--border); color: var(--muted-foreground); white-space: nowrap; }
.badge.resolved { color: var(--success); border-color: color-mix(in srgb, var(--success) 35%, transparent); background: color-mix(in srgb, var(--success) 8%, transparent); }

.details { margin: 10px 12px 2px; border: 1px solid var(--border); border-radius: calc(var(--radius) - 2px); background: var(--muted); overflow: hidden; }
.details .rows { padding: 8px 10px; display: grid; grid-template-columns: auto 1fr; gap: 3px 10px; font-size: 12px; }
.details .k { color: var(--muted-foreground); }
.details .v { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.details .shot { display: block; width: 100%; max-height: 170px; object-fit: cover; object-position: top; border-top: 1px solid var(--border); background: var(--background); }
.details .shot-wait { padding: 14px; text-align: center; color: var(--muted-foreground); font-size: 12px; border-top: 1px solid var(--border); }
.quote { margin: 8px 12px 2px; padding: 6px 10px; border-left: 3px solid var(--info); background: var(--muted); border-radius: 0 6px 6px 0;
  color: var(--muted-foreground); font-size: 12px; white-space: pre-wrap; word-wrap: break-word; max-height: 90px; overflow: auto; }
.el-chip { display: inline-flex; max-width: 100%; margin: 8px 12px 0; padding: 1px 7px; border-radius: 5px; background: var(--muted);
  color: var(--muted-foreground); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.msg { position: relative; display: flex; gap: 10px; padding: 10px 14px; }
.msg:hover { background: color-mix(in srgb, var(--accent) 50%, transparent); }
.msg-main { flex: 1; min-width: 0; }
.msg-meta { display: flex; align-items: baseline; gap: 6px; font-size: 13px; }
.msg-meta b { font-weight: 500; }
.msg-meta span { color: var(--muted-foreground); font-size: 12px; }
.msg-text { margin-top: 2px; white-space: pre-wrap; word-wrap: break-word; }
.msg-text strong { font-weight: 600; }
.msg-text code { font-family: "Geist Mono", ui-monospace, monospace; font-size: 12px; background: var(--muted); padding: 1px 4px; border-radius: 4px; }
.msg-text a { color: var(--info); text-decoration: underline; text-underline-offset: 2px; }
.mention { color: var(--info); font-weight: 500; background: color-mix(in srgb, var(--info) 10%, transparent); border-radius: 4px; padding: 0 2px; }
.msg-actions { position: absolute; top: 6px; right: 8px; display: flex; gap: 1px; padding: 2px; background: var(--card);
  border: 1px solid var(--border); border-radius: 8px; box-shadow: var(--shadow); opacity: 0; pointer-events: none; }
.msg:hover .msg-actions, .msg-actions.open { opacity: 1; pointer-events: auto; }
.msg-actions .icon-btn { width: 24px; height: 24px; }
.reactions { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.rx { display: inline-flex; align-items: center; gap: 4px; height: 24px; padding: 0 7px; border-radius: 999px; border: 1px solid var(--border);
  background: var(--background); font-size: 12px; cursor: pointer; color: var(--foreground); }
.rx:hover { background: var(--accent); }
.rx.mine { border-color: color-mix(in srgb, var(--info) 50%, transparent); background: color-mix(in srgb, var(--info) 10%, transparent); }
.palette { display: flex; gap: 2px; padding: 4px; margin-top: 6px; width: max-content; background: var(--card); border: 1px solid var(--border);
  border-radius: 999px; box-shadow: var(--shadow); }
.palette button { width: 28px; height: 28px; border: 0; background: none; border-radius: 50%; font-size: 15px; cursor: pointer; }
.palette button:hover { background: var(--accent); }

/* ---------- inputs ---------- */
.box { position: relative; display: flex; align-items: flex-end; gap: 6px; border: 1px solid var(--input); border-radius: calc(var(--radius) - 2px);
  background: var(--background); padding: 6px 6px 6px 10px; }
.box:focus-within { border-color: var(--ring); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 35%, transparent); }
textarea { flex: 1; min-width: 0; border: 0; outline: none; resize: none; background: transparent; color: var(--foreground);
  font-size: 13px; line-height: 20px; padding: 2px 0; min-height: 24px; max-height: 160px; }
textarea::placeholder { color: var(--muted-foreground); }
.send { width: 28px; height: 28px; border-radius: 50%; border: 0; background: var(--primary); color: var(--primary-foreground);
  display: inline-flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
.send:disabled { opacity: .35; cursor: default; }
.foot-hint { display: flex; justify-content: space-between; gap: 8px; margin-top: 6px; font-size: 11px; color: var(--muted-foreground); }
.err { color: var(--destructive); font-size: 12px; margin-top: 6px; }
.edit-actions { display: flex; justify-content: flex-end; gap: 6px; margin-top: 6px; }
.mentions { position: absolute; left: 0; right: 0; bottom: calc(100% + 6px); padding: 4px; background: var(--card); border: 1px solid var(--border);
  border-radius: var(--radius); box-shadow: var(--shadow-lg); z-index: 2; }
.mentions .mi { height: 36px; }
.mentions .mi.sel { background: var(--accent); }
.mentions .mi small { color: var(--muted-foreground); font-size: 11px; margin-left: auto; overflow: hidden; text-overflow: ellipsis; }

/* ---------- inbox ---------- */
.inbox { position: fixed; top: 12px; right: 12px; bottom: 12px; width: 380px; max-width: calc(100vw - 24px); display: flex; flex-direction: column;
  background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow-lg); overflow: hidden; }
.inbox-head { padding: 12px 10px 10px 16px; border-bottom: 1px solid var(--border); }
.inbox-head .row1 { display: flex; align-items: center; gap: 4px; }
.inbox-head h3 { margin: 0 auto 0 0; font-size: 14px; font-weight: 600; }
.seg { display: inline-flex; padding: 3px; gap: 2px; background: var(--muted); border-radius: calc(var(--radius) - 2px); margin-top: 10px; }
.seg button { height: 26px; padding: 0 10px; border: 0; border-radius: calc(var(--radius) - 4px); background: none; color: var(--muted-foreground);
  font-size: 12px; font-weight: 500; cursor: pointer; }
.seg button.on { background: var(--card); color: var(--foreground); box-shadow: 0 1px 2px rgba(0,0,0,.08); }
.filters { display: flex; align-items: center; gap: 6px; margin-top: 8px; }
.chip { height: 26px; padding: 0 10px; border-radius: 999px; border: 1px solid var(--border); background: none; color: var(--muted-foreground);
  font-size: 12px; cursor: pointer; }
.chip.on { background: var(--primary); color: var(--primary-foreground); border-color: var(--primary); }
.filters .btn { margin-left: auto; }
.list { flex: 1; overflow-y: auto; }
.item { display: flex; gap: 10px; width: 100%; padding: 12px 16px; border: 0; border-bottom: 1px solid var(--border); background: none;
  text-align: left; cursor: pointer; color: var(--foreground); }
.item:hover { background: color-mix(in srgb, var(--accent) 60%, transparent); }
.item.active { background: var(--accent); }
.item-main { flex: 1; min-width: 0; }
.item-top { display: flex; align-items: baseline; gap: 6px; }
.item-top b { font-weight: 500; }
.item-top span { color: var(--muted-foreground); font-size: 12px; }
.item-top .udot { width: 8px; height: 8px; border-radius: 50%; background: var(--info); margin-left: auto; align-self: center; flex-shrink: 0; }
.item-body { margin-top: 2px; color: var(--muted-foreground); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word; }
.item.unread .item-body { color: var(--foreground); }
.item-meta { display: flex; align-items: center; gap: 8px; margin-top: 6px; font-size: 11px; color: var(--muted-foreground); min-width: 0; }
.item-meta .path { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.empty { padding: 48px 24px; text-align: center; color: var(--muted-foreground); }
.empty b { display: block; color: var(--foreground); font-weight: 500; margin-bottom: 4px; }

/* ---------- setup notice ---------- */
.setup { position: fixed; right: 16px; bottom: 16px; width: 340px; max-width: calc(100vw - 32px); background: #fffbeb; color: #78350f;
  border: 1px solid #fcd34d; border-radius: var(--radius); padding: 10px 30px 10px 12px; box-shadow: var(--shadow); font-size: 12px; }
.setup strong { display: block; font-size: 13px; margin-bottom: 2px; }
.setup p { margin: 0; }
.setup .close { position: absolute; top: 6px; right: 6px; border: 0; background: none; color: #b45309; cursor: pointer; font-size: 16px; }

@media (max-width: 480px) {
  .card { width: calc(100vw - 16px); }
  .inbox { top: auto; height: 70vh; left: 8px; right: 8px; bottom: 8px; width: auto; }
}

/* ---------- dark surfaces (pill, menu, composer, inspector) ---------- */
.dk { --background: #0a0a0a; --foreground: #fafafa; --card: #0a0a0a; --primary: #fafafa; --primary-foreground: #0a0a0a;
  --muted: #18181b; --muted-foreground: #a1a1aa; --accent: #1f1f23; --border: rgba(255,255,255,.12); --input: rgba(255,255,255,.14);
  --ring: #71717a; color: var(--foreground); }

/* docked pill */
.toolbar.dock { flex-direction: column; gap: 4px; padding: 5px; border-radius: 999px; background: #0a0a0a;
  border: 1px solid rgba(255,255,255,.14); box-shadow: 0 0 0 1px rgba(0,0,0,.4), 0 12px 32px rgba(0,0,0,.35); }
.toolbar.dock .tb { width: 36px; height: 36px; min-width: 36px; padding: 0; color: #d4d4d8; }
.toolbar.dock .tb:hover { background: #1f1f23; color: #fff; }
.toolbar.dock .tb.on { background: #fafafa; color: #0a0a0a; }
.toolbar.dock .tb svg { width: 18px; height: 18px; }
.bdot { position: absolute; top: 7px; right: 7px; width: 8px; height: 8px; border-radius: 50%; background: #3b82f6; box-shadow: 0 0 0 2px #0a0a0a; }
.toolbar.dock .toast { left: auto; right: calc(100% + 12px); bottom: auto; top: 50%; transform: translateY(-50%); }
.toolbar.dock.left .toast { right: auto; left: calc(100% + 12px); }

/* menu (command panel) */
.cmd { position: absolute; right: calc(100% + 12px); top: 0; width: 360px; max-width: calc(100vw - 90px);
  max-height: min(520px, calc(100vh - 24px)); display: flex; flex-direction: column; overflow: hidden; cursor: default;
  background: linear-gradient(180deg, #121214, #0a0a0a); border: 1px solid rgba(255,255,255,.12); border-radius: 14px;
  box-shadow: 0 24px 64px rgba(0,0,0,.45); }
.toolbar.dock.left .cmd { right: auto; left: calc(100% + 12px); }
.cmd-head { padding: 12px 12px 10px; border-bottom: 1px solid var(--border); }
.chip { display: inline-block; font-size: 11px; font-weight: 500; color: var(--muted-foreground); border: 1px solid var(--border);
  border-radius: 6px; padding: 1px 7px; background: rgba(255,255,255,.04); }
.cmd-search { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
.cmd-input { flex: 1; min-width: 0; border: 0; outline: none; background: transparent; color: var(--foreground); font: inherit; font-size: 16px; padding: 2px 0; }
.cmd-input::placeholder { color: #71717a; }
.cmd-body { overflow-y: auto; padding: 8px; min-height: 0; }
.cmd-status { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; background: rgba(255,255,255,.06); margin-bottom: 6px; }
.cmd-status .live { width: 8px; height: 8px; border-radius: 50%; background: #34d399; box-shadow: 0 0 0 3px rgba(52,211,153,.18); flex-shrink: 0; }
.cmd-status .live.off { background: #71717a; box-shadow: none; }
.cmd-status .meta { min-width: 0; flex: 1; display: flex; flex-direction: column; }
.cmd-status .meta b { font-weight: 500; font-size: 13px; }
.cmd-status .meta span { color: var(--muted-foreground); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stack { display: flex; }
.stack .avatar { box-shadow: 0 0 0 2px #18181b; }
.stack .avatar + .avatar { margin-left: -7px; }
.cmd-title { padding: 10px 10px 4px; font-size: 12px; color: var(--muted-foreground); }
.cmd-item { display: flex; width: 100%; align-items: center; gap: 10px; height: 38px; padding: 0 10px; border: 0; border-radius: 8px;
  background: none; color: var(--foreground); font-size: 13.5px; text-align: left; cursor: pointer; }
.cmd-item svg { color: var(--muted-foreground); }
.cmd-item.sel { background: rgba(255,255,255,.08); }
.cmd-item.sel svg { color: var(--foreground); }
.cmd-item .label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cmd-item .count { min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; background: #3b82f6; color: #fff; font-size: 11px; font-weight: 600; line-height: 18px; text-align: center; }
.cmd-item.danger, .cmd-item.danger svg { color: #f87171; }
.cmd-empty { padding: 18px 10px; text-align: center; color: var(--muted-foreground); font-size: 13px; }

/* composer (new comment) */
.card.composer { width: 340px; padding: 0; border-radius: 14px; background: #0a0a0a; border: 1px solid rgba(255,255,255,.12);
  box-shadow: 0 16px 48px rgba(0,0,0,.4); overflow: visible; }
.composer .box { border: 0; background: transparent; padding: 12px 14px 4px; box-shadow: none; }
.composer .box:focus-within { box-shadow: none; }
.composer textarea { font-size: 14px; }
.composer .err { margin: 0 14px 6px; }
.c-quote { margin: 12px 14px 0; padding-left: 8px; border-left: 2px solid var(--border); color: var(--muted-foreground); font-size: 12px; font-style: italic; }
.c-tools { display: flex; align-items: center; gap: 2px; padding: 4px 8px 8px; }
.c-tools .icon-btn.off { color: #52525b; }
.c-tools .icon-btn.on { color: var(--foreground); }
.c-sep { width: 1px; height: 16px; background: var(--border); margin: 0 4px; }
.c-status { flex: 1; min-width: 0; padding: 0 6px; font-size: 11px; color: #71717a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.c-send { width: 30px; height: 30px; border-radius: 50%; border: 0; background: #fafafa; color: #0a0a0a; display: inline-flex;
  align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
.c-send:disabled { background: #27272a; color: #71717a; cursor: default; }
.c-details { margin: 4px 12px 6px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; background: var(--muted); }
.c-details .rows { padding: 8px 10px; display: grid; grid-template-columns: auto 1fr; gap: 3px 10px; font-size: 12px; }
.c-details .k { color: var(--muted-foreground); }
.c-details .v { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.c-details .shot { display: block; width: 100%; max-height: 150px; object-fit: cover; object-position: top; border-top: 1px solid var(--border); }
.c-details .shot-wait { padding: 12px; text-align: center; color: var(--muted-foreground); font-size: 12px; border-top: 1px solid var(--border); }

/* draft pin: blue + with your avatar */
.pin.draft { width: auto; height: auto; padding: 0; background: none; box-shadow: none; display: flex; align-items: center; border-radius: 0; margin: -16px 0 0 -16px; }
.pin.draft .plus { width: 32px; height: 32px; border-radius: 50%; background: #3b82f6; color: #fff; display: inline-flex; align-items: center;
  justify-content: center; box-shadow: 0 0 0 3px #0a0a0a, 0 4px 14px rgba(59,130,246,.5); }
.pin.draft .me { margin-left: -8px; border-radius: 50%; box-shadow: 0 0 0 2px #ec4899; }
.pin.draft.active { transform: none; box-shadow: none; }

/* CSS inspector */
.highlight.pinned { outline-color: #f59e0b; background: color-mix(in srgb, #f59e0b 10%, transparent); transition: none; }
.inspector { position: fixed; top: 12px; width: 300px; max-height: calc(100vh - 24px); display: flex; flex-direction: column;
  background: #0a0a0a; border: 1px solid rgba(255,255,255,.12); border-radius: 14px; box-shadow: 0 24px 64px rgba(0,0,0,.45); overflow: hidden; }
.ins-head { display: flex; align-items: center; gap: 8px; padding: 8px 8px 8px 14px; border-bottom: 1px solid var(--border); }
.ins-head svg { color: var(--muted-foreground); }
.ins-head b { font-weight: 500; }
.ins-head .grow { flex: 1; }
.ins-empty { padding: 28px 18px; text-align: center; color: var(--muted-foreground); font-size: 12.5px; display: flex; flex-direction: column; gap: 4px; }
.ins-empty b { color: var(--foreground); font-weight: 500; font-size: 13px; }
.ins-el { padding: 10px 14px; border-bottom: 1px solid var(--border); }
.ins-el .name { color: #fbbf24; font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ins-el .dim { color: var(--muted-foreground); font-size: 12px; margin-top: 2px; }
.ins-body { overflow-y: auto; min-height: 0; padding: 4px 0 8px; }
.ins-sec { padding: 8px 14px; }
.ins-title { font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: .04em; color: #71717a; margin-bottom: 6px; }
.ins-row { display: grid; grid-template-columns: 84px 1fr; gap: 8px; padding: 3px 0; font-size: 12.5px; }
.ins-row .k { color: var(--muted-foreground); }
.ins-row .v { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: "Geist Mono", ui-monospace, monospace; font-size: 12px; }
.sw-row { display: inline-flex; align-items: center; gap: 6px; }
.sw { width: 12px; height: 12px; border-radius: 3px; box-shadow: inset 0 0 0 1px rgba(255,255,255,.25); flex-shrink: 0; }
.clip { display: block; overflow: hidden; text-overflow: ellipsis; }
.ins-foot { display: flex; justify-content: flex-end; gap: 6px; padding: 10px 12px; border-top: 1px solid var(--border); }
.bm { position: relative; display: flex; align-items: center; justify-content: center; padding: 18px 26px; border-radius: 4px;
  font-family: "Geist Mono", ui-monospace, monospace; font-size: 10.5px; }
.bm.m { background: rgba(251,146,60,.14); border: 1px dashed rgba(251,146,60,.5); }
.bm.bd { background: rgba(250,204,21,.12); border: 1px solid rgba(250,204,21,.45); width: 100%; }
.bm.p { background: rgba(74,222,128,.12); border: 1px dashed rgba(74,222,128,.45); width: 100%; }
.bm.c { background: rgba(96,165,250,.18); border: 1px solid rgba(96,165,250,.5); padding: 8px 6px; width: 100%; color: #bfdbfe; }
.bm > .lbl { position: absolute; top: 2px; left: 5px; font-size: 9px; color: #a1a1aa; }
.bm > .t, .bm > .b, .bm > .l, .bm > .r { position: absolute; color: #d4d4d8; }
.bm > .t { top: 2px; left: 50%; transform: translateX(-50%); }
.bm > .b { bottom: 2px; left: 50%; transform: translateX(-50%); }
.bm > .l { left: 6px; top: 50%; transform: translateY(-50%); }
.bm > .r { right: 6px; top: 50%; transform: translateY(-50%); }

/* unread count on the pill + preview card */
.ucount { position: absolute; top: -3px; right: -3px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px;
  background: #3b82f6; color: #fff; font-size: 10.5px; font-weight: 600; line-height: 18px; text-align: center; box-shadow: 0 0 0 2px #0a0a0a; }
.peek { position: absolute; right: calc(100% + 12px); top: 0; width: 320px; max-width: calc(100vw - 90px); cursor: default;
  background: #0a0a0a; border: 1px solid rgba(255,255,255,.12); border-radius: 14px; box-shadow: 0 16px 48px rgba(0,0,0,.4); overflow: hidden; }
.toolbar.dock.left .peek { right: auto; left: calc(100% + 12px); }
.peek-head { display: flex; align-items: center; gap: 8px; padding: 8px 6px 8px 14px; border-bottom: 1px solid var(--border); font-size: 13px; }
.peek-head b { font-weight: 500; }
.peek-head .grow { flex: 1; }
.udot { width: 8px; height: 8px; border-radius: 50%; background: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,.2); }
.link { border: 0; background: none; padding: 4px 6px; border-radius: 6px; color: var(--muted-foreground); font-size: 12px; cursor: pointer; }
.link:hover { color: var(--foreground); background: var(--accent); }
.peek-item { display: flex; gap: 10px; width: 100%; padding: 10px 14px; border: 0; background: none; text-align: left; cursor: pointer; color: var(--foreground); }
.peek-item + .peek-item { border-top: 1px solid rgba(255,255,255,.06); }
.peek-item:hover { background: rgba(255,255,255,.05); }
.peek-text { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 2px; }
.peek-meta { display: flex; align-items: baseline; gap: 6px; font-size: 12px; color: var(--muted-foreground); }
.peek-meta b { color: var(--foreground); font-weight: 500; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.peek-body { font-size: 13px; line-height: 1.4; color: #d4d4d8; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.peek-page { font-size: 11px; color: #71717a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.peek-more { display: block; width: 100%; padding: 9px 14px; border: 0; border-top: 1px solid var(--border); background: none;
  color: var(--muted-foreground); font-size: 12px; text-align: left; cursor: pointer; }
.peek-more:hover { color: var(--foreground); background: rgba(255,255,255,.04); }
.peek-meta .tag { font-size: 10.5px; padding: 0 5px; border-radius: 4px; background: rgba(255,255,255,.08); color: #a1a1aa; }
`;
