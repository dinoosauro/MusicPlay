<script lang="ts">
    import { onMount } from "svelte";
    import type { DatabaseContainer, syncedLyricsObj } from "../../ts/Database/DatabaseInterfaces";
    import AudioManager from "../../ts/Player/AudioManager";
    import type { MetadataSource, UpdateContentProps } from "../../ts/Player/PlayerInterfaces";
    import IconsManager from "../../ts/Icons/IconsManager";
    import { fade, slide } from "svelte/transition";
    import { cubicInOut } from "svelte/easing";
    import AutoRevokeUrl from "../../ts/SvelteComponentsHelpers/AutoRevokeUrl";
    import { lang } from "../../ts/SvelteComponentsHelpers/Language";
    import GetGroupingRegex from "../../ts/DataFetcher/GetGroupingRegex";
    import ArtistImageManager from "../../ts/DataFetcher/ArtistImageManager";
    import ArtistEditor from "../MetadataEditor/ArtistEditor.svelte";
    import IndexedDatabase from "../../ts/Database/IndexedDatabase";
    import AddLongPressEvent from "../../ts/SvelteComponentsHelpers/AddLongPressEvent";
    import Settings from "../../ts/Settings";

    let { lyrics, customHeight, artistDb, metadataDb }: { lyrics?: syncedLyricsObj[] | string, customHeight?: string, artistDb: IDBDatabase, metadataDb: IDBDatabase } = $props();
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
        isFirstItem?: boolean,
        /**
         * The number that identifies the artist that is singing
         */
        artistNumber?: number,
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
     * A list of the elements that have an ongoing animation
     */
    let currentAnimationElement = new Set<HTMLElement>();
    /**
     * If not undefined, the name of the artist the user wants to change the icon.
     */
    let changeArtistsAlbumArt = $state<string | undefined>();
    /**
     * Random value to force reloading the artist image, if displayed
     */
    let forceImageReload = $state(Date.now());
    /**
     * A Map that contains all the fetched album arts of the artists that are singing this song
     */
    let cachedAlbumArt = new Map<string, string>();
    /**
     * Get the URL of the artist image, and cache the result
     * @param artist the name of the artist
     */
    async function getArtistImage(artist: string) {
        artist = artist.trim();
        const cache = cachedAlbumArt.get(artist);
        if (cache) return cache;
        const url = URL.createObjectURL(await ArtistImageManager.fetchImage({author: artist, artistImageDb: artistDb}));
        cachedAlbumArt.set(artist, url);
        return url;
    }
    /**
     * A list of all the artists that are currently singing. The `name` property is an array, already splitted using the grouping regex set by the user.
     */
    let displayedArtists = $state<{name: string[], id: number, trackId: string}[]>([]);
    /**
     * The `displayedArtists` object, updated after a few milliseconds so that an animation can run when the singing artist changes.
     */
    let displayedArtistsUsedByRenderer = $state<typeof displayedArtists>([]);
    /**
     * The container of the images of all the artists that are currently singing
     */
    let artistImgContainer: HTMLElement;
    /**
     * Slightly overlap the passed div to the previous image (if available)
     * @param item the image butotn to overlap
     */
    function updateDivSize(item: HTMLElement) {
        const arr = Array.from(artistImgContainer.children);
        const index = arr.indexOf(item);
        if (index === -1) return;
        const style = index === 0 ? "" : `translateX(calc(min(${3 * index}vw,${3 * index}vh) * -1))`;
        if (item.style.transform !== style) item.style.transform = style;
    }
    /**
     * Get the information used by this component to display the currently-singing artists
     * @param data the artist numbers
     */
    function getCurrentArtistInfo(data: number[]) {
        return Array.from(data.map((i) => { return {
            name: ((AudioManager.currentMetadata?.metadata.lyricsAuthorNames ?? [])[i] ?? `Artist ${i + 1}`).split(GetGroupingRegex()), 
            id: i,
            trackId: AudioManager.currentMetadata?.trackId as string
        }}))
    }
    onMount(() => {
        // Let's create an observer so that the width of the artist image container is updated every time its subtree is edited (by using translateX the width automatically assigned by the browser will be greater than what's actually used)
        const observer = new MutationObserver(() => {
            const wh = (artistImgContainer.children.length * 4) + 3;
            artistImgContainer.style.width = `max(min(${wh}vh, ${wh}vw), calc((${artistImgContainer.children.length} * (50px - min(3vh, 3vw))) + min(4vw, 4vh)))`;
        })
        observer.observe(artistImgContainer, {childList: true});
        const interval = setInterval(() => {
            let {currentTime, duration} = AudioManager.isFromiPhone ? AudioManager.audioInformation ?? {} : (AudioManager.audio as HTMLAudioElement); // If we're not using the iPhone crossfade mode, we can get the current time from the audio object, so that it'll always be updated 
            if (AudioManager.isFromiPhone) AudioManager.audio?.dispatchEvent(new Event("timeupdate")); // Update the current progress
            if (typeof currentTime === "undefined" || typeof duration === "undefined") return;
            currentTime *= 1000; // Update in ms
            /**
             * A list with all the offset of the currently-playing line. 
             * The application will scroll the webpage using as the `top` property the minimum value in this array, so that, if multiple lines are played at the same time, both will be displayed.
             */
            let offsetTopList = new Set<number>();
            /**
             * A list of all the authors that are currently singing
             */
            let authorsNumberList = new Set<number>();
            /**
             * The last time the `authorsNumberList` set was empty. If the set is empty for more than 250ms, also the UI will be updated so that no images are there.
             */
            let lastTimeEmptyAuthorsNumber: number | undefined;
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
                    offsetTopList.add(element.offsetTop);
                    if (data.isWord && currentTime > data.start && currentTime < data.end) { // We need to trigger the fill animation. We'll do it manually, by gradually updating the backgroundPosition value, so that we don't need to care about pauses made by the user.
                        if (currentAnimationElement.has(element)) {
                            const msDiff = data.end - data.start;
                            const msCurrent = data.end - currentTime;
                            element.style.backgroundPosition = `${100 + Math.round(msCurrent * 100 / msDiff)}%`;
                            if (typeof data.artistNumber !== "undefined") authorsNumberList.add(data.artistNumber);
                            continue; // Stop any other event
                        }
                        currentAnimationElement.add(element);
                        element.classList.add("lyricsAnimation", "currentLineColor");
                        element.style.backgroundPosition = "200%"; // This will make the text gray

                    } else { // Remove the lyricsAnimation object since we already passed to a new word, but still on the same line
                        currentAnimationElement.delete(element);
                        element.classList.remove("lyricsAnimation");
                        if (!isDifferentWordButSameLine && data.isWord) element.classList.remove("currentLineColor");
                    }
                if ((isDifferentWordButSameLine && currentTime > data.end) || !data.isWord) {
                    element.classList.add("currentLineColor"); // If the user changes the song current time by clicking the text
                }
                element.classList.add("currentLine");
            } 
            }
            if (authorsNumberList.size !== 0) {
                const nextArtists = getCurrentArtistInfo(Array.from(authorsNumberList));
                if (displayedArtists.length !== nextArtists.length || displayedArtists.some((a, i) => a.id !== nextArtists[i].id) || displayedArtists.some((a, i) => a.trackId !== nextArtists[i].trackId)) { // Let's update the state only if necessary
                    displayedArtists = nextArtists;
                }
            }
            if (offsetTopList.size !== 0 && !blockScroll) { // Scroll the container
                const min = Math.min(...offsetTopList);
                if (min !== container.scrollTop) {
                    if (authorsNumberList.size === 0) { // Let's wait 250ms before updating the UI
                        if (typeof lastTimeEmptyAuthorsNumber === "undefined") lastTimeEmptyAuthorsNumber = Date.now();
                        if ((Date.now() - lastTimeEmptyAuthorsNumber) > 250) {
                            displayedArtists = [];
                            lastTimeEmptyAuthorsNumber = undefined;
                        }
                    } else lastTimeEmptyAuthorsNumber = undefined;
                    disableBlockScrollListener = true;
                    container.scrollTo({top: Math.min(...offsetTopList), behavior: "smooth"});
                }
            }
        }, 10)
        return () => {
            clearInterval(interval);
            for (const [_, blob] of cachedAlbumArt) URL.revokeObjectURL(blob); 
            observer.disconnect();
        }
    });
    let container: HTMLDivElement;
    /**
     * The animation that is currently running on the artist image container
     */
    let isAnimationRunning: Animation | undefined;
    $effect(() => { // Run an animation every time the `displayedArtists` object changes. This animation runs in the middle of the UI updated (starts before, ends after)
        function registerComponents(_: any) {}
        registerComponents(displayedArtists);
        if (isAnimationRunning) isAnimationRunning.cancel();
        isAnimationRunning = artistImgContainer.animate([{opacity: 1}, {opacity: 0}], {duration: 300, easing: "ease-in-out"});
        artistImgContainer.style.opacity = "0";
        isAnimationRunning.onfinish = () => {
            displayedArtistsUsedByRenderer = displayedArtists;
            setTimeout(() => {
                isAnimationRunning = artistImgContainer.animate([{opacity: 0}, {opacity: 1}], {duration: 300, easing: "ease-in-out"});
                artistImgContainer.style.opacity = "1";
                isAnimationRunning.onfinish = () => {
                    isAnimationRunning = undefined;
                }
            }, 100)
        }
    })
    /**
     * If not undefined, the `[selected line, selected word]` by the user. The selection permits to change who is singing that part.
     */
    let lineToChange = $state<[syncedLyricsObj, syncedLyricsObj | undefined]>();
    /**
     * The artist name the user has written in the dialog displayed by the `lineToChange` variable
     */
    let newArtistName = "";
    /**
     * If the new artist name should be applied to the selected line or to the select word.
     */
    let applyLineChange = "line";
    /**
     * An array that contains only the artist numbers that actually appear in the lyrics.
     */
    let artistPosition = $derived(Array.from(new Set(typeof lyrics === "object" ? lyrics.map(i => i.words.length === 0 ? [i.artistNumber ?? 0] : i.words.map(j => j.artistNumber ?? 0)).flat() : [])).sort())
</script>

{#if lyrics}
<div style={`display: flex; flex-direction: column; position: relative;${customHeight ? ` height: ${customHeight}` : ""}`} class={typeof customHeight === "string" ? undefined : "dynamicHeight"}>
    <div class="flex hcenter gap wcenter" style={`min-height: min(7vw, 7vh); margin-bottom: 15px;${artistPosition.length < 2 ? " display: none" : ""}`}>
        {#key forceImageReload}
        <div class="flex hcenter" bind:this={artistImgContainer}>
            {#each displayedArtistsUsedByRenderer as artist, i (artist.id)}
            {#each artist.name as artistName (artistName)}
            {#await getArtistImage(artistName)}
            {:then img}
            <button class="emptyButton" use:updateDivSize style={`padding: 0;`} onclick={() => (changeArtistsAlbumArt = artistName)}>
                <img style={`border-radius: 50%; width: max(50px,min(7vw, 7vh)); height: max(50px,min(7vw, 7vh));`} src={img} alt={artistName}>
            </button>
            {/await}
            {/each}
            {/each}
        </div>
        {/key}
        <div>
            {#each displayedArtistsUsedByRenderer as artist, i (artist.id)}
            {i !== 0 ? ", " : ""}
            <button class="emptyButton" style="font-size: 18px; padding: 0; display: inline" onclick={async () => {
                const text = prompt(`${lang("Change the name of artist number")} ${artist.id + 1}`, artist.name.map(i => i.trim()).join(", "));
                if (text !== null) {
                    artist.name = text.split(GetGroupingRegex()).map(i => i.trim());
                    const metadata = AudioManager.currentMetadata?.trackId === artist.trackId ? AudioManager.currentMetadata : (AudioManager.previouslyPlayedTracks.find(i => i.trackId === artist.trackId) ?? AudioManager.audioContext.certainNextQueue.find(i => i.trackId === artist.trackId) ?? AudioManager.audioContext.queue.find(i => i.trackId === artist.trackId)); // Theoretically, the user might trigger the prompt function before the song changes, and the "OK" button after the song is changed. So we'll try to fetch the song also from the queue and the previously-played tracks
                    if (metadata) {
                        if (!metadata.metadata.lyricsAuthorNames) metadata.metadata.lyricsAuthorNames = [];
                        metadata.metadata.lyricsAuthorNames[artist.id] = text;
                        IndexedDatabase.set({db: metadataDb, object: {id: metadata.trackId, data: JSON.parse(JSON.stringify(metadata.metadata))}, request: "musicMetadata"});
                    }
                }
            }}>
                {artist.name.join(", ")}
            </button>
            {/each}
        </div>
    </div>
        <div style="overflow: auto; position: relative; min-height: 0" onscrollend={() => (disableBlockScrollListener = false)} onscroll={(e) => {
        if (!disableBlockScrollListener) blockScroll = true; 
    }} bind:this={container}>
            {#if typeof lyrics === "string"}
                <p
                    style={`overflow-wrap: anywhere;white-space: pre-line; text-align: ${Settings.lyrics.textAlignment !== "default" ? Settings.lyrics.textAlignment : "right"}; padding: 0px;`}
                >
                    {lyrics}
                </p>
            {:else if typeof lyrics === "object"}
                {#each lyrics as lyricsVerse, i}
                    {#if lyricsVerse.words.length !== 0}
                    <div data-linecontainer style={typeof lyricsVerse.artistNumber !== "undefined" ? `text-align: ${Settings.lyrics.textAlignment !== "default" ? Settings.lyrics.textAlignment : artistPosition.indexOf(lyricsVerse.artistNumber) % 3 === 0 ? "left" : artistPosition.indexOf(lyricsVerse.artistNumber) % 3 === 1 ? "right" : "center"}` : ""}>
                        {#each lyricsVerse.words as word, wordI}
                            {#key word.artistNumber}
                            <button
                                class="emptyButton" style="display: inline; margin: 0px; padding-left: 0px; padding-right: 3px;"
                                use:AddLongPressEvent={() => {
                                    newArtistName = (AudioManager.currentMetadata?.metadata.lyricsAuthorNames ?? [])[word.artistNumber ?? -1] ?? (AudioManager.currentMetadata?.metadata.lyricsAuthorNames ?? [])[lyricsVerse.artistNumber ?? 0] ?? "";
                                    lineToChange = [lyricsVerse, word];
                                }}
                                onclick={() => {
                                    AudioManager.audioInformation.updateCurrentTime(word.start / 1000 + 0.01);
                                }}
                                use:textVisibilityAnimation={{
                                    start: word.start,
                                    isFirstItem: wordI === 0,
                                    artistNumber: word.artistNumber ?? lyricsVerse.artistNumber,
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
                            {/key}
                            <span> </span>
                        {/each}
                        </div>
                    {:else}
                        {#key lyricsVerse.artistNumber}
                        <button
                            class="emptyButton maxWidth"
                            style={typeof lyricsVerse.artistNumber !== "undefined" ? `text-align: ${Settings.lyrics.textAlignment !== "default" ? Settings.lyrics.textAlignment : artistPosition.indexOf(lyricsVerse.artistNumber) % 3 === 0 ? "left" : artistPosition.indexOf(lyricsVerse.artistNumber) % 3 === 1 ? "right" : "center"}` : ""}
                            onclick={() => {
                                AudioManager.audioInformation.updateCurrentTime(lyricsVerse.start / 1000 + 0.01)
                            }}
                            use:AddLongPressEvent={() => {
                                newArtistName = (AudioManager.currentMetadata?.metadata.lyricsAuthorNames ?? [])[lyricsVerse.artistNumber ?? 0] ?? "";
                                lineToChange = [lyricsVerse, undefined];
                            }}
                            use:textVisibilityAnimation={{
                                start: lyricsVerse.start,
                                artistNumber: lyricsVerse.artistNumber,
                                end:
                                    typeof lyricsVerse.end !== "undefined" ? lyricsVerse.end :
                                    i + 1 !== lyrics.length
                                        ? lyrics[i + 1].start
                                        : -1,
                                isWord: false,
                            }}>{lyricsVerse.text.trim()}</button
                        >
                        {/key}
                    {/if}
                    <div style="height: 15px"></div>
                {/each}
                {#if !blockScroll}
                <div style={`height: 100vh;`} in:slide={{duration: 200, easing: cubicInOut}} out:slide={{duration: 200, easing: cubicInOut}}></div>
                {:else}
                <button class="emptyButton opacity flex hcenter wcenter circularButton" style="position: sticky; left: calc(100% - 15px); bottom: 15px; opacity: 1" onclick={() => {
                    blockScroll = false;
                    }} in:fade={{duration: 200, easing: cubicInOut}} out:fade={{duration: 200, easing: cubicInOut}} title={lang("Sync text to timestamp")}>
                    <img use:AutoRevokeUrl class="icon" src={IconsManager.getIconObjectUrl("micsync")} alt={lang("Sync text to timestamp")}>
                </button>
                {/if}
            {/if}
        </div>
    </div>
{/if}

{#if typeof changeArtistsAlbumArt !== "undefined"}
{#await getArtistImage(changeArtistsAlbumArt)}
{:then img}
<ArtistEditor artistImgDb={artistDb} artistAlbumArt={img} artistId={changeArtistsAlbumArt} closeCallback={(url) => {
    if (url) cachedAlbumArt.set(changeArtistsAlbumArt as string, url);
    changeArtistsAlbumArt = undefined;
    forceImageReload = Date.now();
}}></ArtistEditor>
{/await}
{/if}

{#if lineToChange}
<div class="topDialog flex wcenter" style="z-index: 25;">
    <div in:fade={{duration: 200, easing: cubicInOut}} out:fade={{duration: 200, easing: cubicInOut}} style="pointer-events: all;">
        <label class="flex hcenter gap">
            {lang("Who is singing this")} 
            {#if lineToChange[1]}
            <select style="width: fit-content;" bind:value={applyLineChange}>
                <option value="line">{lang("line")}:</option>
                <option value="word">{lang("word")}:</option>
            </select>
            {:else}
            line:
            {/if}
            <input type="text" bind:value={newArtistName}>
            <button style="width: fit-content" class="btn" onclick={() => {
                // Let's first look at the artist number tied to the name added by the user. If it's a new name, we'll add it to the artist list.
                let numId = (AudioManager.currentMetadata?.metadata.lyricsAuthorNames ?? []).indexOf(newArtistName.trim());
                if (numId === -1) {
                    if (!AudioManager.currentMetadata?.metadata.lyricsAuthorNames) (AudioManager.currentMetadata as MetadataSource).metadata.lyricsAuthorNames = [];
                    ((AudioManager.currentMetadata as MetadataSource).metadata.lyricsAuthorNames as string[])?.push(newArtistName.trim());
                    numId = ((AudioManager.currentMetadata as MetadataSource).metadata.lyricsAuthorNames as string[]).length - 1;
                    IndexedDatabase.set({db: metadataDb, object: {id: (AudioManager.currentMetadata as MetadataSource).trackId, data: JSON.parse(JSON.stringify((AudioManager.currentMetadata as MetadataSource).metadata))}, request: "musicMetadata"});
                }
                if (lineToChange && lineToChange[1] && applyLineChange === "word") {
                    lineToChange[1].artistNumber = numId;
                } else if (lineToChange) {
                    lineToChange[0].artistNumber = numId;
                    for (const word of lineToChange[0].words) word.artistNumber = numId;
                }
                lineToChange = undefined;
            }}>{lang("Apply")}</button>
        </label>
    </div>
</div>
{/if}

<style>
    .emptyButton {
        height: fit-content;
        text-align: left;
    }
</style>