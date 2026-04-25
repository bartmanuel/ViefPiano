/**
 * Duolingo-stijl streak logic.
 *
 * Een "dag" is YYYY-MM-DD in de lokale tijdzone van de gebruiker. We slaan
 * die als string op zodat tijdzone-shifts (reizen, DST) de streak niet
 * onbedoeld breken.
 */

export function dayString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayStr() {
  return dayString(new Date());
}

export function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dayString(d);
}

export function defaultStreak() {
  return {
    current: 0,
    longest: 0,
    lastPlayedDay: null,
    history: [], // sorted-asc list of YYYY-MM-DD strings
  };
}

/**
 * Mutates `streak` to register today's play. Call op elke succesvolle "klaar"
 * of manual markPlayed-actie. Idempotent binnen dezelfde dag.
 */
export function extendStreak(streak) {
  const today = todayStr();
  const last = streak.lastPlayedDay;

  if (last === today) return; // al geteld vandaag

  if (last === yesterdayStr()) {
    streak.current = (streak.current || 0) + 1;
  } else {
    streak.current = 1; // gat in de keten → opnieuw vanaf 1
  }
  streak.lastPlayedDay = today;

  if (streak.current > (streak.longest || 0)) {
    streak.longest = streak.current;
  }

  if (!streak.history.includes(today)) {
    streak.history.push(today);
  }
}

/**
 * Geef de streak die je *nu* aan de gebruiker laat zien.
 * Als de laatst-gespeelde dag niet vandaag of gisteren was, is de streak
 * effectief verbroken — toon 0. (We resetten `current` pas bij de volgende
 * extend-call, zodat we de oude waarde nog kennen voor evt. analytics.)
 */
export function displayStreak(streak) {
  if (!streak || !streak.lastPlayedDay) return 0;
  const today = todayStr();
  if (streak.lastPlayedDay === today) return streak.current;
  if (streak.lastPlayedDay === yesterdayStr()) return streak.current;
  return 0; // verbroken
}
