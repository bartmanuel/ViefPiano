import { load, save, defaultProfile } from '../lib/storage.js';
import { newId } from '../lib/ids.js';
import { pickNext } from '../lib/picker.js';
import { extendStreak } from '../lib/streak.js';
import { ANTI_REPEAT_WINDOW } from '../config.js';

const initial = load();

/**
 * Centrale reactieve app-state. Datamodel:
 *   - profiles: map van profileId → profile object
 *   - activeProfileId: welke profile op dit moment actief is
 *   - currentSongId: welk nummer op het Play Screen staat (ephemeral, niet
 *     gepersisteerd — bij reload wordt een nieuwe pick gemaakt)
 *   - screen: 'onboard' | 'play' | 'list' | 'profiles'
 *
 * Naam is `app` (i.p.v. `state`) om botsing met de `$state`-rune te vermijden.
 */
export const app = $state({
  screen: initial.activeProfileId ? 'play' : 'onboard',
  activeProfileId: initial.activeProfileId,
  profiles: initial.profiles,
  currentSongId: null,
});

function persist() {
  save({
    schemaVersion: 1,
    activeProfileId: app.activeProfileId,
    profiles: $state.snapshot(app.profiles),
  });
}

// --- Profile helpers -------------------------------------------------------

export function currentProfile() {
  return app.activeProfileId ? app.profiles[app.activeProfileId] : null;
}

export function profileList() {
  return Object.values(app.profiles).sort((a, b) =>
    a.createdAt < b.createdAt ? -1 : 1,
  );
}

export function createProfile(name) {
  const id = newId('p');
  app.profiles[id] = defaultProfile(id, name.trim() || 'Ik');
  app.activeProfileId = id;
  app.currentSongId = null;
  app.screen = 'play';
  persist();
  return id;
}

export function switchProfile(id) {
  if (!app.profiles[id]) return;
  app.activeProfileId = id;
  app.currentSongId = null;
  persist();
}

export function renameProfile(id, name) {
  const p = app.profiles[id];
  if (!p) return;
  const trimmed = name.trim();
  if (trimmed) p.name = trimmed;
  persist();
}

/**
 * Neem een geparst import-profiel op als nieuw profiel. Voegt " (import)"
 * suffix toe als de naam al bestaat. Maakt altijd een nieuw id aan om
 * collisions met bestaande profielen te voorkomen.
 */
export function importProfileData(parsed) {
  const id = newId('p');
  const existingNames = new Set(Object.values(app.profiles).map((p) => p.name));
  let name = parsed.name;
  if (existingNames.has(name)) name = `${name} (import)`;
  let suffix = 2;
  while (existingNames.has(name)) {
    name = `${parsed.name} (import ${suffix++})`;
  }

  app.profiles[id] = {
    id,
    name,
    createdAt: parsed.createdAt,
    songs: parsed.songs,
    history: [],
    bag: [],
    lastPlayedId: null,
    settings: parsed.settings ?? { practicingWeight: 2 },
  };
  persist();
  return id;
}

export function deleteProfile(id) {
  const ids = Object.keys(app.profiles);
  if (ids.length <= 1) return false; // keep at least one
  delete app.profiles[id];
  if (app.activeProfileId === id) {
    app.activeProfileId = Object.keys(app.profiles)[0];
    app.currentSongId = null;
  }
  persist();
  return true;
}

// --- Navigation ------------------------------------------------------------

export function setScreen(screen) {
  app.screen = screen;
}

// --- Song CRUD (scoped to current profile) ---------------------------------

export function addSong({ title, composer = '', notes = '', practicing = false }) {
  const p = currentProfile();
  if (!p) return null;
  const song = {
    id: newId('s'),
    title: title.trim(),
    composer: composer.trim(),
    notes: notes.trim(),
    practicing: !!practicing,
    playCount: 0,
    skipStreak: 0,
    lastPlayedAt: null,
    createdAt: new Date().toISOString(),
  };
  p.songs.push(song);
  p.bag = [];
  persist();
  return song;
}

export function updateSong(id, patch) {
  const p = currentProfile();
  if (!p) return;
  const song = p.songs.find((s) => s.id === id);
  if (!song) return;
  if (patch.title !== undefined) song.title = patch.title.trim();
  if (patch.composer !== undefined) song.composer = patch.composer.trim();
  if (patch.notes !== undefined) song.notes = patch.notes.trim();
  if (patch.practicing !== undefined) song.practicing = !!patch.practicing;
  p.bag = [];
  persist();
}

export function deleteSong(id) {
  const p = currentProfile();
  if (!p) return;
  const i = p.songs.findIndex((s) => s.id === id);
  if (i < 0) return;
  p.songs.splice(i, 1);
  if (app.currentSongId === id) app.currentSongId = null;
  if (p.lastPlayedId === id) p.lastPlayedId = null;
  p.history = p.history.filter((x) => x !== id);
  p.bag = [];
  persist();
}

export function togglePracticing(id) {
  const p = currentProfile();
  if (!p) return;
  const song = p.songs.find((s) => s.id === id);
  if (!song) return;
  song.practicing = !song.practicing;
  p.bag = [];
  persist();
}

// --- Picker integration ----------------------------------------------------

export function advance(action = 'next') {
  const p = currentProfile();
  if (!p || p.songs.length === 0) {
    app.currentSongId = null;
    return;
  }

  const leavingId = app.currentSongId;
  const leaving = leavingId ? p.songs.find((s) => s.id === leavingId) : null;

  if (action === 'next' && leaving) {
    const now = new Date().toISOString();
    leaving.lastPlayedAt = now;
    leaving.playCount = (leaving.playCount ?? 0) + 1;
    leaving.skipStreak = 0; // wel gespeeld → reset demotie
    extendStreak(p.streak); // dag-streak alleen op echt-gespeeld
    appendPlayLog(p, leaving.id, now);
  }

  if (action === 'skip' && leaving) {
    leaving.skipStreak = (leaving.skipStreak ?? 0) + 1;
  }

  if (leavingId) {
    p.history.push(leavingId);
    const maxHistory = Math.max(ANTI_REPEAT_WINDOW * 4, 10);
    if (p.history.length > maxHistory) {
      p.history = p.history.slice(-maxHistory);
    }
  }

  // Skip → bag rebuilden zodat de gewichten meteen kloppen voor de
  // volgende pick. Anders zou de zojuist gedemoteerde song nog volledig
  // in de oude bag zitten en even vaak voorkomen.
  if (action === 'skip') p.bag = [];

  const { pickedId, bag: newBag } = pickNext(
    $state.snapshot(p.songs),
    $state.snapshot(p.bag),
    $state.snapshot(p.history),
  );

  p.bag = newBag;
  app.currentSongId = pickedId;
  p.lastPlayedId = leavingId;

  persist();
}

/**
 * Manueel een song als "gespeeld" markeren (issue #2). Telt mee voor
 * playCount, lastPlayedAt, history, streak en reset skipStreak — dezelfde
 * effecten als een 'next' op het Play Screen — maar laat de currentSongId
 * ongemoeid. Eén bag-entry van deze song wordt geconsumeerd zodat de
 * cyclus blijft kloppen; als de song niet in de bag zit, gebeurt er niets
 * met de bag.
 */
export function markPlayed(songId) {
  const p = currentProfile();
  if (!p) return;
  const song = p.songs.find((s) => s.id === songId);
  if (!song) return;

  const now = new Date().toISOString();
  song.lastPlayedAt = now;
  song.playCount = (song.playCount ?? 0) + 1;
  song.skipStreak = 0;
  extendStreak(p.streak);
  appendPlayLog(p, song.id, now);

  p.history.push(song.id);
  const maxHistory = Math.max(ANTI_REPEAT_WINDOW * 4, 10);
  if (p.history.length > maxHistory) {
    p.history = p.history.slice(-maxHistory);
  }

  const idx = p.bag.indexOf(song.id);
  if (idx >= 0) p.bag.splice(idx, 1);

  persist();
}

export function decrementPlayCount(songId) {
  const p = currentProfile();
  if (!p) return;
  const song = p.songs.find((s) => s.id === songId);
  if (!song) return;
  const next = Math.max(0, (song.playCount ?? 0) - 1);
  if (next === song.playCount) return;
  song.playCount = next;
  persist();
}

/**
 * Sla een play-event op in profile.playLog. Bound op ~13 maanden zodat
 * localStorage niet onbeperkt groeit (100 plays/maand × 13 mnd = 1300
 * entries × ~50 byte ≈ 65 KB; ruim binnen quota).
 */
function appendPlayLog(p, songId, ts) {
  if (!Array.isArray(p.playLog)) p.playLog = [];
  p.playLog.push({ songId, ts });
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 13);
  const cutoffIso = cutoff.toISOString();
  if (p.playLog.length > 200 && p.playLog[0].ts < cutoffIso) {
    p.playLog = p.playLog.filter((e) => e.ts >= cutoffIso);
  }
}

export function dismissRecap(monthStr) {
  const p = currentProfile();
  if (!p) return;
  p.lastDismissedRecapMonth = monthStr;
  persist();
}

export function ensureCurrent() {
  const p = currentProfile();
  if (!p || p.songs.length === 0) {
    app.currentSongId = null;
    return;
  }
  if (app.currentSongId && p.songs.find((s) => s.id === app.currentSongId)) {
    return;
  }
  const { pickedId, bag: newBag } = pickNext(
    $state.snapshot(p.songs),
    $state.snapshot(p.bag),
    $state.snapshot(p.history),
  );
  p.bag = newBag;
  app.currentSongId = pickedId;
  persist();
}

export function persistNow() {
  persist();
}
