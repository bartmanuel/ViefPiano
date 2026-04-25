<script>
  import { app } from './stores/app.svelte.js';
  import OnboardScreen from './routes/OnboardScreen.svelte';
  import PlayScreen from './routes/PlayScreen.svelte';
  import ListScreen from './routes/ListScreen.svelte';
  import ProfileScreen from './routes/ProfileScreen.svelte';
</script>

{#if app.screen === 'onboard' || !app.activeProfileId}
  <OnboardScreen />
{:else if app.screen === 'list'}
  <ListScreen />
{:else if app.screen === 'profiles'}
  <ProfileScreen />
{:else}
  <PlayScreen />
{/if}
