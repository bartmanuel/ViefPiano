<script>
  import {
    currentProfile,
    addSong,
    updateSong,
    deleteSong,
    togglePracticing,
    setScreen,
    importProfileData,
    markPlayed,
    decrementPlayCount,
  } from '../stores/app.svelte.js';
  import { downloadProfile, parseImport } from '../lib/io.js';
  import { displayStreak } from '../lib/streak.js';
  import SongForm from '../components/SongForm.svelte';

  let editing = $state(null); // null | 'new' | song-id
  let expandedId = $state(null);
  let fileInput; // bound ref
  let importMsg = $state(null); // {type: 'ok'|'err', text}
  let menuOpen = $state(false);

  const profile = $derived(currentProfile());
  const songs = $derived(profile?.songs ?? []);
  const currentStreak = $derived(profile ? displayStreak(profile.streak) : 0);
  const longestStreak = $derived(profile?.streak?.longest ?? 0);

  function onExport() {
    menuOpen = false;
    if (!profile) return;
    downloadProfile($state.snapshot(profile));
  }

  function onImportClick() {
    menuOpen = false;
    importMsg = null;
    fileInput?.click();
  }

  async function onImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseImport(text);
      importProfileData(parsed);
      importMsg = {
        type: 'ok',
        text: `Geïmporteerd als nieuw profiel: "${parsed.name}" (${parsed.songs.length} nummer${parsed.songs.length === 1 ? '' : 's'}).`,
      };
    } catch (err) {
      importMsg = { type: 'err', text: err.message || 'Import mislukt.' };
    } finally {
      // reset zodat dezelfde file opnieuw kan worden gekozen
      if (fileInput) fileInput.value = '';
    }
  }

  function openNew() {
    editing = 'new';
  }

  function openEdit(id) {
    editing = id;
  }

  function handleSubmit(data) {
    if (editing === 'new') {
      addSong(data);
    } else {
      updateSong(editing, data);
    }
    editing = null;
  }

  function handleDelete(id) {
    if (confirm('Dit nummer verwijderen?')) {
      deleteSong(id);
      expandedId = null;
    }
  }

  function editingSong() {
    return songs.find((s) => s.id === editing);
  }
</script>

<section class="list">
  <header class="topbar">
    <button class="back" onclick={() => setScreen('play')} aria-label="Terug">←</button>
    <h1>Mijn Lijst</h1>
    <div class="menuwrap">
      <button
        class="menu"
        onclick={() => (menuOpen = !menuOpen)}
        aria-label="Menu"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >☰</button>
      {#if menuOpen}
        <div class="menubackdrop" onclick={() => (menuOpen = false)} aria-hidden="true"></div>
        <div class="menupanel" role="menu">
          <button role="menuitem" onclick={onExport} disabled={!songs.length}>Export lijst</button>
          <button role="menuitem" onclick={onImportClick}>Import lijst</button>
        </div>
      {/if}
    </div>
  </header>

  <div class="scroll">
    {#if profile}
      <div class="streakbar" class:alive={currentStreak > 0}>
        <div class="cell">
          <span class="num">🔥 {currentStreak}</span>
          <span class="label">huidige reeks</span>
        </div>
        <div class="cell">
          <span class="num">🏆 {longestStreak}</span>
          <span class="label">langst</span>
        </div>
        <div class="cell">
          <span class="num">{profile.streak?.history?.length ?? 0}</span>
          <span class="label">dagen totaal</span>
        </div>
      </div>
    {/if}

    <button class="recap" onclick={() => setScreen('recap')}>Maandoverzicht</button>

    <button class="primary add" onclick={openNew}>+ Nummer toevoegen</button>

    {#if songs.length === 0}
      <p class="empty">Nog geen nummers. Voeg er een toe om te beginnen.</p>
    {:else}
      <ul>
        {#each songs as song (song.id)}
          <li class="row" class:practicing={song.practicing}>
            <div class="rowmain">
              <span class="star" aria-hidden="true">{song.practicing ? '★' : '☆'}</span>
              <button
                class="metabtn"
                onclick={() => (expandedId = expandedId === song.id ? null : song.id)}
                aria-expanded={expandedId === song.id}
              >
                <span class="title">{song.title}</span>
                <span class="sub">
                  {#if song.composer}<span class="composer">{song.composer}</span>{/if}
                  <span class="count" title="Aantal keer gespeeld">{song.playCount ?? 0}×</span>
                  {#if (song.skipStreak ?? 0) > 0}
                    <span class="skipmark" title="{song.skipStreak}× achter elkaar geskipt — komt minder vaak voor">
                      ⏭ {song.skipStreak}
                    </span>
                  {/if}
                </span>
              </button>
              <div class="counter">
                <button
                  class="ctr"
                  onclick={() => decrementPlayCount(song.id)}
                  disabled={(song.playCount ?? 0) === 0}
                  aria-label="Eén keer minder gespeeld"
                >−</button>
                <button
                  class="ctr plus"
                  onclick={() => markPlayed(song.id)}
                  aria-label="Eén keer gespeeld"
                >+</button>
              </div>
            </div>
            {#if expandedId === song.id}
              <div class="actions">
                <button onclick={() => markPlayed(song.id)}>✓ Gespeeld</button>
                <button onclick={() => togglePracticing(song.id)}>
                  {song.practicing ? 'Oefenen uit' : 'Oefenen aan'}
                </button>
                <button onclick={() => openEdit(song.id)}>Bewerken</button>
                <button class="danger" onclick={() => handleDelete(song.id)}>Verwijderen</button>
              </div>
              {#if song.notes}
                <p class="notes">{song.notes}</p>
              {/if}
            {/if}
          </li>
        {/each}
      </ul>
    {/if}

    <input
      type="file"
      accept="application/json,.json"
      bind:this={fileInput}
      onchange={onImportFile}
      hidden
    />
    {#if importMsg}
      <p class="msg {importMsg.type}">{importMsg.text}</p>
    {/if}
  </div>
</section>

{#if editing === 'new'}
  <SongForm mode="create" onsubmit={handleSubmit} oncancel={() => (editing = null)} />
{:else if editing}
  {@const s = editingSong()}
  {#if s}
    <SongForm mode="edit" initial={s} onsubmit={handleSubmit} oncancel={() => (editing = null)} />
  {/if}
{/if}

<style>
  .list {
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
    padding: 0.25rem 0.5rem;
    justify-self: start;
  }
  .menuwrap {
    position: relative;
    justify-self: end;
  }
  .menu {
    background: transparent;
    border: none;
    font-size: 1.4rem;
    padding: 0.25rem 0.5rem;
  }
  .menubackdrop {
    position: fixed;
    inset: 0;
    z-index: 10;
  }
  .menupanel {
    position: absolute;
    top: calc(100% + 0.35rem);
    right: 0;
    z-index: 11;
    min-width: 12rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
    padding: 0.35rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .menupanel button {
    background: transparent;
    border: none;
    border-radius: calc(var(--radius) - 4px);
    text-align: left;
    padding: 0.7rem 0.85rem;
    font-size: 0.95rem;
  }
  .menupanel button:hover:not(:disabled) {
    background: var(--surface-2);
  }
  .scroll {
    flex: 1;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .add,
  .recap {
    width: 100%;
  }
  .empty {
    text-align: center;
    color: var(--muted);
    margin-top: 2rem;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .row {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .row.practicing {
    border-left: 4px solid var(--primary);
  }
  .rowmain {
    width: 100%;
    display: grid;
    grid-template-columns: 2rem 1fr auto;
    align-items: center;
    gap: 0.5rem;
    padding: 0.9rem 1rem;
  }
  .metabtn {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    min-width: 0;
    background: transparent;
    border: none;
    border-radius: 0;
    padding: 0;
    text-align: left;
  }
  .counter {
    display: flex;
    gap: 0.35rem;
  }
  .ctr {
    width: 2.25rem;
    height: 2.25rem;
    padding: 0;
    border-radius: 999px;
    font-size: 1.1rem;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .ctr.plus {
    background: var(--primary);
    color: var(--primary-text);
    border-color: var(--primary);
    font-weight: 700;
  }
  .star {
    color: var(--primary);
    font-size: 1.1rem;
  }
  .meta {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .title {
    font-weight: 600;
  }
  .sub {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: baseline;
    font-size: 0.85rem;
    color: var(--muted);
  }
  .composer {
    color: var(--muted);
    font-size: 0.85rem;
  }
  .count {
    font-variant-numeric: tabular-nums;
    color: var(--muted);
  }
  .skipmark {
    color: var(--danger);
    background: rgba(239, 83, 80, 0.12);
    padding: 0 0.4rem;
    border-radius: 999px;
    font-size: 0.75rem;
  }
  .streakbar {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
    padding: 0.75rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }
  .streakbar.alive {
    border-color: var(--primary);
  }
  .streakbar .cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.15rem;
  }
  .streakbar .num {
    font-size: 1.05rem;
    font-weight: 600;
  }
  .streakbar .label {
    font-size: 0.72rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .actions {
    display: flex;
    gap: 0.5rem;
    padding: 0 1rem 0.9rem;
    flex-wrap: wrap;
  }
  .actions button {
    flex: 1;
    padding: 0.6rem 0.75rem;
    font-size: 0.9rem;
  }
  .notes {
    margin: 0;
    padding: 0 1rem 0.9rem;
    color: var(--muted);
    font-style: italic;
    white-space: pre-wrap;
  }
  .msg {
    margin: 0.25rem 0 0;
    padding: 0.6rem 0.8rem;
    border-radius: var(--radius);
    font-size: 0.9rem;
  }
  .msg.ok {
    background: rgba(246, 195, 68, 0.12);
    color: var(--primary);
    border: 1px solid var(--primary);
  }
  .msg.err {
    background: rgba(239, 83, 80, 0.12);
    color: var(--danger);
    border: 1px solid var(--danger);
  }
</style>
