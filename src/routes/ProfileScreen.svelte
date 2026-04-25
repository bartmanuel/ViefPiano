<script>
  import {
    app,
    profileList,
    createProfile,
    switchProfile,
    renameProfile,
    deleteProfile,
    setScreen,
  } from '../stores/app.svelte.js';

  let adding = $state(false);
  let newName = $state('');
  let renamingId = $state(null);
  let renameValue = $state('');

  const profiles = $derived(profileList());
  const canDelete = $derived(profiles.length > 1);

  function submitNew(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    createProfile(newName);
    adding = false;
    newName = '';
    setScreen('play');
  }

  function pick(id) {
    switchProfile(id);
    setScreen('play');
  }

  function startRename(id, currentName) {
    renamingId = id;
    renameValue = currentName;
  }

  function submitRename(e) {
    e.preventDefault();
    if (renameValue.trim()) {
      renameProfile(renamingId, renameValue);
    }
    renamingId = null;
  }

  function confirmDelete(id, name) {
    if (!canDelete) return;
    if (confirm(`Profiel "${name}" en alle nummers verwijderen?`)) {
      deleteProfile(id);
    }
  }
</script>

<section class="profiles">
  <header class="topbar">
    <button class="back" onclick={() => setScreen('play')} aria-label="Terug">←</button>
    <h1>Profielen</h1>
    <span class="spacer"></span>
  </header>

  <div class="scroll">
    <ul>
      {#each profiles as p (p.id)}
        <li class="row" class:active={p.id === app.activeProfileId}>
          {#if renamingId === p.id}
            <form class="rename" onsubmit={submitRename}>
              <input type="text" bind:value={renameValue} />
              <button type="submit" class="primary">OK</button>
              <button type="button" onclick={() => (renamingId = null)}>Annuleer</button>
            </form>
          {:else}
            <button class="name" onclick={() => pick(p.id)}>
              <span class="dot">{p.id === app.activeProfileId ? '●' : '○'}</span>
              <span>{p.name}</span>
              {#if p.id === app.activeProfileId}
                <span class="badge">actief</span>
              {/if}
            </button>
            <div class="rowactions">
              <button onclick={() => startRename(p.id, p.name)}>Hernoem</button>
              <button
                class="danger"
                disabled={!canDelete}
                onclick={() => confirmDelete(p.id, p.name)}
              >
                Verwijder
              </button>
            </div>
          {/if}
        </li>
      {/each}
    </ul>

    {#if adding}
      <form class="newprof" onsubmit={submitNew}>
        <input type="text" bind:value={newName} placeholder="Naam nieuw profiel" />
        <button type="submit" class="primary" disabled={!newName.trim()}>Toevoegen</button>
        <button type="button" onclick={() => { adding = false; newName = ''; }}>Annuleer</button>
      </form>
    {:else}
      <button class="primary add" onclick={() => (adding = true)}>+ Profiel toevoegen</button>
    {/if}

    {#if !canDelete}
      <p class="hint">Je laatste profiel kun je niet verwijderen.</p>
    {/if}
  </div>
</section>

<style>
  .profiles {
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
    gap: 0.75rem;
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
  .row.active {
    border-color: var(--primary);
  }
  .name {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.9rem 1rem;
    background: transparent;
    border: none;
    border-radius: 0;
    text-align: left;
  }
  .dot {
    color: var(--primary);
    width: 1.2rem;
  }
  .badge {
    margin-left: auto;
    background: var(--primary);
    color: var(--primary-text);
    font-size: 0.75rem;
    padding: 0.1rem 0.5rem;
    border-radius: 999px;
  }
  .rowactions {
    display: flex;
    gap: 0.5rem;
    padding: 0 1rem 0.8rem;
  }
  .rowactions button {
    flex: 1;
    padding: 0.5rem 0.75rem;
    font-size: 0.9rem;
  }
  .rename {
    padding: 0.8rem 1rem;
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .rename input {
    flex: 1 1 auto;
    min-width: 0;
  }
  .newprof {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .newprof input {
    flex: 1 1 10rem;
    min-width: 0;
  }
  .add {
    width: 100%;
  }
  .hint {
    color: var(--muted);
    font-size: 0.85rem;
    text-align: center;
    margin-top: 0.5rem;
  }
</style>
