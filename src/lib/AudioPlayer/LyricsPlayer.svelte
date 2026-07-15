<script lang="ts">
    import { onMount } from "svelte";
    import type { syncedLyricsObj } from "../../ts/Database/DatabaseInterfaces";
    import AudioManager from "../../ts/Player/AudioManager";
    import type { UpdateContentProps } from "../../ts/Player/PlayerInterfaces";
    import IconsManager from "../../ts/Icons/IconsManager";
    import { fade, slide } from "svelte/transition";
    import { cubicInOut } from "svelte/easing";
    import AutoRevokeUrl from "../../ts/SvelteComponentsHelpers/AutoRevokeUrl";
    import { lang } from "../../ts/SvelteComponentsHelpers/Language";

    let { lyrics, customHeight }: { lyrics?: syncedLyricsObj[] | string, customHeight?: string } = $props();
    interface LyricsAnimationInfo {
        start: number;
        end: number;
        isWord: boolean;
        /**
         * Property only for word-by-word lyrics. Indicates when the line starts
         */
        generalStart?: number;
        /**
         * Property only for word-by-word lyrics. Indicates when the line finishes
         */
        generalEnd?: number;
        /**
         * Property only for word-by-word lyrics. Indicates that this word is the first one of the phrase.
         */
        isFirstItem?: boolean
    }
    let lyricsMap = new Map<HTMLElement, LyricsAnimationInfo>([]);
    function textVisibilityAnimation(element: HTMLElement, info: LyricsAnimationInfo) {
        lyricsMap.set(element, info);
        return {
            destroy() {
                lyricsMap.delete(element);
            }
        };
    }
    /**
     * If autoscrolling should be blocked
     */
    let blockScroll = $state(false);
    /**
     * If true, the script won't listen to scroll callbacks. This is done so that automatically scrolling the div won't set the "blockScroll" property to true
     */
    let disableBlockScrollListener = false;
    /**
     * The element that has an ongoing animation
     */
    let currentAnimationElement: HTMLElement;
    /**
     * The element that has been used to get how much the application should scroll
     */
    let currentScrollElement: HTMLElement | undefined;
    onMount(() => {
        const interval = setInterval(() => {
            let {currentTime, duration} = AudioManager.audioInformation ?? {};
            if (typeof currentTime === "undefined" || typeof duration === "undefined") return;
            currentTime *= 1000; // Update in ms
            for (const [element, data] of lyricsMap) {
                // Let's first update some properties
                if (data.generalEnd === -1) data.generalEnd = duration * 1000; 
                if (data.end === -1) data.end = duration * 1000; 
                const isDifferentWordButSameLine = typeof data.generalStart !== "undefined" && typeof data.generalEnd !== "undefined" && currentTime > data.generalStart && currentTime < data.generalEnd;
                const isNotInRange = ((currentTime > data.start && currentTime > data.end) || (currentTime < data.start));

                if (isNotInRange && !isDifferentWordButSameLine) { // Remove all the styling applied, since it's not the line that is being played
                    element.classList.add("doneItem");
                    element.classList.remove("lyricsAnimation", "currentLine", "currentLineColor");
                    element.style.color = "";
                } else { // The element is at least in the same line as the currently-playing word
                    if (((isDifferentWordButSameLine && data.isFirstItem) || !data.isWord) && !blockScroll && currentScrollElement !== element) { // We found the new element to scroll to
                        currentScrollElement = element;
                        disableBlockScrollListener = true;
                        container.scrollTo({top: element.offsetTop, behavior: "smooth"});
                    }
                    if (data.isWord && currentTime > data.start && currentTime < data.end) { // We need to trigger the fill animation. We'll do it manually, by gradually updating the backgroundPosition value, so that we don't need to care about pauses made by the user.
                        if (currentAnimationElement === element) {
                            const msDiff = data.end - data.start;
                            const msCurrent = data.end - currentTime;
                            element.style.backgroundPosition = `${100 + Math.round(msCurrent * 100 / msDiff)}%`;
                            continue; // Stop any other event
                        }
                        currentAnimationElement = element;
                        element.classList.add("lyricsAnimation", "currentLineColor");
                        element.style.backgroundPosition = "200%"; // This will make the text gray

                    } else { // Remove the lyricsAnimation object since we already passed to a new word, but still on the same line
                        element.classList.remove("lyricsAnimation");
                        if (!isDifferentWordButSameLine && data.isWord) element.classList.remove("currentLineColor");
                    }
                if ((isDifferentWordButSameLine && currentTime > data.end) || !data.isWord) {
                    element.classList.add("currentLineColor"); // If the user changes the song current time by clicking the text
                }
                element.classList.add("currentLine");
            } 
            }
        }, 10)
        return () => {
            clearInterval(interval);
        }
    });
    let container: HTMLDivElement;
</script>

{#if lyrics}
    <div style={`overflow: auto; position: relative;${customHeight ? ` height: ${customHeight}` : ""}`} class={typeof customHeight === "string" ? undefined : "dynamicHeight"} onscrollend={() => (disableBlockScrollListener = false)} onscroll={(e) => {
        if (!disableBlockScrollListener) blockScroll = true; 
    }} bind:this={container}>
        {#if typeof lyrics === "string"}
            <p
                style="overflow-wrap: anywhere;white-space: pre-line; text-align: right; padding: 0px;"
            >
                {lyrics}
            </p>
        {:else if typeof lyrics === "object"}
            {#each lyrics as lyricsVerse, i}
                {#if lyricsVerse.words.length !== 0}
                <div data-linecontainer style={typeof lyricsVerse.artistNumber !== "undefined" ? `text-align: ${lyricsVerse.artistNumber % 3 === 0 ? "left" : lyricsVerse.artistNumber % 3 === 1 ? "right" : "center"}` : ""}>
                    {#each lyricsVerse.words as word, wordI}
                        <button
                            class="emptyButton" style="display: inline; margin: 0px; padding-left: 0px; padding-right: 3px;"
                            onclick={() => {
                                AudioManager.audioInformation.updateCurrentTime(word.start / 1000 + 0.01);
                                currentScrollElement = undefined;
                            }}
                            use:textVisibilityAnimation={{
                                start: word.start,
                                isFirstItem: wordI === 0,
                                end:
                                    typeof word.end !== "undefined" ? word.end :
                                    wordI + 1 !== lyricsVerse.words.length
                                        ? lyricsVerse.words[wordI + 1].start
                                        : i + 1 !== lyrics.length
                                          ? lyrics[i + 1].start
                                          : -1,
                                isWord: true,
                                generalStart: lyricsVerse.start,
                                generalEnd:
                                    typeof lyricsVerse.end !== "undefined" ? lyricsVerse.end :
                                    i + 1 !== lyrics.length
                                        ? lyrics[i + 1].start
                                        : -1,
                            }}>{word.text.trim()}</button
                        >
                        <span> </span>
                    {/each}
                    </div>
                {:else}
                    <button
                        class="emptyButton maxWidth"
                        style={typeof lyricsVerse.artistNumber !== "undefined" ? `text-align: ${lyricsVerse.artistNumber % 3 === 0 ? "left" : lyricsVerse.artistNumber % 3 === 1 ? "right" : "center"}` : ""}
                        onclick={() => {
                            AudioManager.audioInformation.updateCurrentTime(lyricsVerse.start / 1000 + 0.01)
                            currentScrollElement = undefined;
                        }}
                        use:textVisibilityAnimation={{
                            start: lyricsVerse.start,
                            end:
                                typeof lyricsVerse.end !== "undefined" ? lyricsVerse.end :
                                i + 1 !== lyrics.length
                                    ? lyrics[i + 1].start
                                    : -1,
                            isWord: false,
                        }}>{lyricsVerse.text.trim()}</button
                    >
                {/if}
                <div style="height: 15px"></div>
            {/each}
            {#if !blockScroll}
            <div style={`height: 100vh;`} in:slide={{duration: 200, easing: cubicInOut}} out:slide={{duration: 200, easing: cubicInOut}}></div>
            {:else}
            <button class="emptyButton opacity flex hcenter wcenter circularButton" style="position: sticky; left: calc(100% - 15px); bottom: 15px; opacity: 1" onclick={() => {
                blockScroll = false;
                currentScrollElement = undefined;
                }} in:fade={{duration: 200, easing: cubicInOut}} out:fade={{duration: 200, easing: cubicInOut}} title={lang("Sync text to timestamp")}>
                <img use:AutoRevokeUrl class="icon" src={IconsManager.getIconObjectUrl("micsync")} alt={lang("Sync text to timestamp")}>
            </button>
            {/if}
        {/if}
    </div>
{/if}


<style>
    .emptyButton {
        height: fit-content;
        text-align: left;
    }
</style>