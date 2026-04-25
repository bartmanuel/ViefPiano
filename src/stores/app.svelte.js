import { load, save, defaultProfile } from '../lib/storage.js';
import { newId } from '../lib/ids.js';
import { pickNext } from '../lib/picker.js';
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

  if (action === 'next' && leavingId) {
    const leaving = p.songs.find((s) => s.id === leavingId);
    if (leaving) leaving.lastPlayedAt = new Date().toISOString();
  }

  if (leavingId) {
    p.history.push(leavingId);
    const maxHistory = Math.max(ANTI_REPEAT_WINDOW * 4, 10);
    if (p.history.length > maxHistory) {
      p.history = p.history.slice(-maxHistory);
    }
  }

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
