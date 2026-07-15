<script lang="ts">
    import { cubicInOut } from "svelte/easing";
    import { fade } from "svelte/transition";
    import { lang } from "../../ts/SvelteComponentsHelpers/Language";
    import { onMount } from "svelte";

    const {name}: {name: string} = $props();
    let main: HTMLElement;
    onMount(() => {
        setTimeout(() => {
            main.style.opacity = "1";
        }, 25);
    })
</script>

<div class="topDialog flex wcenter opacity" bind:this={main}>
    <div in:fade={{duration: 200, easing: cubicInOut}} out:fade={{duration: 200, easing: cubicInOut}}>
        <p>{lang("Fetching lyrics of")} {name} {lang("on LRCLib")}.</p>
    </div>
</div>

<style>
    .topDialog {
        position: fixed;
        top: 5vh;
        z-index: 15;
        border-radius: 16px;
        width: 100vw;
        left: 0;
        pointer-events: none;
    }
    .topDialog > div {
        padding: 15px;
        backdrop-filter: blur(16px) brightness(40%);
        max-width: 70vw;
        border-radius: 12px;
        border: 1px solid var(--text);
    }
</style>