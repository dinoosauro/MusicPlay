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
