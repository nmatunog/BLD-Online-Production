import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { CachedEventBundle, PendingCheckin } from './types';

/**
 * IndexedDB schema for the offline candidate check-in flow.
 * Keep migrations append-only and bump DB_VERSION when adding stores/indexes.
 */
const DB_NAME = 'bld-checkin-offline';
const DB_VERSION = 1;

interface CheckinDB extends DBSchema {
  /** Cached candidate list + sessions per event, used for offline search. */
  cachedEvents: {
    key: string; // eventId
    value: CachedEventBundle;
  };
  /** Check-ins queued locally, awaiting upload to the backend. */
  pendingCheckins: {
    key: string; // localId
    value: PendingCheckin;
    indexes: {
      'by-event': string;
      'by-event-session': [string, string];
    };
  };
  /** Successfully synced check-ins (kept so the UI can show ✓ chips after reload). */
  syncedCheckins: {
    key: string; // composite localId or `${eventId}:${candidateId}:${sessionSlot}`
    value: PendingCheckin;
    indexes: {
      'by-event-session': [string, string];
    };
  };
}

let dbPromise: Promise<IDBPDatabase<CheckinDB>> | null = null;

function getDB(): Promise<IDBPDatabase<CheckinDB>> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available in this environment.'));
  }
  if (!dbPromise) {
    dbPromise = openDB<CheckinDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('cachedEvents')) {
          db.createObjectStore('cachedEvents', { keyPath: 'eventId' });
        }
        if (!db.objectStoreNames.contains('pendingCheckins')) {
          const store = db.createObjectStore('pendingCheckins', { keyPath: 'localId' });
          store.createIndex('by-event', 'eventId');
          store.createIndex('by-event-session', ['eventId', 'sessionSlot']);
        }
        if (!db.objectStoreNames.contains('syncedCheckins')) {
          const store = db.createObjectStore('syncedCheckins', { keyPath: 'localId' });
          store.createIndex('by-event-session', ['eventId', 'sessionSlot']);
        }
      },
    });
  }
  return dbPromise;
}

// ---------- Cached events ----------

export async function saveCachedEvent(bundle: CachedEventBundle): Promise<void> {
  const db = await getDB();
  await db.put('cachedEvents', bundle);
}

export async function loadCachedEvent(eventId: string): Promise<CachedEventBundle | undefined> {
  const db = await getDB();
  return db.get('cachedEvents', eventId);
}

export async function listCachedEventIds(): Promise<string[]> {
  const db = await getDB();
  return db.getAllKeys('cachedEvents') as Promise<string[]>;
}

export async function deleteCachedEvent(eventId: string): Promise<void> {
  const db = await getDB();
  await db.delete('cachedEvents', eventId);
}

// ---------- Pending check-ins ----------

export async function enqueueCheckin(item: PendingCheckin): Promise<void> {
  const db = await getDB();
  await db.put('pendingCheckins', item);
}

export async function listPendingCheckins(eventId?: string): Promise<PendingCheckin[]> {
  const db = await getDB();
  if (eventId) {
    return db.getAllFromIndex('pendingCheckins', 'by-event', eventId);
  }
  return db.getAll('pendingCheckins');
}

export async function listPendingForSession(
  eventId: string,
  sessionSlot: string,
): Promise<PendingCheckin[]> {
  const db = await getDB();
  return db.getAllFromIndex('pendingCheckins', 'by-event-session', [eventId, sessionSlot]);
}

export async function getPendingCheckin(localId: string): Promise<PendingCheckin | undefined> {
  const db = await getDB();
  return db.get('pendingCheckins', localId);
}

export async function updatePendingCheckin(item: PendingCheckin): Promise<void> {
  const db = await getDB();
  await db.put('pendingCheckins', item);
}

export async function deletePendingCheckin(localId: string): Promise<void> {
  const db = await getDB();
  await db.delete('pendingCheckins', localId);
}

// ---------- Synced (history) check-ins ----------

export async function recordSyncedCheckin(item: PendingCheckin): Promise<void> {
  const db = await getDB();
  await db.put('syncedCheckins', item);
}

export async function listSyncedForSession(
  eventId: string,
  sessionSlot: string,
): Promise<PendingCheckin[]> {
  const db = await getDB();
  return db.getAllFromIndex('syncedCheckins', 'by-event-session', [eventId, sessionSlot]);
}

export async function listSyncedForEvent(eventId: string): Promise<PendingCheckin[]> {
  const db = await getDB();
  const all = await db.getAll('syncedCheckins');
  return all.filter((row) => row.eventId === eventId);
}

// ---------- Helpers ----------

export function generateLocalId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return (crypto as { randomUUID: () => string }).randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
