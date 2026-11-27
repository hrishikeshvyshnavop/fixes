// Build a reasonably stable CSS selector for an element.
// Prefers ids and data-testid attributes, falls back to an nth-of-type path.

const looksGenerated = (s: string) => /\d{3,}|[a-f0-9]{8,}|^:|^ember|^react|^radix-/i.test(s);

function esc(s: string) {
  return typeof CSS !== "undefined" && CSS.escape ? CSS.escape(s) : s.replace(/([^\w-])/g, "\\$1");
}

function unique(sel: string, el: Element) {
  try {
    const found = document.querySelectorAll(sel);
    return found.length === 1 && found[0] === el;
  } catch {
    return false;
  }
}

export function selectorFor(el: Element): string {
  const parts: string[] = [];
  let node: Element | null = el;

  while (node && node.nodeType === 1 && node !== document.documentElement) {
    if (node.id && !looksGenerated(node.id)) {
      const idSel = `#${esc(node.id)}`;
      parts.unshift(idSel);
      if (unique(parts.join(" > "), el)) return parts.join(" > ");
      parts.shift();
    }
    for (const attr of ["data-testid", "data-test", "data-cy"]) {
      const v = node.getAttribute(attr);
      if (v) {
        const s = `[${attr}="${v.replace(/"/g, '\\"')}"]`;
        parts.unshift(s);
        if (unique(parts.join(" > "), el)) return parts.join(" > ");
        parts.shift();
      }
    }

    const tag = node.tagName.toLowerCase();
    if (tag === "body") {
      parts.unshift("body");
      break;
    }
    let seg = tag;
    const parent: Element | null = node.parentElement;
    if (parent) {
      const same = Array.from(parent.children).filter((c) => c.tagName === node!.tagName);
      if (same.length > 1) seg += `:nth-of-type(${same.indexOf(node) + 1})`;
    }
    parts.unshift(seg);
    node = parent;
  }
  return parts.join(" > ");
}
