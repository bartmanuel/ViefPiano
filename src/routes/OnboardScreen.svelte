<script>
  import { createProfile } from '../stores/app.svelte.js';

  let name = $state('');

  function submit(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    createProfile(trimmed);
  }
</script>

<section class="onboard">
  <div class="card">
    <div class="emoji">🎹</div>
    <h1>ViefPiano</h1>
    <p class="sub">Welkom! Wat is je naam?</p>

    <form onsubmit={submit}>
      <input type="text" bind:value={name} placeholder="Bijv. Bart" />
      <button type="submit" class="primary" disabled={!name.trim()}>Beginnen</button>
    </form>

    <p class="tip">
      Je gegevens blijven lokaal op dit apparaat. Je kunt later meer profielen
      toevoegen en je lijst als JSON exporteren.
    </p>
  </div>
</section>

<style>
  .onboard {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    min-height: 100dvh;
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 24rem;
    width: 100%;
    text-align: center;
  }
  .emoji {
    font-size: 3rem;
  }
  h1 {
    margin: 0;
  }
  .sub {
    color: var(--muted);
    margin: 0;
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }
  .tip {
    color: var(--muted);
    font-size: 0.85rem;
    margin-top: 1rem;
    line-height: 1.5;
  }
</style>
