<script>
  let {
    initial = { title: '', composer: '', notes: '', practicing: false },
    onsubmit,
    oncancel,
    mode = 'create', // 'create' | 'edit'
  } = $props();

  // SongForm is altijd unmounted+remounted voor een nieuw record, dus het
  // is prima om de initial prop éénmalig te capturen. Svelte waarschuwt hier
  // voor het geval je reactiviteit verwacht — niet van toepassing hier.
  // svelte-ignore state_referenced_locally
  let title = $state(initial.title);
  // svelte-ignore state_referenced_locally
  let composer = $state(initial.composer);
  // svelte-ignore state_referenced_locally
  let notes = $state(initial.notes);
  // svelte-ignore state_referenced_locally
  let practicing = $state(initial.practicing);

  function submit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    onsubmit({ title, composer, notes, practicing });
  }
</script>

<div class="backdrop" onclick={oncancel} role="presentation"></div>
<form class="sheet" onsubmit={submit}>
  <header>
    <h2>{mode === 'create' ? 'Nieuw nummer' : 'Nummer bewerken'}</h2>
    <button type="button" class="close" onclick={oncancel} aria-label="Sluiten">✕</button>
  </header>

  <label>
    <span>Titel<span class="req">*</span></span>
    <input type="text" bind:value={title} required />
  </label>

  <label>
    <span>Componist / artiest</span>
    <input type="text" bind:value={composer} />
  </label>

  <label>
    <span>Notitie</span>
    <textarea bind:value={notes}></textarea>
  </label>

  <label class="checkbox">
    <input type="checkbox" bind:checked={practicing} />
    <span>Nog aan het oefenen</span>
  </label>

  <button type="submit" class="primary" disabled={!title.trim()}>Opslaan</button>
</form>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    z-index: 10;
  }
  .sheet {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    bottom: 0;
    width: 100%;
    max-width: 560px;
    background: var(--surface);
    border-top-left-radius: 20px;
    border-top-right-radius: 20px;
    padding: 1.25rem;
    padding-bottom: calc(1.25rem + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 1rem;
    z-index: 11;
    max-height: 90dvh;
    overflow-y: auto;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  h2 {
    margin: 0;
    font-size: 1.2rem;
  }
  .close {
    background: transparent;
    border: none;
    padding: 0.25rem 0.5rem;
    font-size: 1.3rem;
    cursor: pointer;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    font-size: 0.95rem;
    color: var(--muted);
  }
  label.checkbox {
    flex-direction: row;
    align-items: center;
    gap: 0.6rem;
    color: var(--text);
  }
  .req {
    color: var(--danger);
    margin-left: 0.15rem;
  }
</style>
