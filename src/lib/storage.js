import { STORAGE_KEY, SCHEMA_VERSION } from '../config.js';
import { defaultStreak } from './streak.js';

export function defaultState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    activeProfileId: null,
    profiles: {},
  };
}

function defaultProfile(id, name) {
  return {
    id,
    name,
    createdAt: new Date().toISOString(),
    songs: [],
    history: [],
    bag: [],
    lastPlayedId: null,
    streak: defaultStreak(),
    playLog: [],
    lastDismissedRecapMonth: null,
    settings: { practicingWeight: 2 },
  };
}

function migrate(data) {
  if (!data || typeof data !== 'object') return defaultState();
  if (!data.schemaVersion) data.schemaVersion = 1;

  // Pre-profiles shape (fase 2/3): { songs, history, bag, lastPlayedId }
  // → wrap in a single default profile.
  if (data.songs && !data.profiles) {
    const id = 'p_default';
    data.profiles = {
      [id]: {
        id,
        name: 'Ik',
        createdAt: new Date().toISOString(),
        songs: Array.isArray(data.songs) ? data.songs : [],
        history: Array.isArray(data.history) ? data.history : [],
        bag: Array.isArray(data.bag) ? data.bag : [],
        lastPlayedId: data.lastPlayedId ?? null,
        settings: { practicingWeight: 2 },
      },
    };
    data.activeProfileId = id;
    delete data.songs;
    delete data.history;
    delete data.bag;
    delete data.lastPlayedId;
  }

  if (!data.profiles || typeof data.profiles !== 'object') data.profiles = {};
  if (data.activeProfileId === undefined) data.activeProfileId = null;

  // Heal individual profiles (defensive defaults).
  for (const p of Object.values(data.profiles)) {
    if (!Array.isArray(p.songs)) p.songs = [];
    if (!Array.isArray(p.history)) p.history = [];
    if (!Array.isArray(p.bag)) p.bag = [];
    if (p.lastPlayedId === undefined) p.lastPlayedId = null;
    if (!p.settings) p.settings = { practicingWeight: 2 };
    if (!p.createdAt) p.createdAt = new Date().toISOString();
    if (!p.streak) p.streak = defaultStreak();
    if (!Array.isArray(p.streak.history)) p.streak.history = [];
    if (!Array.isArray(p.playLog)) p.playLog = [];
    if (p.lastDismissedRecapMonth === undefined) p.lastDismissedRecapMonth = null;

    // Songs: vul missende velden voor pre-fase-7 data.
    for (const s of p.songs) {
      if (typeof s.playCount !== 'number') s.playCount = 0;
      if (typeof s.skipStreak !== 'number') s.skipStreak = 0;
    }
  }

  // If activeProfileId points to a non-existent profile, pick any existing one.
  if (data.activeProfileId && !data.profiles[data.activeProfileId]) {
    const keys = Object.keys(data.profiles);
    data.activeProfileId = keys[0] ?? null;
  }

  return data;
}

export function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return migrate(JSON.parse(raw));
  } catch (e) {
    console.warn('[storage] load failed, starting fresh:', e);
    return defaultState();
  }
}

export function save(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('[storage] save failed:', e);
  }
}

export { defaultProfile };
