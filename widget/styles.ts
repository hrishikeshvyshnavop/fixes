export const CSS = `
:host { all: initial; }
* { box-sizing: border-box; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.root { position: fixed; inset: 0; pointer-events: none; z-index: 2147483000; color: #111827; font-size: 14px; line-height: 1.4; }
.root > * { pointer-events: auto; }

.launcher { position: fixed; right: 20px; bottom: 20px; display: flex; gap: 8px; align-items: center;
  user-select: none; -webkit-user-select: none; touch-action: none; }
.launcher.left { flex-direction: row-reverse; }
.launcher.dragging, .launcher.dragging * { cursor: grabbing !important; }
.launcher.dragging .btn { box-shadow: 0 10px 28px rgba(79,70,229,.45); }
.grip { display: grid; grid-template-columns: repeat(2, 4px); gap: 3px; padding: 9px 7px; border-radius: 999px;
  background: #fff; box-shadow: 0 4px 14px rgba(0,0,0,.12); cursor: grab; }
.grip:hover { background: #f3f4f6; }
.avatar { width: 20px; height: 20px; border-radius: 50%; background: #4f46e5; color: #fff; font-size: 11px; font-weight: 700;
  display: inline-flex; align-items: center; justify-content: center; margin-left: -6px; }
.notice { position: absolute; right: 0; bottom: calc(100% + 8px); width: max-content; max-width: 280px; background: #111827; color: #fff;
  padding: 8px 12px; border-radius: 10px; font-size: 12px; box-shadow: 0 6px 20px rgba(0,0,0,.25); pointer-events: none; }
.launcher.left .notice { right: auto; left: 0; }
.launcher.top .notice { bottom: auto; top: calc(100% + 8px); }
.grip span { width: 4px; height: 4px; border-radius: 50%; background: #9ca3af; }
.btn { border: 0; cursor: pointer; border-radius: 999px; padding: 10px 16px; font-size: 14px; font-weight: 600;
  background: #4f46e5; color: #fff; box-shadow: 0 6px 20px rgba(79,70,229,.35); display: inline-flex; align-items: center; gap: 8px; }
.btn:hover { background: #4338ca; }
.btn.ghost { background: #fff; color: #374151; box-shadow: 0 4px 14px rgba(0,0,0,.12); }
.btn.ghost:hover { background: #f3f4f6; }
.btn.ghost.on { background: #eef2ff; color: #4338ca; }
.btn.small { padding: 6px 12px; font-size: 13px; box-shadow: none; }
.btn:disabled { opacity: .6; cursor: default; }
.badge { background: rgba(255,255,255,.25); border-radius: 999px; padding: 0 7px; font-size: 12px; }

.hint { position: fixed; top: 16px; left: 50%; transform: translateX(-50%); background: #111827; color: #fff;
  padding: 8px 14px; border-radius: 999px; font-size: 13px; pointer-events: none; box-shadow: 0 6px 20px rgba(0,0,0,.25); }

.highlight { position: fixed; pointer-events: none; outline: 2px dashed #4f46e5; outline-offset: 2px;
  background: rgba(79,70,229,.06); border-radius: 3px; transition: all 60ms linear; }

.pin { position: fixed; width: 28px; height: 28px; margin: -28px 0 0 -2px; border-radius: 14px 14px 14px 2px;
  background: #4f46e5; color: #fff; font-size: 12px; font-weight: 700; display: flex; align-items: center;
  justify-content: center; cursor: pointer; border: 2px solid #fff; box-shadow: 0 3px 10px rgba(0,0,0,.25); }
.pin.resolved { background: #10b981; }
.pin.active { transform: scale(1.15); }
.pin.draft { background: #f59e0b; }

.card { position: fixed; width: 320px; max-height: 70vh; overflow: auto; background: #fff; border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0,0,0,.22); border: 1px solid #e5e7eb; padding: 14px; }
.card h4 { margin: 0 0 8px; font-size: 13px; color: #6b7280; font-weight: 600; display: flex; justify-content: space-between; align-items: center; }
.close { border: 0; background: none; cursor: pointer; color: #9ca3af; font-size: 18px; line-height: 1; padding: 0 2px; }
textarea, input[type=text] { width: 100%; border: 1px solid #d1d5db; border-radius: 8px; padding: 8px 10px; font-size: 14px;
  color: #111827; background: #fff; outline: none; resize: vertical; }
textarea:focus, input[type=text]:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,.2); }
textarea { min-height: 72px; }
.row { display: flex; gap: 8px; align-items: center; justify-content: space-between; margin-top: 10px; }
.field { margin-top: 8px; }
label.check { display: flex; gap: 6px; align-items: center; font-size: 12px; color: #4b5563; cursor: pointer; }

.msg { padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
.msg:last-of-type { border-bottom: 0; }
.who { font-weight: 600; font-size: 13px; }
.when { color: #9ca3af; font-size: 12px; margin-left: 6px; font-weight: 400; }
.text { margin-top: 2px; white-space: pre-wrap; word-wrap: break-word; }
.status { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; padding: 2px 8px; border-radius: 999px; }
.status.open { background: #eef2ff; color: #4338ca; }
.status.resolved { background: #d1fae5; color: #047857; }
.err { color: #b91c1c; font-size: 12px; margin-top: 6px; }
.setup { position: fixed; right: 20px; bottom: 20px; width: 340px; max-width: calc(100vw - 40px); background: #fffbeb; color: #78350f;
  border: 1px solid #fcd34d; border-radius: 10px; padding: 10px 30px 10px 12px; box-shadow: 0 8px 24px rgba(0,0,0,.15); font-size: 12px; }
.setup strong { display: block; font-size: 13px; margin-bottom: 2px; }
.setup p { margin: 0; }
.setup .close { position: absolute; top: 6px; right: 6px; color: #b45309; }
`;
