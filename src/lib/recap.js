import { dayString } from './streak.js';

const MONTH_NAMES = [
  'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december',
];

export function monthString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function thisMonthStr() {
  return monthString(new Date());
}

export function previousMonthStr(monthStr = thisMonthStr()) {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m - 2, 1); // m is 1-based, Date wants 0-based
  return monthString(d);
}

export function nextMonthStr(monthStr = thisMonthStr()) {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m, 1);
  return monthString(d);
}

export function formatMonthLabel(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/**
 * Aggregate stats voor één maand. Pure functie — geen side effects.
 * Returnt:
 *   - month: de YYYY-MM
 *   - totalPlays: aantal "klaar/volgende" + markPlayed events deze maand
 *   - daysPlayed: aantal unieke dagen waarop gespeeld is deze maand
 *   - longestStreakInMonth: langste opeenvolgende dagenreeks binnen deze maand
 *     (gebruikt streak.history; meet alleen binnen het kalendermaand-window)
 *   - topSongs: top 3 songs deze maand met {song, count}
 *   - hasData: true als er events waren
 */
export function getMonthRecap(profile, monthStr) {
  const log = profile?.playLog ?? [];
  const songsById = new Map((profile?.songs ?? []).map((s) => [s.id, s]));

  const inMonth = log.filter((e) => (e.ts ?? '').slice(0, 7) === monthStr);

  const dayCount = new Map();
  const songCount = new Map();
  for (const e of inMonth) {
    const day = (e.ts ?? '').slice(0, 10);
    dayCount.set(day, (dayCount.get(day) ?? 0) + 1);
    songCount.set(e.songId, (songCount.get(e.songId) ?? 0) + 1);
  }

  // Top 3 songs
  const topSongs = [...songCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([songId, count]) => ({
      song: songsById.get(songId) ?? { id: songId, title: '(verwijderd)' },
      count,
    }));

  // Langste reeks binnen deze maand (op basis van streak.history)
  const monthDays = (profile?.streak?.history ?? []).filter((d) =>
    d.startsWith(monthStr + '-'),
  ).sort();
  let longestInMonth = 0, currentRun = 0, prev = null;
  for (const day of monthDays) {
    if (prev === null) {
      currentRun = 1;
    } else {
      const prevDate = new Date(prev);
      prevDate.setDate(prevDate.getDate() + 1);
      const expected = dayString(prevDate);
      currentRun = day === expected ? currentRun + 1 : 1;
    }
    if (currentRun > longestInMonth) longestInMonth = currentRun;
    prev = day;
  }

  return {
    month: monthStr,
    totalPlays: inMonth.length,
    daysPlayed: dayCount.size,
    longestStreakInMonth: longestInMonth,
    topSongs,
    hasData: inMonth.length > 0,
  };
}

/**
 * Bepaal of we een banner moeten tonen voor het overzicht van de
 * voorgaande maand. We tonen-em als (a) we in een nieuwe maand zitten
 * t.o.v. de last-dismissed, en (b) er daadwerkelijk data uit de
 * voorgaande maand is.
 */
export function shouldShowRecapBanner(profile) {
  if (!profile) return false;
  const prev = previousMonthStr();
  if (profile.lastDismissedRecapMonth === prev) return false;
  const recap = getMonthRecap(profile, prev);
  return recap.hasData;
}
