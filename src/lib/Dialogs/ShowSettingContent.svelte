<script lang="ts">
    import { cubicInOut } from "svelte/easing";
    import { slide } from "svelte/transition";

    const {title, currentState, suggestedState, updateState, children}: {
        /**
         * The text that should be displayed in the h4
         */
        title: string,
        /**
         * The currently-opened setting tab ID
         */
        currentState: string,
        /**
         * The ID of this setting tab
         */
        suggestedState: string,
        /**
         * Function used to update the State
         * @param state the ID passed to this function
         */
        updateState: (state: string) => void,
        children: any
    } = $props();
    /**
     * The div that is created only if the tab has been expanded
     */
    let div = $state<HTMLDivElement | undefined>();
    /**
    * Container of everything (also the title) 
    */
    let mainContainer: HTMLDivElement;
    $effect(() => {
        if (div) {
            setTimeout(() => {
                const dialog = mainContainer.closest(".dialog")?.firstChild as HTMLElement | undefined;
                dialog?.scrollTo({top: dialog.scrollTop + mainContainer.getBoundingClientRect().top - (window.innerHeight * 10 / 100) - 20, behavior: "smooth"});
            }, 300)
        }
    })
</script>


<div bind:this={mainContainer}>
    <button class="emptyButton textContainer" style={currentState === suggestedState ? "margin-bottom: 0px" : ""} onclick={() => (updateState(currentState === suggestedState ? "" : suggestedState))}>
        <h4><div>{title}</div> <span style={currentState === suggestedState ? "transform: rotate(-90deg)" : undefined}>◀</span></h4>
    </button>
    {#if currentState === suggestedState}
        <div style="margin: 0px 5px;" in:slide={{duration: 300, easing: cubicInOut}} out:slide={{duration: 300, easing: cubicInOut}} bind:this={div}>
            {@render children()}
        </div>
    {/if}
</div>

<style>
    .textContainer {
        width: 100%;
        text-align: left;
        padding: 0px 5px;
        margin: 0;
    }
    .textContainer span {
        float: right;
        transition: transform 0.2s ease-in-out;
    }
    .textContainer h4 {
        display: flex;
        gap: 10px;
        margin: 10px 0px;
        display: flex;
        align-items: center;
    }
    .textContainer div {
        width: 100%;
    }
</style>