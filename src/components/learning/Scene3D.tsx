"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Move3d, Pause, Play, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import type { SceneSpec, Vec3 } from "@/lib/learning3d/scene";

/** Small enough for a school laptop: no WebGL, no shaders, no assets to load. */
const FOCAL = 15;
const UNIT = 42;
const DISTANCE = 17;

type View = { yaw: number; pitch: number; zoom: number; auto: boolean };
type Projected = { x: number; y: number; s: number; depth: number };

const MOTION_QUERY = "(prefers-reduced-motion: reduce)";
function subscribeMotion(callback: () => void) {
  const query = window.matchMedia(MOTION_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
function getMotionSnapshot() {
  return window.matchMedia(MOTION_QUERY).matches;
}
function getMotionServerSnapshot() {
  return false;
}

function rotate(p: Vec3, yaw: number, pitch: number): Vec3 {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const x = p[0] * cy + p[2] * sy;
  const z1 = -p[0] * sy + p[2] * cy;
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  return [x, p[1] * cp - z1 * sp, p[1] * sp + z1 * cp];
}

function project(p: Vec3, view: View, w: number, h: number): Projected {
  const r = rotate(p, view.yaw, view.pitch);
  const depth = r[2] + DISTANCE;
  const perspective = (FOCAL / Math.max(3, depth)) * view.zoom;
  return { x: w / 2 + r[0] * UNIT * perspective, y: h * 0.55 - r[1] * UNIT * perspective, s: perspective, depth };
}

function shade(hex: string, factor: number): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return hex;
  const n = parseInt(clean, 16);
  const channel = (shift: number) => Math.min(255, Math.max(0, Math.round(((n >> shift) & 255) * factor)));
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
}

type Command = { depth: number; paint: () => void };

export function Scene3D({ spec, className }: { spec: SceneSpec; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const specRef = useRef(spec);
  const viewRef = useRef<View>({ yaw: -0.55, pitch: 0.28, zoom: 1, auto: true });
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const [manualAuto, setManualAuto] = useState<boolean | null>(null);
  const [hint, setHint] = useState(false);
  const reducedMotion = useSyncExternalStore(subscribeMotion, getMotionSnapshot, getMotionServerSnapshot);
  const auto = manualAuto ?? !reducedMotion;

  useEffect(() => {
    specRef.current = spec;
  }, [spec]);

  // The animation loop reads a ref; keep it in step with the React value.
  useEffect(() => {
    viewRef.current.auto = auto;
  }, [auto]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let frame = 0;
    let width = 0;
    let height = 0;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);

    const draw = () => {
      const view = viewRef.current;
      if (view.auto && !dragRef.current) view.yaw += 0.0025;
      ctx.clearRect(0, 0, width, height);

      // A receding grid is the cheapest way to make rotation legible.
      for (let i = -6; i <= 6; i++) {
        for (const [from, to] of [
          [[i, -2.9, -6], [i, -2.9, 6]] as [Vec3, Vec3],
          [[-6, -2.9, i], [6, -2.9, i]] as [Vec3, Vec3],
        ]) {
          const a = project(from, view, width, height);
          const b = project(to, view, width, height);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = i === 0 ? "rgba(99,102,241,0.24)" : "rgba(99,102,241,0.10)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      const commands: Command[] = [];
      for (const obj of specRef.current.objects) {
        if (obj.kind === "box") {
          const [x, y, z] = obj.pos;
          const [hx, hy, hz] = [obj.size[0] / 2, obj.size[1] / 2, obj.size[2] / 2];
          const corners: Vec3[] = [
            [x - hx, y - hy, z - hz], [x + hx, y - hy, z - hz], [x + hx, y + hy, z - hz], [x - hx, y + hy, z - hz],
            [x - hx, y - hy, z + hz], [x + hx, y - hy, z + hz], [x + hx, y + hy, z + hz], [x - hx, y + hy, z + hz],
          ];
          const projected = corners.map((c) => project(c, view, width, height));
          const faces: { ids: number[]; light: number; top?: string }[] = [
            { ids: [0, 1, 2, 3], light: 0.55 },
            { ids: [4, 5, 6, 7], light: 1 },
            { ids: [0, 4, 7, 3], light: 0.76 },
            { ids: [1, 5, 6, 2], light: 0.86 },
            { ids: [3, 2, 6, 7], light: 1.18, top: obj.top },
            { ids: [0, 1, 5, 4], light: 0.5 },
          ];
          for (const face of faces) {
            const pts = face.ids.map((i) => projected[i]!);
            const depth = pts.reduce((sum, p) => sum + p.depth, 0) / pts.length;
            commands.push({
              depth,
              paint: () => {
                ctx.save();
                ctx.globalAlpha = obj.opacity ?? 1;
                if (obj.glow) {
                  ctx.shadowColor = obj.color;
                  ctx.shadowBlur = 18 * obj.glow;
                }
                ctx.beginPath();
                ctx.moveTo(pts[0]!.x, pts[0]!.y);
                for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
                ctx.closePath();
                ctx.fillStyle = shade(face.top ?? obj.color, face.light);
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.strokeStyle = "rgba(226,232,240,0.18)";
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.restore();
              },
            });
          }
          if (obj.face) {
            const front = [4, 5, 6, 7].map((i) => projected[i]!);
            const depth = front.reduce((sum, p) => sum + p.depth, 0) / 4;
            const cx = front.reduce((sum, p) => sum + p.x, 0) / 4;
            const cy = front.reduce((sum, p) => sum + p.y, 0) / 4;
            const font = Math.max(9, Math.min(34, (obj.size[0] / 2) * UNIT * front[0]!.s * 0.62));
            commands.push({
              depth: depth - 0.02,
              paint: () => {
                ctx.save();
                ctx.font = `700 ${font}px "JetBrains Mono", monospace`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillStyle = "rgba(8,12,24,0.86)";
                ctx.fillText(obj.face ?? "", cx, cy, font * (obj.face?.length ?? 1) * 0.78);
                ctx.restore();
              },
            });
          }
        } else if (obj.kind === "text") {
          const p = project(obj.pos, view, width, height);
          const font = Math.max(9, Math.min(38, (obj.size ?? 0.4) * UNIT * p.s));
          commands.push({
            depth: p.depth,
            paint: () => {
              ctx.save();
              ctx.font = `${obj.bold ? 700 : 500} ${font}px "Inter", system-ui, sans-serif`;
              ctx.textAlign = obj.align ?? "center";
              ctx.textBaseline = "middle";
              ctx.fillStyle = obj.color ?? "#e2e8f0";
              ctx.fillText(obj.text, p.x, p.y);
              ctx.restore();
            },
          });
        } else if (obj.kind === "line") {
          const a = project(obj.from, view, width, height);
          const b = project(obj.to, view, width, height);
          commands.push({
            depth: (a.depth + b.depth) / 2,
            paint: () => {
              ctx.save();
              ctx.beginPath();
              ctx.setLineDash(obj.dashed ? [6, 6] : []);
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.strokeStyle = obj.color ?? "rgba(99,102,241,0.4)";
              ctx.lineWidth = Math.max(1, (obj.width ?? 1.6) * (a.s + b.s) / 2);
              ctx.stroke();
              ctx.restore();
            },
          });
        } else {
          const p = project(obj.pos, view, width, height);
          commands.push({
            depth: p.depth,
            paint: () => {
              ctx.save();
              ctx.globalAlpha = obj.opacity ?? 1;
              ctx.beginPath();
              ctx.ellipse(p.x, p.y, obj.radius * UNIT * p.s, obj.radius * UNIT * p.s * 0.55, 0, 0, Math.PI * 2);
              ctx.fillStyle = obj.color;
              ctx.fill();
              ctx.restore();
            },
          });
        }
      }
      // Painter's algorithm: farthest first, nearest last.
      commands.sort((a, b) => b.depth - a.depth);
      for (const command of commands) command.paint();
      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  const toggleAuto = () => setManualAuto(!auto);

  return (
    <div ref={wrapRef} className={`relative overflow-hidden rounded-2xl ${className ?? ""}`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(99,102,241,0.16),transparent_60%)]" />
      <canvas
        ref={canvasRef}
        className="relative h-full w-full touch-none cursor-grab active:cursor-grabbing"
        aria-label={`3D model: ${spec.caption ?? "interactive scene"}`}
        onPointerDown={(e) => {
          dragRef.current = { x: e.clientX, y: e.clientY };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const drag = dragRef.current;
          if (!drag) return;
          viewRef.current.yaw += (e.clientX - drag.x) * 0.008;
          viewRef.current.pitch = Math.max(-0.9, Math.min(0.9, viewRef.current.pitch + (e.clientY - drag.y) * 0.006));
          dragRef.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={() => { dragRef.current = null; }}
        onPointerCancel={() => { dragRef.current = null; }}
        onDoubleClick={() => {
          viewRef.current = { yaw: -0.55, pitch: 0.28, zoom: 1, auto: viewRef.current.auto };
        }}
      />
      <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-xl border border-border/70 bg-background/80 p-1 backdrop-blur">
        <button type="button" aria-label="Rotate automatically" title="Auto-rotate" onClick={toggleAuto}
          className={`grid h-8 w-8 place-items-center rounded-lg transition-colors ${auto ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-secondary"}`}>
          {auto ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </button>
        <button type="button" aria-label="Reset view" title="Reset view"
          onClick={() => { viewRef.current.yaw = -0.55; viewRef.current.pitch = 0.28; viewRef.current.zoom = 1; }}
          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        <button type="button" aria-label="Zoom in" title="Zoom in"
          onClick={() => { viewRef.current.zoom = Math.min(1.8, viewRef.current.zoom + 0.15); }}
          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <button type="button" aria-label="Zoom out" title="Zoom out"
          onClick={() => { viewRef.current.zoom = Math.max(0.6, viewRef.current.zoom - 0.15); }}
          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
      </div>
      <button type="button" onClick={() => setHint((v) => !v)}
        className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-[11px] text-muted-foreground backdrop-blur transition-colors hover:text-foreground">
        <Move3d className="h-3.5 w-3.5" /> Drag to orbit
      </button>
      {hint && (
        <p className="absolute bottom-12 right-3 max-w-[240px] rounded-lg border border-border bg-card/95 px-3 py-2 text-[11px] text-muted-foreground">
          Drag to turn the model, double-click to reset, and use the buttons to zoom or pause the rotation.
        </p>
      )}
    </div>
  );
}
