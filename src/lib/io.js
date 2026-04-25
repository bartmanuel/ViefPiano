import { newId } from './ids.js';

const EXPORT_VERSION = 1;
const APP_MARK = 'viefpiano';

/**
 * Bouwt een JSON-string voor download. We exporteren één profiel tegelijk;
 * dat is voldoende voor backup en uitwisseling en voorkomt dat je per ongeluk
 * andermans profiel overschrijft bij import.
 */
export function buildExportPayload(profile) {
  return {
    app: APP_MARK,
    schemaVersion: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    profile: {
      id: profile.id,
      name: profile.name,
      createdAt: profile.createdAt,
      songs: profile.songs,
      settings: profile.settings,
      // history / bag / lastPlayedId zijn ephemeral runtime-state — niet mee.
    },
  };
}

/**
 * Trigger een download in de browser via Blob + hidden <a>. iOS Safari
 * ondersteunt dit; bestand verschijnt in Bestanden → Downloads of de share-
 * sheet, afhankelijk van OS-versie.
 */
export function downloadProfile(profile) {
  const payload = buildExportPayload(profile);
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  const safeName = (profile.name || 'profiel').replace(/[^a-z0-9_\- ]/gi, '_');
  const date = new Date().toISOString().slice(0, 10);
  a.download = `viefpiano-${safeName}-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Browser mag de URL direct weer vrijgeven.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Parse en valideer een geïmporteerd JSON-payload. Gooit met duidelijke
 * boodschap als iets niet klopt. Returnt een genormaliseerd profile-object;
 * caller is verantwoordelijk voor naam-dedup en id-generatie.
 */
export function parseImport(text) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch (e) {
    throw new Error('Bestand is geen geldige JSON.');
  }
  if (!obj || typeof obj !== 'object') {
    throw new Error('Bestand heeft onverwachte vorm.');
  }
  if (obj.app && obj.app !== APP_MARK) {
    throw new Error(`Bestand lijkt niet van ViefPiano (app="${obj.app}").`);
  }
  if (!obj.profile || typeof obj.profile !== 'object') {
    throw new Error('Geen "profile" veld gevonden.');
  }

  const src = obj.profile;
  if (!Array.isArray(src.songs)) {
    throw new Error('Profiel heeft geen geldige songs-array.');
  }

  const songs = src.songs.map((s) => ({
    id: s.id || newId('s'),
    title: String(s.title ?? '').trim(),
    composer: String(s.composer ?? '').trim(),
    notes: String(s.notes ?? '').trim(),
    practicing: !!s.practicing,
    lastPlayedAt: s.lastPlayedAt ?? null,
    createdAt: s.createdAt ?? new Date().toISOString(),
  }));

  return {
    name: String(src.name ?? 'Import').trim() || 'Import',
    createdAt: src.createdAt ?? new Date().toISOString(),
    songs,
    settings: src.settings ?? { practicingWeight: 2 },
  };
}
