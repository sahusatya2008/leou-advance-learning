import { compare, hash } from "bcryptjs";

export function hashPassword(plain: string) {
  return hash(plain, 12);
}

export function verifyPassword(plain: string, hashed: string) {
  return compare(plain, hashed);
}

// Lightweight server-side shape checks applied to everything client submits.
export function isValidUsername(u: unknown): u is string {
  return typeof u === "string" && /^[a-zA-Z0-9_.]{4,32}$/.test(u);
}

export function isValidPassword(p: unknown): p is string {
  return typeof p === "string" && p.length >= 8;
}

export function isValidEmail(e: unknown): e is string {
  return typeof e === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}