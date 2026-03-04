import type { ScanEvent } from "@/types/scan";

// ── SSE subscriber store ──────────────────────────────────────────────────────
// Keeps an in-memory buffer of events per scanId and notifies live SSE listeners.

const EVENT_BUFFER_SIZE = 100;

interface ScanStore {
  events: ScanEvent[];
  subscribers: Set<(event: ScanEvent) => void>;
  done: boolean;
}

const store = new Map<string, ScanStore>();

function getOrCreate(scanId: string): ScanStore {
  if (!store.has(scanId)) {
    store.set(scanId, { events: [], subscribers: new Set(), done: false });
  }
  return store.get(scanId)!;
}

export function emitScanEvent(scanId: string, event: ScanEvent): void {
  const s = getOrCreate(scanId);
  s.events.push(event);

  // Trim buffer
  if (s.events.length > EVENT_BUFFER_SIZE) {
    s.events.splice(0, s.events.length - EVENT_BUFFER_SIZE);
  }

  if (event.event === "complete" || event.event === "error") {
    s.done = true;
  }

  for (const sub of s.subscribers) {
    sub(event);
  }
}

export function subscribeScan(
  scanId: string,
  onEvent: (event: ScanEvent) => void,
): { bufferedEvents: ScanEvent[]; unsubscribe: () => void } {
  const s = getOrCreate(scanId);
  s.subscribers.add(onEvent);

  return {
    bufferedEvents: [...s.events],
    unsubscribe: () => {
      s.subscribers.delete(onEvent);
    },
  };
}

export function isScanDone(scanId: string): boolean {
  return store.get(scanId)?.done ?? false;
}

export function cleanupScan(scanId: string): void {
  // Keep scan data for 30 minutes after completion, then GC
  setTimeout(
    () => {
      store.delete(scanId);
    },
    30 * 60 * 1000,
  );
}
