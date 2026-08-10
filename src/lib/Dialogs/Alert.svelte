<script lang="ts">
    import { onMount } from "svelte";
    import { cubicInOut } from "svelte/easing";
    import { fade } from "svelte/transition";
    import AutoRevokeUrl from "../../ts/SvelteComponentsHelpers/AutoRevokeUrl";
    import IconsManager from "../../ts/Icons/IconsManager";
    import { lang } from "../../ts/SvelteComponentsHelpers/Language";
    let {title, closeCallback}: {title: string, closeCallback: () => void} = $props();
    let isVisible = $state(true);
    onMount(() => {
        setTimeout(() => { // Hide the alert automatically
            if (isVisible) {
                isVisible = false;
                setTimeout(closeCallback, 210);
            }
        }, 5000)
        setTimeout(() => (main.style.opacity = "1"), 15);
    })
    let main: HTMLElement;
</script>
{#if isVisible}
    <div class="topDialog flex wcenter opacity" bind:this={main} style="z-index: 25;">
        <div in:fade={{duration: 200, easing: cubicInOut}} out:fade={{duration: 200, easing: cubicInOut}} style="pointer-events: all;">
            <div class="flex hcenter">
                <p style="width: 100%;">{title}</p>
                <button class="emptyButton" style="width: fit-content;" onclick={() => {
                    if (isVisible) {
                        isVisible = false;
                        setTimeout(closeCallback, 210);
                    }
                }}>
                    <img class="icon" use:AutoRevokeUrl src={IconsManager.getIconObjectUrl("dismiss")} alt={lang("Close alert")}>
                </button>
            </div>
        </div>
    </div>
{/if}
