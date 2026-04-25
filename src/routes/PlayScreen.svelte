<script>
  import {
    app,
    currentProfile,
    setScreen,
    advance,
    ensureCurrent,
    togglePracticing,
  } from '../stores/app.svelte.js';

  $effect(() => {
    ensureCurrent();
  });

  const profile = $derived(currentProfile());
  const songs = $derived(profile?.songs ?? []);
  const current = $derived(songs.find((s) => s.id === app.currentSongId) ?? null);

  function onNext() {
    advance('next');
  }
  function onSkip() {
    advance('skip');
  }
  function onToggle() {
    if (current) togglePracticing(current.id);
  }
</script>

<section class="play">
  <header class="topbar">
    <button class="profile" onclick={() => setScreen('profiles')} aria-label="Profielen">
      <span class="pname">{profile?.name ?? '—'}</span>
      <span class="caret">▾</span>
    </button>
    <button class="menu" onclick={() => setScreen('list')} aria-label="Lijst">☰</button>
  </header>

  <div class="stage">
    {#if current}
      <div class="title">{current.title}</div>
      {#if current.composer}
        <div class="composer">{current.composer}</div>
      {/if}
      {#if current.notes}
        <div class="notes">{current.notes}</div>
      {/if}

      <button class="practicing-toggle" onclick={onToggle} aria-pressed={current.practicing}>
        <span class="star">{current.practicing ? '★' : '☆'}</span>
        <span>Aan het oefenen: {current.practicing ? 'aan' : 'uit'}</span>
      </button>
    {:else if songs.length === 0}
      <div class="empty">
        <p>Nog geen nummers in je lijst.</p>
        <button class="primary" onclick={() => setScreen('list')}>
          Voeg je eerste nummer toe
        </button>
      </div>
    {/if}
  </div>

  {#if current}
    <footer class="actions">
      <button class="skip" onclick={onSkip}>⏭ Skip</button>
      <button class="primary big" onclick={onNext}>✓ Klaar — Volgende</button>
    </footer>
  {/if}
</section>

<style>
  .play {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
  }
  .topbar {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .profile {
    background: transparent;
    border: none;
    padding: 0.25rem 0.5rem;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-weight: 600;
    color: var(--text);
  }
  .caret {
    color: var(--muted);
    font-size: 0.85rem;
  }
  .menu {
    background: transparent;
    border: none;
    font-size: 1.4rem;
    padding: 0.25rem 0.5rem;
  }
  .stage {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem 1.25rem;
    text-align: center;
    gap: 0.5rem;
  }
  .title {
    font-size: 2rem;
    font-weight: 700;
    line-height: 1.15;
  }
  .composer {
    color: var(--muted);
    font-size: 1.1rem;
  }
  .notes {
    margin-top: 0.75rem;
    color: var(--muted);
    font-style: italic;
    max-width: 30rem;
    white-space: pre-wrap;
  }
  .practicing-toggle {
    margin-top: 1.5rem;
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text);
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 1rem;
    font-size: 0.95rem;
    border-radius: 999px;
  }
  .practicing-toggle[aria-pressed='true'] {
    border-color: var(--primary);
    color: var(--primary);
  }
  .practicing-toggle .star {
    font-size: 1.1rem;
  }
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    color: var(--muted);
  }
  .actions {
    padding: 1.25rem;
    padding-bottom: calc(1.25rem + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }
  .skip {
    background: transparent;
  }
  .big {
    padding: 1.15rem;
    font-size: 1.1rem;
  }
</style>
