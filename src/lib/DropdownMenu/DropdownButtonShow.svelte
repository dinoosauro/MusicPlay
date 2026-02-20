<script lang="ts">
    import { onMount } from "svelte";
    import DropdownAnimation from "../../ts/Animations/DropdownAnimation";
    import IconsManager from "../../ts/Icons/IconsManager";
    import IconsSource from "../../ts/Icons/IconsSource";
    import appendToBody from "../../ts/SvelteComponentsHelpers/AppendToBody";
    import AutoRevokeUrl from "../../ts/SvelteComponentsHelpers/AutoRevokeUrl";

    let {
        placeholderIcon,
        iconAlt,
        children,
    }: {
        /**
         * The icon that, if clicked, will show the children
         */
        placeholderIcon: keyof typeof IconsSource;
        /**
         * Description of the icon
         */
        iconAlt: string;
        children: any;
    } = $props();
    /**
     * Position of the button in the DOM when the element was clicked
     */
    let showDropdown = $state<
        { left: number; right: number; top: number; bottom: number } | undefined
    >();
    let position:
        | {
            /**
             * The property to add in the CSS in the container of the expanded content, so that it's on top of the other elements, and it doesn't overflow
             */
              css: string;
              /**
               * The origin of the scaling animation
               */
              scaling: string;
              /**
               * Maximum width and height
               */
              limits: string
          }
        | undefined = $derived(getPosition());
    let enableBtn: HTMLButtonElement;
    function getPosition() {
        if (!showDropdown) return;
        let [left, top] = ["", ""];
        let [limitWidth, limitHeight] = ["", ""];
        if (showDropdown.top > window.innerHeight / 2) {
            top = `bottom: ${window.innerHeight - showDropdown.bottom}px`;
            limitHeight = `max-height: ${window.innerHeight - (window.innerHeight - showDropdown.bottom) - 50}px`;
        } else {
            top = `top: ${showDropdown.top}px`;
            limitHeight = `max-height: ${window.innerHeight - showDropdown.top - 50}px`;
        }
        if (showDropdown.left > window.innerWidth / 2) {
            left = `right: ${window.innerWidth - showDropdown.right}px`;
            limitWidth = `max-width: ${window.innerWidth - (window.innerWidth - showDropdown.right) - 50}px`;
        } else {
            left = `left: ${showDropdown.left}px`;
            limitWidth = `max-width: ${window.innerWidth - showDropdown.left - 50}px`
        }
        return {
            css: `${top}; ${left}`,
            scaling: `${showDropdown.top > window.innerHeight / 2 ? "bottom" : "top"} ${showDropdown.left > window.innerWidth / 2 ? "right" : "left"}`,
            limits: `${limitWidth}; ${limitHeight}`
        };
    }
    onMount(() => {
        function resizeFn() {
            if (showDropdown) showDropdown = enableBtn.getBoundingClientRect();
        }
        window.addEventListener("resize", resizeFn);
        return () => {
            window.removeEventListener("resize", resizeFn);
        }
    });
    let container: HTMLElement;
</script>

<button
    class="emptyButton flex hcenter"
    style="padding-top: 0px; padding-bottom: 0px; display: flex"
    bind:this={enableBtn}
    title={iconAlt}
    onclick={() => {
        const stats = enableBtn.getBoundingClientRect();
        showDropdown = stats;
    }}
>
    <img use:AutoRevokeUrl src={IconsManager.getIconObjectUrl(placeholderIcon)} alt={iconAlt} />
</button>
{#if showDropdown}
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div style="position: fixed; width: 100vw; height: 100vh; z-index: 20; top: 0; left: 0" use:appendToBody onclick={async (e) => { // This div is added so that, by clicking outside the dialog content, the user can close the pop-up dialog
    if (e.target !== container.parentElement) return;
    await DropdownAnimation.triggerAnimation(container, true, position?.scaling as string);
    showDropdown = undefined;
}}>
    <div
        bind:this={container}
        style={`position: absolute; overflow: auto; ${position?.css}; overflow: auto`}
    >
        {@render children({
            closeCallback: () => {
                showDropdown = undefined;
            },
            scaling: position?.scaling,
            limits: position?.limits
        })}
    </div>
</div>
{/if}
