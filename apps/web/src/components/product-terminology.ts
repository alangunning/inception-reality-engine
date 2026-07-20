import type { Reality } from "@inception/domain";

function matchCase(match: string, replacement: string): string {
  if (match === match.toUpperCase()) return replacement.toUpperCase();
  if (match[0] === match[0]?.toUpperCase()) {
    return `${replacement[0]?.toUpperCase() ?? ""}${replacement.slice(1)}`;
  }
  return replacement;
}

export function canonicalProductCopy(value: string): string {
  return value
    .replace(/\bstabilization\b/gi, (match) => matchCase(match, "stabilisation"))
    .replace(/\bstabilizing\b/gi, (match) => matchCase(match, "stabilising"))
    .replace(/\bstabilized\b/gi, (match) => matchCase(match, "stabilised"))
    .replace(/\bstabilizes\b/gi, (match) => matchCase(match, "stabilises"))
    .replace(/\bstabilize\b/gi, (match) => matchCase(match, "stabilise"));
}

export function productEventLabel(eventType: string, stage?: string): string {
  const label = canonicalProductCopy(stage ?? eventType.replace(".", " / "));
  return label.replace(/^wake(?=\s*\/|\b)/i, "memory");
}

export function canonicalProductValue(value: unknown): unknown {
  if (typeof value === "string") return canonicalProductCopy(value);
  if (Array.isArray(value)) return value.map(canonicalProductValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, canonicalProductValue(entry)])
  );
}

export function realityDisplayName(reality: Pick<Reality, "name">): string {
  return canonicalProductCopy(reality.name);
}
