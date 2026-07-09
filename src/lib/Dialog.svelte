<script lang="ts">
    import { cubicInOut } from "svelte/easing";
    import { fade, slide } from "svelte/transition";
    import appendToBody from "../ts/SvelteComponentsHelpers/AppendToBody";
    import { onMount } from "svelte";
    import HistoryHandler from "../ts/Player/HistoryHandler";
    const {closeFn}: {
        /**
         * Function called to close the dialog
         */
        closeFn: () => void
    } = $props();
    onMount(() => {
        const params = new URLSearchParams(window.location.hash.substring(1));
        params.set("appSection", "start")
        if (window.location.hash.length < 2) window.history.pushState("", "", `./#${params.toString()}`); // Since, if the user closes the dialog with the gesture, we'll go back two times, this permits to avoid going back to another completely differnt page
        HistoryHandler.closeCommand = closeFn;
        return () => (HistoryHandler.closeCommand = undefined);
    })
</script>
<div use:appendToBody class="dialog" in:fade={{duration: 200, easing: cubicInOut}} out:fade={{duration: 200, easing: cubicInOut}}>
    <div>
        <div>
            <slot></slot>
        </div>
    </div>
</div>

<style>
    .dialog {
        width: 100vw;
        height: 100vh;
        z-index: 15;
        position: fixed;
        top: 0;
        left: 0;
        backdrop-filter: blur(16px) brightness(40%);
    }
    .dialog > div {
        position: fixed;
        width: 70vw;
        height: 80vh;
        top: 10vh;
        left: 15vw;
        background-color: var(--card);
        overflow: scroll;
        border-radius: 12px;
    }
    .dialog > div > div {
        padding: 15px;
    }
</style>