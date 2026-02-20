<script lang="ts">
    import { scale, slide } from "svelte/transition";
    import IconsManager from "../../ts/Icons/IconsManager";
    import IconsSource from "../../ts/Icons/IconsSource";
    import { cubicInOut } from "svelte/easing";
    import AutoRevokeUrl from "../../ts/SvelteComponentsHelpers/AutoRevokeUrl";
    import { lang } from "../../ts/SvelteComponentsHelpers/Language";
    interface DropdownOptions {
        /**
         * The icon that'll be displayed at the left of the text
         */
        icon?: keyof typeof IconsSource;
        /**
         * The text that'll be displayed in the dropdown options
         */
        text: string;
        /**
         * The ID that'll be passed when the user clicks on the dropdown
         */
        id: string;
    }
    interface DropdownCategory {
        /**
         * Information about the main dropdown option. Note that the callback will always be fired, even if suboptions are later passed in the `categoryItems` object.
         */
        categoryInfo: DropdownOptions;
        /**
         * A list of suboptions, that'll be displayed if the user expands the list. If it's an empty array, the main dorpdown option won't have the expand symbol.
         */
        categoryItems: DropdownOptions[];
    }
    const {
        options,
        callback,
    }: { options: DropdownCategory[]; callback: (id: string) => void } =
        $props();
    /**
    * Position in the array of the opened item
    */
    let openedItem = $state(-1);
    let main: HTMLDivElement;
    /**
     * If the dropdown should be shown or not. This is usually set to false when the user clicked on a suboption, and the animation has been completed.
     */
    let showItems = $state(true);
</script>

<div bind:this={main} in:slide={{ duration: 200, axis: "x", easing: cubicInOut }}>
    {#if showItems}
    {#each options as option, i}
        <button
            class="emptyButton flex hcenter gap dropdownMenu maxWidth"
            style={`display: flex;${i === 0 ? "" : " margin-top: 10px;"}`}
            in:slide={{ duration: 400, easing: cubicInOut }}
            out:slide={{ duration: 400, easing: cubicInOut }}
            onclick={() => {
                if (option.categoryItems.length !== 0) openedItem = openedItem === i ? -1 : i; else callback(option.categoryInfo.id);

            }}
        >
        {#if option.categoryInfo.icon}
            <img
                use:AutoRevokeUrl
                alt={option.categoryInfo.text}
                style="width: 24px; height: 24px"
                src={IconsManager.getIconObjectUrl(option.categoryInfo.icon)}
            />
        {/if}
            <div style="white-space: normal" class="maxWidth">{option.categoryInfo.text}</div>
            {#if option.categoryItems.length !== 0}
                <img
                    use:AutoRevokeUrl
                    src={IconsManager.getIconObjectUrl("expand")}
                    alt={lang("Expand item")}
                    style={`transition: transform 0.2s ease-in-out;${i === openedItem ? " transform: rotate(180deg)" : ""}`}
                />
            {/if}
        </button>
        {#if i === openedItem}
            <div style="height: 10px;"></div>
            <div
                class="emptyButton flex hcenter gap secondDropdownMenu maxWidth"
                in:slide={{ duration: 400, easing: cubicInOut }}
                out:slide={{ duration: 400, easing: cubicInOut }}
                style="background: #21212151"
            >
                {#each option.categoryItems as suboption, i}
                    <div>
                        <button
                            onclick={() => {
                                main.style.overflow = "hidden";
                                const mainSize = main.getBoundingClientRect();
                                const animation = main.animate([{
                                    height: `${mainSize.height}px`,
                                    width: `${mainSize.width}px`
                                }, {
                                    height: `0px`,
                                    width: `0px`
                                }, ], {
                                    duration: 400,
                                    easing: "ease-in-out"
                                });
                                animation.addEventListener("finish", () => {
                                    showItems = false;
                                    callback(suboption.id);
                                })
                            }}
                            class="flex hcenter maxWidth gap hoverDropdown emptyButton"
                            style="position: relative; display: flex"
                        >
                            {#if suboption.icon}
                            <img
                                use:AutoRevokeUrl
                                alt={suboption.text}
                                style="width: 24px; height: 24px"
                                src={IconsManager.getIconObjectUrl(
                                    suboption.icon,
                                )}
                            />
                            {/if}
                            <div style="white-space: normal" class="maxWidth">{suboption.text}</div>
                        </button>
                        {#if option.categoryItems.length - 1 !== i}
                            <div style="height: 5px;"></div>
                        {/if}
                    </div>
                {/each}
            </div>
        {/if}
    {/each}
    {/if}
</div>

<style>
    .dropdownMenu,
    .secondDropdownMenu {
        border-radius: 18px;
        position: relative;
        padding: 5px 10px;
    }
    .secondDropdownMenu::before {
        backdrop-filter: blur(16px) brightness(250%);
        opacity: 1 !important;
    }
    .dropdownMenu::before,
    .secondDropdownMenu::before,
    .hoverDropdown::before {
        content: "";
        width: 100%;
        height: 100%;
        position: absolute;
        top: 0;
        left: 0;
        border-radius: 12px;
        opacity: 0;
        transition: opacity 0.2s ease-in-out;
    }
    .hoverDropdown {
        padding: 5px 10px;
    }
    .dropdownMenu:hover::before,
    .hoverDropdown:hover::before {
        backdrop-filter: brightness(200%) blur(32px) contrast(150%);
        opacity: 1;
    }
    .secondDropdownMenu::before {
        z-index: 1;
    }
    .hoverDropdown::before {
        z-index: 2;
    }
    div {
        white-space: nowrap;
    }
</style>
