<script>
  import { currentProfile, setScreen, dismissRecap } from '../stores/app.svelte.js';
  import {
    getMonthRecap,
    formatMonthLabel,
    previousMonthStr,
    nextMonthStr,
    thisMonthStr,
  } from '../lib/recap.js';

  let viewing = $state(thisMonthStr());

  const profile = $derived(currentProfile());
  const recap = $derived(profile ? getMonthRecap(profile, viewing) : null);
  const canGoNext = $derived(viewing < thisMonthStr());

  function back() {
    // Bij sluiten van een eerdere maand: markeren als gezien zodat de banner verdwijnt.
    if (viewing < thisMonthStr() && recap?.hasData) {
      dismissRecap(viewing);
    }
    setScreen('play');
  }

  function gotoPrev() {
    viewing = previousMonthStr(viewing);
  }
  function gotoNext() {
    if (canGoNext) viewing = nextMonthStr(viewing);
  }
</script>

<section class="recap">
  <header class="topbar">
    <button class="back" onclick={back} aria-label="Terug">←</button>
    <h1>Maandoverzicht</h1>
    <span class="spacer"></span>
  </header>

  <div class="scroll">
    <div class="monthnav">
      <button onclick={gotoPrev} aria-label="Vorige maand">‹</button>
      <h2>{formatMonthLabel(viewing)}</h2>
      <button onclick={gotoNext} disabled={!canGoNext} aria-label="Volgende maand">›</button>
    </div>

    {#if !recap?.hasData}
      <p class="empty">Geen gegevens voor deze maand.</p>
    {:else}
      <div class="grid">
        <div class="stat">
          <span class="num">{recap.daysPlayed}</span>
          <span class="lbl">dagen gespeeld</span>
        </div>
        <div class="stat">
          <span class="num">{recap.totalPlays}</span>
          <span class="lbl">nummers totaal</span>
        </div>
        <div class="stat">
          <span class="num">🔥 {recap.longestStreakInMonth}</span>
          <span class="lbl">langste reeks</span>
        </div>
      </div>

      {#if recap.topSongs.length}
        <h3>Meest gespeeld</h3>
        <ol class="top">
          {#each recap.topSongs as entry, i}
            <li>
              <span class="rank">#{i + 1}</span>
              <span class="title">{entry.song.title}</span>
              {#if entry.song.composer}
                <span class="composer">{entry.song.composer}</span>
              {/if}
              <span class="cnt">{entry.count}×</span>
            </li>
          {/each}
        </ol>
      {/if}
    {/if}
  </div>
</section>

<style>
  .recap {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
  }
  .topbar {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border);
    display: grid;
    grid-template-columns: 2.5rem 1fr 2.5rem;
    align-items: center;
  }
  .topbar h1 {
    margin: 0;
    font-size: 1.1rem;
    text-align: center;
  }
  .back {
    background: transparent;
    border: none;
    font-size: 1.5rem;
    justify-self: start;
  }
  .spacer {
    width: 2.5rem;
  }
  .scroll {
    flex: 1;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .monthnav {
    display: grid;
    grid-template-columns: 3rem 1fr 3rem;
    align-items: center;
    gap: 0.5rem;
  }
  .monthnav h2 {
    margin: 0;
    text-align: center;
    font-size: 1.25rem;
  }
  .monthnav button {
    background: transparent;
    border: none;
    font-size: 1.6rem;
    color: var(--text);
  }
  .monthnav button[disabled] {
    color: var(--muted);
  }
  .empty {
    color: var(--muted);
    text-align: center;
    margin-top: 2rem;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
  }
  .stat {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1rem 0.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    text-align: center;
  }
  .stat .num {
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--primary);
  }
  .stat .lbl {
    color: var(--muted);
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  h3 {
    margin: 1rem 0 0;
    font-size: 1rem;
    color: var(--muted);
    font-weight: 500;
  }
  .top {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .top li {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.75rem 1rem;
    display: grid;
    grid-template-columns: 2rem 1fr auto;
    grid-template-rows: auto auto;
    align-items: center;
    column-gap: 0.5rem;
  }
  .top .rank {
    grid-row: 1 / 3;
    font-weight: 700;
    color: var(--primary);
  }
  .top .title {
    font-weight: 600;
  }
  .top .composer {
    grid-column: 2;
    grid-row: 2;
    color: var(--muted);
    font-size: 0.85rem;
  }
  .top .cnt {
    grid-row: 1 / 3;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
</style>
