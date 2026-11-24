/**
 * Tiny, dependency-free 3D scene language for the learning stage.
 *
 * The course is made of objects in a right-handed world: x runs left→right,
 * y runs bottom→top and z runs away from the viewer. `Scene3D` projects these
 * objects with a yaw/pitch camera and a simple perspective divide, then paints
 * them back-to-front. Keeping the scene data as plain objects (rather than a
 * WebGL dependency) means the lessons work on every school laptop, even where
 * WebGL is disabled, and adds nothing to the app's dependency tree.
 */
export type Vec3 = readonly [number, number, number];

export type BoxObject = {
  id: string;
  kind: "box";
  pos: Vec3;
  size: Vec3;
  color: string;
  /** Optional contrasting colour for the top face. */
  top?: string;
  /** 0..1 — adds a halo, used for a bit that is ON. */
  glow?: number;
  opacity?: number;
  /** Text painted on the front face of the box. */
  face?: string;
};

export type TextObject = {
  id: string;
  kind: "text";
  pos: Vec3;
  text: string;
  color?: string;
  /** World units; the renderer scales it with perspective. */
  size?: number;
  bold?: boolean;
  align?: "center" | "left" | "right";
};

export type LineObject = {
  id: string;
  kind: "line";
  from: Vec3;
  to: Vec3;
  color?: string;
  width?: number;
  dashed?: boolean;
};

export type DiscObject = {
  id: string;
  kind: "disc";
  pos: Vec3;
  radius: number;
  color: string;
  opacity?: number;
};

export type SceneObject = BoxObject | TextObject | LineObject | DiscObject;

export type SceneSpec = {
  objects: SceneObject[];
  /** A receding floor grid makes the depth of the objects readable. */
  floor?: boolean;
  /** One-line orientation hint shown under the stage. */
  caption?: string;
};

export const box = (
  id: string,
  pos: Vec3,
  size: Vec3,
  color: string,
  extra: Partial<Omit<BoxObject, "id" | "kind" | "pos" | "size" | "color">> = {},
): BoxObject => ({ id, kind: "box", pos, size, color, ...extra });

export const text = (
  id: string,
  pos: Vec3,
  label: string,
  extra: Partial<Omit<TextObject, "id" | "kind" | "pos" | "text">> = {},
): TextObject => ({ id, kind: "text", pos, text: label, ...extra });

export const line = (
  id: string,
  from: Vec3,
  to: Vec3,
  extra: Partial<Omit<LineObject, "id" | "kind" | "from" | "to">> = {},
): LineObject => ({ id, kind: "line", from, to, ...extra });

export const disc = (
  id: string,
  pos: Vec3,
  radius: number,
  color: string,
  opacity = 1,
): DiscObject => ({ id, kind: "disc", pos, radius, color, opacity });

/** Palette shared by every scene so one lesson looks like the next. */
export const COLORS = {
  on: "#22d3ee",
  onTop: "#a5f3fc",
  off: "#26324f",
  offTop: "#354260",
  digit: "#818cf8",
  digitTop: "#c7d2fe",
  warm: "#fbbf24",
  warmTop: "#fde68a",
  sign: "#fb7185",
  signTop: "#fecdd3",
  dim: "#64748b",
  ok: "#34d399",
  ink: "#e2e8f0",
  faint: "#94a3b8",
  guide: "#3b4a73",
};
