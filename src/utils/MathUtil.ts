import { Vec2 } from "../types";

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function distance(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function length(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function normalize(v: Vec2): Vec2 {
  const len = length(v);
  if (len <= 0.0001) {
    return { x: 0, y: 0 };
  }
  return { x: v.x / len, y: v.y / len };
}

export function scale(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s };
}

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function randomInt(min: number, max: number): number {
  return Math.floor(randomRange(min, max + 1));
}

export function pickWeighted<T>(items: T[], weightFn: (item: T) => number): T | null {
  let total = 0;
  for (const item of items) {
    total += Math.max(0, weightFn(item));
  }
  if (total <= 0) {
    return items.length > 0 ? items[Math.floor(Math.random() * items.length)] : null;
  }
  let r = Math.random() * total;
  for (const item of items) {
    r -= Math.max(0, weightFn(item));
    if (r <= 0) {
      return item;
    }
  }
  return items.length > 0 ? items[items.length - 1] : null;
}
