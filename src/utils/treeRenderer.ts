import { NODE_W, UNION_R, type Link, type PersonCard, type TreeLayout, type UnionKnot } from "./treeLayout";

/**
 * Canvas renderer for the family tree.
 *
 * The whole tree is painted on one <canvas>: panning and zooming only repaint
 * the cards inside the viewport (one frame at most per animation frame), and
 * below LOD_ZOOM cards degrade to plain coloured blocks. Nothing here goes
 * through React, so moving around never triggers a render.
 */

const MIN_ZOOM = 0.01;
const MAX_ZOOM = 2;
/** Below this zoom, text is unreadable: cards are drawn as coloured blocks. */
const LOD_ZOOM = 0.2;
const HOME_MIN_ZOOM = 0.7;
const CARD_R = 6;
const PAD_X = 12;
const PORTRAIT = 40;
const CHIP_H = 18;
const PANEL_W = 360;

export interface TreeRendererHandlers {
  onPersonClick: (id: string, multi: boolean) => void;
  onPersonDoubleClick: (id: string) => void;
  onPersonContextMenu: (id: string, clientX: number, clientY: number) => void;
  onPaneClick: () => void;
  onToggleFold: (id: string) => void;
}

interface TextLine {
  text: string;
  font: string;
  color: string;
  /** centre of the line, relative to the card's top */
  dy: number;
}

interface CardPaint {
  lines: TextLine[];
  portraitY?: number;
  chipText?: string;
  chipW: number;
}

interface Hit {
  card: PersonCard;
  chip: boolean;
}

const EMPTY: TreeLayout = {
  cards: [],
  byId: new Map(),
  unions: [],
  unionLinks: [],
  lineageLinks: [],
  width: 0,
  height: 0,
};

export class TreeRenderer {
  private canvas: HTMLCanvasElement;
  private mini: HTMLCanvasElement | null;
  private ctx: CanvasRenderingContext2D;
  handlers: TreeRendererHandlers;

  private layout: TreeLayout = EMPTY;
  private homeKey: string | null = null;
  private homeId: string | null = null;
  private pendingHome = false;
  private selected = new Set<string>();
  private view = { x: 0, y: 0, k: 1 };
  private w = 0;
  private h = 0;
  private dpr = 1;
  private frame = 0;
  private anim = 0;

  private paints = new WeakMap<PersonCard, CardPaint>();
  private tagWidths = new WeakMap<UnionKnot, number>();
  private images = new Map<string, HTMLImageElement>();

  private pointers = new Map<number, { x: number; y: number }>();
  private dragStart: { x: number; y: number } | null = null;
  private dragged = false;
  private pinchDist = 0;
  private hover: Hit | null = null;
  /** card to keep still on screen across the next layout change */
  private anchorId: string | null = null;

  private colors: Record<string, string>;
  private fonts: { serif: string; sans: string };
  private resizeObserver: ResizeObserver;
  private abort = new AbortController();

  constructor(canvas: HTMLCanvasElement, mini: HTMLCanvasElement | null, handlers: TreeRendererHandlers) {
    this.canvas = canvas;
    this.mini = mini;
    this.handlers = handlers;
    this.ctx = canvas.getContext("2d")!;

    const css = getComputedStyle(document.documentElement);
    const v = (name: string) => css.getPropertyValue(name).trim();
    this.colors = {};
    for (const name of [
      "card", "card-raised", "ink", "ink-soft", "ink-faint", "line-strong",
      "forest", "forest-tint", "wine", "wine-dark", "gold", "gold-tint", "danger",
      "male", "male-tint", "female", "female-tint", "neutral", "neutral-tint",
    ]) {
      this.colors[name] = v(`--${name}`);
    }
    this.fonts = { serif: v("--font-serif"), sans: v("--font-sans") };

    const signal = this.abort.signal;
    canvas.addEventListener("pointerdown", this.onPointerDown, { signal });
    canvas.addEventListener("pointermove", this.onPointerMove, { signal });
    canvas.addEventListener("pointerup", this.onPointerUp, { signal });
    canvas.addEventListener("pointercancel", this.onPointerCancel, { signal });
    canvas.addEventListener("pointerleave", this.onPointerLeave, { signal });
    canvas.addEventListener("dblclick", this.onDoubleClick, { signal });
    canvas.addEventListener("contextmenu", this.onContextMenu, { signal });
    canvas.addEventListener("wheel", this.onWheel, { signal, passive: false });
    if (mini) {
      mini.addEventListener("pointerdown", this.onMiniPointer, { signal });
      mini.addEventListener("pointermove", this.onMiniPointer, { signal });
    }
    // web fonts change text widths: measure again once they are in
    document.fonts?.addEventListener("loadingdone", this.onFontsLoaded, { signal });

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  destroy() {
    this.abort.abort();
    this.resizeObserver.disconnect();
    cancelAnimationFrame(this.frame);
    cancelAnimationFrame(this.anim);
  }

  // ── Public API ───────────────────────────────────────────────────

  /** `homeKey` identifies what is being looked at: the view is reset when it changes. */
  setLayout(layout: TreeLayout, homeKey: string, homeId: string | null) {
    const old = this.layout;
    this.layout = layout;
    this.homeId = homeId;
    this.hover = null;

    if (homeKey !== this.homeKey || old.cards.length === 0) {
      this.homeKey = homeKey;
      this.home();
    } else if (old !== layout) {
      // keep the card the user was looking at where it is on screen
      const anchor = this.pickAnchor(old, layout);
      if (anchor) {
        const before = old.byId.get(anchor)!;
        const after = layout.byId.get(anchor)!;
        this.view.x += (before.x - after.x) * this.view.k;
        this.view.y += (before.y - after.y) * this.view.k;
      }
    }
    this.anchorId = null;
    this.requestDraw();
  }

  setSelected(ids: string[]) {
    this.selected = new Set(ids);
    this.requestDraw();
  }

  centerOn(id: string) {
    const card = this.layout.byId.get(id);
    if (!card) return;
    const k = Math.max(this.view.k, 0.9);
    // leave room for the detail panel, which opens over the right edge
    const cx = this.w > PANEL_W * 2.5 ? (this.w - PANEL_W) / 2 : this.w / 2;
    this.animateTo({
      k,
      x: cx - (card.x + NODE_W / 2) * k,
      y: this.h / 2 - (card.y + card.h / 2) * k,
    });
  }

  fit() {
    const { width, height } = this.layout;
    if (!width || !height || !this.w) return;
    const k = Math.min(Math.max(Math.min(this.w / width, this.h / height), MIN_ZOOM), 1);
    this.animateTo({ k, x: (this.w - width * k) / 2, y: (this.h - height * k) / 2 });
  }

  zoomBy(factor: number) {
    const k = Math.min(Math.max(this.view.k * factor, MIN_ZOOM), MAX_ZOOM);
    const f = k / this.view.k;
    this.animateTo({
      k,
      x: this.w / 2 - (this.w / 2 - this.view.x) * f,
      y: this.h / 2 - (this.h / 2 - this.view.y) * f,
    }, 150);
  }

  // ── View ─────────────────────────────────────────────────────────

  /** Readable zoom, with the home person in sight near the bottom of the screen. */
  private home() {
    const { width, height } = this.layout;
    if (!this.w || !this.h) {
      this.pendingHome = true;
      return;
    }
    this.pendingHome = false;
    cancelAnimationFrame(this.anim);
    if (!width || !height) return;
    const fitK = Math.min(this.w / width, this.h / height);
    const card = this.homeId ? this.layout.byId.get(this.homeId) : undefined;
    const k = Math.min(Math.max(fitK, card ? HOME_MIN_ZOOM : MIN_ZOOM), 1);
    this.view.k = k;
    this.view.x =
      width * k <= this.w || !card
        ? (this.w - width * k) / 2
        : this.w / 2 - (card.x + NODE_W / 2) * k;
    this.view.y =
      height * k <= this.h || !card
        ? (this.h - height * k) / 2
        : this.h * 0.8 - (card.y + card.h / 2) * k;
  }

  private pickAnchor(old: TreeLayout, next: TreeLayout): string | null {
    if (this.anchorId && old.byId.has(this.anchorId) && next.byId.has(this.anchorId)) {
      return this.anchorId;
    }
    const cx = (this.w / 2 - this.view.x) / this.view.k;
    const cy = (this.h / 2 - this.view.y) / this.view.k;
    let best: string | null = null;
    let bestDist = Infinity;
    for (const c of old.cards) {
      if (!next.byId.has(c.id)) continue;
      const d = (c.x + NODE_W / 2 - cx) ** 2 + (c.y + c.h / 2 - cy) ** 2;
      if (d < bestDist) {
        best = c.id;
        bestDist = d;
      }
    }
    return best;
  }

  private animateTo(target: { x: number; y: number; k: number }, duration = 350) {
    cancelAnimationFrame(this.anim);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) duration = 0;
    const from = { ...this.view };
    const start = performance.now();
    const step = (now: number) => {
      const t = duration ? Math.min((now - start) / duration, 1) : 1;
      const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
      // interpolate the zoom geometrically so the motion looks even
      this.view.k = from.k * (target.k / from.k) ** e;
      this.view.x = from.x + (target.x - from.x) * e;
      this.view.y = from.y + (target.y - from.y) * e;
      this.draw();
      if (t < 1) this.anim = requestAnimationFrame(step);
    };
    this.anim = requestAnimationFrame(step);
  }

  private zoomAt(sx: number, sy: number, factor: number) {
    const k = Math.min(Math.max(this.view.k * factor, MIN_ZOOM), MAX_ZOOM);
    const f = k / this.view.k;
    this.view.x = sx - (sx - this.view.x) * f;
    this.view.y = sy - (sy - this.view.y) * f;
    this.view.k = k;
    this.requestDraw();
  }

  private resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    if (w === this.w && h === this.h && dpr === this.dpr) return;
    // keep the same world point in the middle of the screen
    if (this.w && this.h) {
      this.view.x += (w - this.w) / 2;
      this.view.y += (h - this.h) / 2;
    }
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    if (this.pendingHome) this.home();
    this.draw();
  }

  // ── Input ────────────────────────────────────────────────────────

  private local(e: { clientX: number; clientY: number }) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private hitTest(sx: number, sy: number): Hit | null {
    const { x, y, k } = this.view;
    const wx = (sx - x) / k;
    const wy = (sy - y) / k;
    const chips = k >= LOD_ZOOM;
    for (const card of this.layout.cards) {
      if (wy < card.y - CHIP_H || wy > card.y + card.h) continue;
      if (chips && (card.hiddenAncestors > 0 || card.canFold)) {
        const half = this.paint(card).chipW / 2 + 3;
        if (Math.abs(wx - (card.x + NODE_W / 2)) <= half && Math.abs(wy - card.y) <= CHIP_H / 2 + 3) {
          return { card, chip: true };
        }
      }
      if (wx >= card.x && wx <= card.x + NODE_W && wy >= card.y) return { card, chip: false };
    }
    return null;
  }

  private onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    cancelAnimationFrame(this.anim);
    this.canvas.setPointerCapture(e.pointerId);
    const p = this.local(e);
    this.pointers.set(e.pointerId, p);
    if (this.pointers.size === 1) {
      this.dragStart = p;
      this.dragged = false;
    } else {
      this.dragged = true;
      this.pinchDist = 0;
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    const p = this.local(e);
    const prev = this.pointers.get(e.pointerId);
    if (!prev) {
      const hit = this.hitTest(p.x, p.y);
      if (hit?.card !== this.hover?.card || hit?.chip !== this.hover?.chip) {
        this.hover = hit;
        this.canvas.style.cursor = hit ? "pointer" : "grab";
        this.requestDraw();
      }
      return;
    }
    this.pointers.set(e.pointerId, p);
    if (this.pointers.size === 1) {
      if (!this.dragged && this.dragStart) {
        if (Math.hypot(p.x - this.dragStart.x, p.y - this.dragStart.y) < 4) return;
        this.dragged = true;
        this.canvas.style.cursor = "grabbing";
        this.view.x += p.x - this.dragStart.x;
        this.view.y += p.y - this.dragStart.y;
      } else {
        this.view.x += p.x - prev.x;
        this.view.y += p.y - prev.y;
      }
      this.requestDraw();
    } else if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      this.view.x += (p.x - prev.x) / 2;
      this.view.y += (p.y - prev.y) / 2;
      if (this.pinchDist) this.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, dist / this.pinchDist);
      this.pinchDist = dist;
      this.requestDraw();
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    if (!this.pointers.delete(e.pointerId)) return;
    this.pinchDist = 0;
    if (this.pointers.size > 0) return;
    this.canvas.style.cursor = this.hover ? "pointer" : "grab";
    if (this.dragged) return;
    const p = this.local(e);
    const hit = this.hitTest(p.x, p.y);
    if (!hit) this.handlers.onPaneClick();
    else if (hit.chip) {
      this.anchorId = hit.card.id;
      this.handlers.onToggleFold(hit.card.id);
    } else {
      this.handlers.onPersonClick(hit.card.id, e.ctrlKey || e.metaKey || e.shiftKey);
    }
  };

  private onPointerCancel = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    this.pinchDist = 0;
  };

  private onPointerLeave = () => {
    if (this.hover && this.pointers.size === 0) {
      this.hover = null;
      this.requestDraw();
    }
  };

  private onDoubleClick = (e: MouseEvent) => {
    const p = this.local(e);
    const hit = this.hitTest(p.x, p.y);
    if (hit && !hit.chip) this.handlers.onPersonDoubleClick(hit.card.id);
  };

  private onContextMenu = (e: MouseEvent) => {
    const p = this.local(e);
    const hit = this.hitTest(p.x, p.y);
    if (!hit) return;
    e.preventDefault();
    this.handlers.onPersonContextMenu(hit.card.id, e.clientX, e.clientY);
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    cancelAnimationFrame(this.anim);
    const p = this.local(e);
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.h : 1;
    // ctrl + wheel is how browsers report a trackpad pinch
    const speed = e.ctrlKey ? 0.01 : 0.0018;
    this.zoomAt(p.x, p.y, Math.exp(-e.deltaY * unit * speed));
  };

  private onMiniPointer = (e: PointerEvent) => {
    if (!this.mini || !(e.buttons & 1)) return;
    if (e.type === "pointerdown") this.mini.setPointerCapture(e.pointerId);
    cancelAnimationFrame(this.anim);
    const r = this.mini.getBoundingClientRect();
    const m = this.miniTransform(r.width, r.height);
    if (!m) return;
    this.view.x = this.w / 2 - ((e.clientX - r.left - m.ox) / m.s) * this.view.k;
    this.view.y = this.h / 2 - ((e.clientY - r.top - m.oy) / m.s) * this.view.k;
    this.requestDraw();
  };

  private onFontsLoaded = () => {
    this.paints = new WeakMap();
    this.tagWidths = new WeakMap();
    this.requestDraw();
  };

  // ── Painting ─────────────────────────────────────────────────────

  private requestDraw() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => this.draw());
  }

  private palette(gender?: string): [string, string] {
    const c = this.colors;
    if (gender === "male") return [c.male, c["male-tint"]];
    if (gender === "female") return [c.female, c["female-tint"]];
    if (gender === "other") return [c.gold, c["gold-tint"]];
    return [c.neutral, c["neutral-tint"]];
  }

  private reviewColor(card: PersonCard): string | null {
    if (!card.review) return null;
    if (card.review === "updated") return this.colors.forest;
    if (card.review === "conflict") return this.colors.danger;
    return this.colors.gold;
  }

  private ellipsize(text: string, maxW: number): string {
    const ctx = this.ctx;
    if (ctx.measureText(text).width <= maxW) return text;
    let lo = 0;
    let hi = text.length;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (ctx.measureText(text.slice(0, mid).trimEnd() + "…").width <= maxW) lo = mid;
      else hi = mid - 1;
    }
    return text.slice(0, lo).trimEnd() + "…";
  }

  /** Text of a card, measured once and kept until the layout or the fonts change. */
  private paint(card: PersonCard): CardPaint {
    const cached = this.paints.get(card);
    if (cached) return cached;

    const ctx = this.ctx;
    const c = this.colors;
    const { serif, sans } = this.fonts;
    const maxW = NODE_W - PAD_X * 2;
    const rows: { text: string; font: string; color: string; h: number; gap: number }[] = [];

    const nameFont = `600 15px ${serif}`;
    ctx.font = nameFont;
    if (card.maiden || ctx.measureText(card.name).width <= maxW) {
      rows.push({ text: this.ellipsize(card.name, maxW), font: nameFont, color: c.ink, h: 19, gap: 0 });
    } else {
      // wrap on two lines
      const words = card.name.split(" ");
      let first = words[0];
      let i = 1;
      while (i < words.length && ctx.measureText(`${first} ${words[i]}`).width <= maxW) {
        first += ` ${words[i++]}`;
      }
      rows.push({ text: this.ellipsize(first, maxW), font: nameFont, color: c.ink, h: 19, gap: 0 });
      const rest = words.slice(i).join(" ");
      if (rest) rows.push({ text: this.ellipsize(rest, maxW), font: nameFont, color: c.ink, h: 19, gap: 0 });
    }
    if (card.maiden) {
      const font = `italic 400 14px ${serif}`;
      ctx.font = font;
      rows.push({ text: this.ellipsize(`née ${card.maiden}`, maxW), font, color: c["ink-soft"], h: 18, gap: 0 });
    }
    if (card.lifespan) {
      rows.push({ text: card.lifespan, font: `600 11px ${sans}`, color: this.palette(card.gender)[0], h: 16, gap: 3 });
    }
    if (card.birthPlace) {
      const font = `10.5px ${sans}`;
      ctx.font = font;
      rows.push({ text: this.ellipsize(card.birthPlace, maxW), font, color: c["ink-faint"], h: 15, gap: 2 });
    }

    const portrait = card.person.photo ? PORTRAIT + 6 : 0;
    const total = portrait + rows.reduce((sum, r) => sum + r.h + r.gap, 0);
    let y = 3 + (card.h - 3 - total) / 2;
    const result: CardPaint = { lines: [], chipW: CHIP_H };
    if (portrait) {
      result.portraitY = y;
      y += portrait;
    }
    for (const r of rows) {
      y += r.gap;
      result.lines.push({ text: r.text, font: r.font, color: r.color, dy: y + r.h / 2 });
      y += r.h;
    }
    if (card.hiddenAncestors > 0) {
      result.chipText = `▲ ${card.hiddenAncestors}`;
      ctx.font = `600 11px ${sans}`;
      result.chipW = Math.ceil(ctx.measureText(result.chipText).width) + 16;
    }
    this.paints.set(card, result);
    return result;
  }

  private image(src: string): HTMLImageElement | null {
    let img = this.images.get(src);
    if (!img) {
      img = new Image();
      img.onload = () => this.requestDraw();
      img.src = src;
      this.images.set(src, img);
    }
    return img.complete && img.naturalWidth > 0 ? img : null;
  }

  private draw() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    const { ctx, w, h, dpr, layout, colors: c } = this;
    const { x, y, k } = this.view;
    if (!w || !h) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * x, dpr * y);

    const full = k >= LOD_ZOOM;
    const margin = 24;
    const x0 = -x / k - margin;
    const y0 = -y / k - margin;
    const x1 = (w - x) / k + margin;
    const y1 = (h - y) / k + margin;

    // links: only those crossing the viewport, one stroke per kind
    ctx.lineWidth = Math.max(1.8, 0.5 / k);
    ctx.strokeStyle = "#b79f76";
    this.strokeLinks(layout.lineageLinks, 12, x0, y0, x1, y1);
    ctx.strokeStyle = c.wine;
    if (full) ctx.setLineDash([5, 3]);
    this.strokeLinks(layout.unionLinks, 6, x0, y0, x1, y1);
    ctx.setLineDash([]);

    // union knots
    ctx.beginPath();
    for (const u of layout.unions) {
      if (u.x < x0 || u.x > x1 || u.y < y0 || u.y > y1) continue;
      ctx.moveTo(u.x + UNION_R, u.y);
      ctx.arc(u.x, u.y, UNION_R, 0, Math.PI * 2);
    }
    ctx.fillStyle = c["card-raised"];
    ctx.fill();
    ctx.lineWidth = Math.max(2, 1 / k);
    ctx.stroke();

    if (full) {
      for (const card of layout.cards) {
        if (card.x > x1 || card.x + NODE_W < x0 || card.y > y1 || card.y + card.h < y0) continue;
        this.drawCard(card);
      }
      this.drawTags(x0, y0, x1, y1);
    } else {
      for (const card of layout.cards) {
        if (card.x > x1 || card.x + NODE_W < x0 || card.y > y1 || card.y + card.h < y0) continue;
        this.drawBlock(card);
      }
    }

    this.drawMini();
  }

  private strokeLinks(links: Link[], radius: number, x0: number, y0: number, x1: number, y1: number) {
    const ctx = this.ctx;
    ctx.beginPath();
    for (const [ax, ay, bx, by] of links) {
      if (by < y0 || ay > y1 || Math.max(ax, bx) < x0 || Math.min(ax, bx) > x1) continue;
      ctx.moveTo(ax, ay);
      if (Math.abs(bx - ax) >= 1) {
        const mid = (ay + by) / 2;
        const r = Math.min(radius, Math.abs(bx - ax) / 2, Math.abs(mid - ay));
        ctx.arcTo(ax, mid, bx, mid, r);
        ctx.arcTo(bx, mid, bx, by, r);
      }
      ctx.lineTo(bx, by);
    }
    ctx.stroke();
  }

  private drawBlock(card: PersonCard) {
    const ctx = this.ctx;
    const [accent, tint] = this.palette(card.gender);
    const review = this.reviewColor(card);
    if (this.selected.has(card.id)) {
      ctx.fillStyle = this.colors.ink;
      ctx.fillRect(card.x - 14, card.y - 14, NODE_W + 28, card.h + 28);
    } else if (review) {
      ctx.fillStyle = review;
      ctx.fillRect(card.x - 7, card.y - 7, NODE_W + 14, card.h + 14);
    }
    ctx.fillStyle = tint;
    ctx.fillRect(card.x, card.y, NODE_W, card.h);
    ctx.fillStyle = accent;
    ctx.fillRect(card.x, card.y, NODE_W, 16);
  }

  private drawCard(card: PersonCard) {
    const ctx = this.ctx;
    const c = this.colors;
    const { x, y, h } = card;
    const [accent, tint] = this.palette(card.gender);
    const review = this.reviewColor(card);
    const selected = this.selected.has(card.id);
    const hovered = this.hover?.card === card;
    const ring = (offset: number, color: string, alpha = 1) => {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x - offset, y - offset, NODE_W + offset * 2, h + offset * 2, CARD_R + offset);
      ctx.fill();
      ctx.globalAlpha = 1;
    };

    if (review) {
      ring(9, review, 0.22);
      ring(3, review);
    }
    if (selected) {
      if (!review) ring(7, tint);
      ring(3, accent);
    }
    if (card.uncertain) {
      ctx.strokeStyle = review ?? c.gold;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.roundRect(x - 7, y - 7, NODE_W + 14, h + 14, CARD_R + 7);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // body, with the accent band along the top edge
    const bg = card.deceased ? c.card : c["card-raised"];
    ctx.beginPath();
    ctx.roundRect(x, y, NODE_W, h, CARD_R);
    ctx.fillStyle = accent;
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(x, y + 3, NODE_W, h - 3, [0, 0, CARD_R, CARD_R]);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(x + 0.5, y + 0.5, NODE_W - 1, h - 1, CARD_R);
    ctx.lineWidth = 1;
    ctx.strokeStyle = selected ? accent : hovered ? c["ink-faint"] : c["line-strong"];
    ctx.stroke();

    const paint = this.paint(card);
    const cx = x + NODE_W / 2;

    if (paint.portraitY !== undefined && card.person.photo) {
      const img = this.image(card.person.photo);
      const py = y + paint.portraitY;
      ctx.beginPath();
      ctx.arc(cx, py + PORTRAIT / 2, PORTRAIT / 2, 0, Math.PI * 2);
      ctx.fillStyle = tint;
      ctx.fill();
      if (img) {
        // object-fit: cover
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        ctx.save();
        ctx.clip();
        ctx.drawImage(
          img,
          (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side,
          cx - PORTRAIT / 2, py, PORTRAIT, PORTRAIT
        );
        ctx.restore();
      }
      ctx.lineWidth = 2;
      ctx.strokeStyle = tint;
      ctx.stroke();
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const line of paint.lines) {
      ctx.font = line.font;
      ctx.fillStyle = line.color;
      ctx.fillText(line.text, cx, y + line.dy);
    }

    if (review) {
      const bx = x + NODE_W - 1;
      const by = y + 1;
      ctx.beginPath();
      ctx.arc(bx, by, 11, 0, Math.PI * 2);
      ctx.fillStyle = review;
      ctx.fill();
      ctx.font = `700 12px ${this.fonts.sans}`;
      ctx.fillStyle = "#fff";
      ctx.fillText(card.review === "new" ? "✦" : card.review === "updated" ? "✎" : "!", bx, by + 0.5);
    }

    // fold chip, where the line to the parents enters the card
    if (paint.chipText || card.canFold) {
      const chipHover = hovered && this.hover!.chip;
      const cw = paint.chipW;
      ctx.beginPath();
      ctx.roundRect(cx - cw / 2, y - CHIP_H / 2, cw, CHIP_H, CHIP_H / 2);
      ctx.fillStyle = chipHover ? c["forest-tint"] : paint.chipText ? c["gold-tint"] : c["card-raised"];
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = chipHover ? c.forest : paint.chipText ? c.gold : c["line-strong"];
      ctx.stroke();
      if (paint.chipText) {
        ctx.font = `600 11px ${this.fonts.sans}`;
        ctx.fillStyle = c.ink;
        ctx.fillText(paint.chipText, cx, y + 0.5);
      } else {
        ctx.fillStyle = chipHover ? c.forest : c["ink-soft"];
        ctx.fillRect(cx - 4, y - 0.75, 8, 1.5);
      }
    }
  }

  private drawTags(x0: number, y0: number, x1: number, y1: number) {
    const ctx = this.ctx;
    const c = this.colors;
    const font = `10px ${this.fonts.sans}`;
    const lineH = 13.5;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 1;
    for (const u of this.layout.unions) {
      if (!u.tag || u.y < y0 || u.y > y1 || u.x < x0 - 200 || u.x > x1 + 200) continue;
      ctx.font = font;
      let tw = this.tagWidths.get(u);
      if (tw === undefined) {
        tw = Math.ceil(Math.max(...u.tag.map((t) => ctx.measureText(t).width))) + 16;
        this.tagWidths.set(u, tw);
      }
      const th = u.tag.length * lineH + 6;
      ctx.beginPath();
      ctx.roundRect(u.x - tw / 2, u.y - th / 2, tw, th, CARD_R);
      ctx.fillStyle = c["card-raised"];
      ctx.fill();
      ctx.strokeStyle = "#dcae9f";
      ctx.stroke();
      ctx.fillStyle = c["wine-dark"];
      u.tag.forEach((t, i) => {
        ctx.fillText(t, u.x, u.y - th / 2 + 3 + lineH * (i + 0.5));
      });
    }
  }

  // ── Minimap ──────────────────────────────────────────────────────

  private miniTransform(mw: number, mh: number) {
    const { width, height } = this.layout;
    if (!width || !height) return null;
    const pad = 6;
    const s = Math.min((mw - pad * 2) / width, (mh - pad * 2) / height);
    return { s, ox: (mw - width * s) / 2, oy: (mh - height * s) / 2 };
  }

  private drawMini() {
    const mini = this.mini;
    if (!mini) return;
    const mw = mini.clientWidth;
    const mh = mini.clientHeight;
    if (!mw || !mh) return;
    if (mini.width !== Math.round(mw * this.dpr)) {
      mini.width = Math.round(mw * this.dpr);
      mini.height = Math.round(mh * this.dpr);
    }
    const ctx = mini.getContext("2d")!;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, mw, mh);
    const m = this.miniTransform(mw, mh);
    if (!m) return;
    const { s, ox, oy } = m;
    for (const card of this.layout.cards) {
      ctx.fillStyle = this.selected.has(card.id)
        ? this.colors.ink
        : this.reviewColor(card) ?? this.palette(card.gender)[0];
      ctx.fillRect(
        ox + card.x * s,
        oy + card.y * s,
        Math.max(NODE_W * s, 1.5),
        Math.max(card.h * s, 1.5)
      );
    }
    // viewport
    const { x, y, k } = this.view;
    const vx = Math.max(ox + (-x / k) * s, 0);
    const vy = Math.max(oy + (-y / k) * s, 0);
    const vr = Math.min(ox + ((this.w - x) / k) * s, mw);
    const vb = Math.min(oy + ((this.h - y) / k) * s, mh);
    if (vr > vx && vb > vy) {
      ctx.fillStyle = "rgba(63, 107, 76, 0.14)";
      ctx.fillRect(vx, vy, vr - vx, vb - vy);
      ctx.strokeStyle = this.colors.forest;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(vx + 0.75, vy + 0.75, Math.max(vr - vx - 1.5, 1), Math.max(vb - vy - 1.5, 1));
    }
  }
}
