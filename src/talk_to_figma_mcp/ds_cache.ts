// Design-System manifest disk cache.
//
// The design system (components + variables + styles) rarely changes between
// reads, so re-fetching and re-deriving the semantic manifest on every turn is
// pure token/time waste. This module persists a derived manifest to disk keyed
// by channel, guarded by a cheap fingerprint of the raw DS state. The manifest
// is rebuilt only when the fingerprint changes.
//
// All logging goes to stderr — stdout is reserved for the MCP protocol.

import { createHash } from "crypto";
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const CACHE_DIR = join(tmpdir(), "figma-ai-bridge", "ds-cache");

export type DSCacheEntry<T = unknown> = {
  fingerprint: string;
  manifest: T;
  builtAt: number;
};

function log(message: string): void {
  process.stderr.write(`[ds-cache] ${message}\n`);
}

function ensureDir(): void {
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
  } catch (error) {
    log(`failed to create cache dir: ${String(error)}`);
  }
}

// Sanitize a channel name into a safe filename component.
function safeKey(channel: string): string {
  return channel.replace(/[^a-zA-Z0-9_-]/g, "_") || "default";
}

function cachePath(channel: string): string {
  return join(CACHE_DIR, `${safeKey(channel)}.json`);
}

/**
 * Build a cheap, stable fingerprint of the raw design-system state. Two reads
 * that produce the same fingerprint are treated as the same DS, so the cached
 * manifest can be reused. Pass the raw results of get_local_components /
 * get_styles / get_variables (or any subset) — only their identity-bearing
 * fields need to be stable.
 */
export function fingerprintDS(parts: {
  components?: Array<{ id?: string; name?: string; key?: string | null }>;
  styles?: unknown;
  variables?: unknown;
}): string {
  const components = (parts.components ?? [])
    .map((c) => `${c.id ?? ""}:${c.name ?? ""}:${c.key ?? ""}`)
    .sort();
  const payload = JSON.stringify({
    components,
    styles: parts.styles ?? null,
    variables: parts.variables ?? null,
  });
  return createHash("sha1").update(payload).digest("hex");
}

/**
 * Read the cached manifest for a channel. Returns null when there is no cache
 * entry, or when `expectedFingerprint` is supplied and does not match (stale).
 */
export function readCache<T = unknown>(
  channel: string,
  expectedFingerprint?: string
): DSCacheEntry<T> | null {
  const path = cachePath(channel);
  if (!existsSync(path)) return null;
  try {
    const entry = JSON.parse(readFileSync(path, "utf8")) as DSCacheEntry<T>;
    if (expectedFingerprint && entry.fingerprint !== expectedFingerprint) {
      return null; // stale — caller should rebuild
    }
    return entry;
  } catch (error) {
    log(`failed to read cache for ${channel}: ${String(error)}`);
    return null;
  }
}

/** Persist a freshly built manifest for a channel under its fingerprint. */
export function writeCache<T = unknown>(
  channel: string,
  fingerprint: string,
  manifest: T
): void {
  ensureDir();
  const entry: DSCacheEntry<T> = {
    fingerprint,
    manifest,
    builtAt: Date.now(),
  };
  try {
    writeFileSync(cachePath(channel), JSON.stringify(entry), "utf8");
  } catch (error) {
    log(`failed to write cache for ${channel}: ${String(error)}`);
  }
}

/** Drop the cached manifest for a channel (e.g. after a known DS edit). */
export function invalidateCache(channel: string): void {
  try {
    rmSync(cachePath(channel), { force: true });
  } catch (error) {
    log(`failed to invalidate cache for ${channel}: ${String(error)}`);
  }
}
