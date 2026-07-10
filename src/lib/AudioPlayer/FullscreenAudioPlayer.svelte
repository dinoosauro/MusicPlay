<script lang="ts">
    import { onMount } from "svelte";
    import AudioManager from "../../ts/Player/AudioManager";
    import type { MetadataSource, UpdateContentProps } from "../../ts/Player/PlayerInterfaces";
    import ConvertSecondsInTimestamp from "../../ts/SvelteComponentsHelpers/ConvertSecondsInTimestamp";
    import type { syncedLyricsObj } from "../../ts/Database/DatabaseInterfaces";
    import LyricsPlayer from "./LyricsPlayer.svelte";
    import IconsManager from "../../ts/Icons/IconsManager";
    import type { OpacityChange, PopupScalingInfo } from "../../ts/Animations/AnimationTypes";
    import BackButton from "../BackButton.svelte";
    import { fullscreenObject } from "../../ts/Animations/CrossComponentAnimationsInfo";
    import { fade, slide } from "svelte/transition";
    import { cubicInOut } from "svelte/easing";
    import SleepTimer from "./SleepTimer.svelte";
    import FullscreenAlbumArtCrossfade from "../../ts/Animations/AlbumArtCrossfade";
    import DropdownButtonShow from "../DropdownMenu/DropdownButtonShow.svelte";
    import Queue from "./Queue.svelte";
    import LrcLibIntegration from "../../ts/DataFetcher/LrcLibIntegration";
    import IndexedDatabase from "../../ts/Database/IndexedDatabase";
    import Settings from "../../ts/Settings";
    import AutoRevokeUrl from "../../ts/SvelteComponentsHelpers/AutoRevokeUrl";
    import { lang } from "../../ts/SvelteComponentsHelpers/Language";
    import ChangePlaybackRate from "./ChangePlaybackRate.svelte";
    import ChangeVolume from "./ChangeVolume.svelte";
    import inputRangeStyle from "../../ts/SvelteComponentsHelpers/InputTypeRangeStyle";

    const { albumArt, imageTransitionCallback, skipHistoryUrlForFullscreenView, albumArtDb, metadataDb }: { 
        /**
         * The URL of the album art that should be displayed in full screen.
         */
        albumArt: string, 
        /**
         * If true, the fullscreen player won't add to the history URL the "#fullscreen" url
         */
        skipHistoryUrlForFullscreenView?: boolean, 
        /**
         * The database where the component can fetch album arts
         */
        albumArtDb: IDBDatabase, 
        /**
         * Function called when the user closes the fullscreen window. Its goal is to create the image transition
         * @param img the image element of the fullscreen album art
         * @param opacityChange a list of all the elements whose opacity should be changed
         */
        imageTransitionCallback: (img: HTMLImageElement, opacityChange: OpacityChange[]) => void, 
        /**
         * The database where the componenet can fetch new metadata
         */
        metadataDb: IDBDatabase 
    } = $props();
    /**
     * The visibile album art (not the background one)
     */
    let permanentImg: HTMLImageElement;
    /**
     * The heading element that displays the title
     */
    let songTitle: HTMLHeadingElement;
    /**
     * Secondary metadata
     */
    let songArtists: HTMLHeadingElement;
    /**
     * If true, the slider won't be updated when the AudioManager will send new currentTime events.
     * This is currently used so that the user can change the playback value
     */
    let blockProgressUpdate = false;
    /**
     * Unlike what the name suggests, it's the range element that permits to change the playback position
     */
    let progress: HTMLInputElement;
    /**
     * Span that contains the number of seconds that have been played in the currently-playing songs
     */
    let secondsLabel: HTMLSpanElement;
    /**
     * Span that contains the duration of the currently-playing song.
     */
    let durationLabel: HTMLSpanElement;
    /**
     * The play/pause icon
     */
    let playIcon: HTMLImageElement;
    /**
     * If the application has completed the image transition from the metadata viewer to the fullscreen window
     */
    let isImageTransitionDone = false;
    /**
     * The initial album art, as a value that isn't refreshed automatically. 
     * This is done since updates to the album art are done only by the AudioManager callback, so that we can apply a crossfade animation when the user changes track
     */
    let initAlbumArt = albumArt;
    
    /**
     * The currently-available lyrics
     */
    let currentLyrics = $state<string | syncedLyricsObj[] | undefined>(
        AudioManager.currentMetadata?.metadata.syncedLyrics.length !== 0
            ? AudioManager.currentMetadata?.metadata.syncedLyrics
            : AudioManager.currentMetadata?.metadata.embeddedLyrics,
    );
    /**
     * If lyrics are available
     */
    let availableLyrics = $state((typeof currentLyrics === "string" && currentLyrics.trim() !== "") || (typeof currentLyrics === "object" && currentLyrics.length !== 0))
    /**
     * If the application should display lyrics
     */
    let showLyricsPlayer = $derived(window.innerWidth > 800 && availableLyrics);
    /**
     * If the user has clicked on its own to the lyrics player button. This means that they're interested to seeing the lyrics, and therefore the lyrics player should be opened even if it can't be displayed alongside the metadata
     */
    let hasUserClickedOnLyricsPlayerButton = false;
    /**
     * If the queue should be shown
     */
    let showQueue = $state(false);
    /**
     * If the request to LRCLib of the lyrics has already been done
     */
    let alreadyFetchedLrcLib = $state(false);
    /**
     * Get lyrics from LRCLib
     * @param tempMetadata the MetadataSource with the metadata used to get the new lyrics
     */
    async function fetchLyrics(tempMetadata: MetadataSource) {
        if (alreadyFetchedLrcLib) return tempMetadata.metadata.syncedLyrics.length !== 0 || tempMetadata.metadata.embeddedLyrics.trim() !== "";
        const lyrics = await LrcLibIntegration({metadata: tempMetadata});
        alreadyFetchedLrcLib = true;
        if (typeof lyrics === "string" || lyrics.length !== 0) { // Lyrics found
            currentLyrics = lyrics;
            if (typeof lyrics === "string") {
                tempMetadata.metadata.embeddedLyrics = lyrics;
                if (AudioManager.currentMetadata) AudioManager.currentMetadata.metadata.embeddedLyrics = lyrics;
            } else {
                tempMetadata.metadata.syncedLyrics = lyrics;
                if (AudioManager.currentMetadata) AudioManager.currentMetadata.metadata.syncedLyrics = lyrics;
            }
                IndexedDatabase.set({db: metadataDb, object: {id: tempMetadata.trackId, data: tempMetadata.metadata}, request: "musicMetadata"});
                availableLyrics = true;
            } else { // Lyrics not found
                if (tempMetadata.trackId === AudioManager.currentMetadata?.trackId) {
                    alreadyFetchedLrcLib = true;
                    lyricsButton.disabled = false;
                }
            return false;
        }
        return true;
    }
    /**
     * This functon permits to open and close either the queue or the lyrics (the "right section", since they're displayed at the right of the metadata if there's enough space)
     * @param openRightDiv if the right div should be opened or not
     * @param openQueue if the queue should be opened instead of the lyrics. If not passed, lyrics will be opened.
     * @param addHistoryUrl if the script should add the "#lyrics" or the "#queue" url to the history session
     */
    async function openRightSectionOfFullscreen(openRightDiv: boolean, openQueue?: boolean, addHistoryUrl?: boolean) {
        // Let's first start by checking if we're changing between the two sections. In this case, we'll wait for an opacity transition
        if ((openQueue && availableLyrics && showLyricsPlayer) || (showQueue && !openQueue)) {
            rightDivContainer.style.opacity = "0";
            await new Promise(res => setTimeout(res, 200));
        }
        const params = new URLSearchParams(window.location.hash.substring(1));
        const hash = params.get("appSection")
        // Now, let's add the URL to the history session if requested.
        if (addHistoryUrl && openRightDiv && hash !== (openQueue ? "queue" : "lyrics")) {
            params.set("appSection", openQueue ? "queue" : window.innerWidth > 800 ? "fullscreen" : "lyrics")
            window.history.pushState("", "", `./#${params.toString()}`);
        }
        // If the new div should be displayed (or hidden) at the right of the screen, we just need to change the variables, and Svelte will handle the opacity transitions.
        if (window.innerWidth > 800) { 
            if (openQueue) {
                showQueue = openRightDiv; 
                showLyricsPlayer = false;
            } else {
                showLyricsPlayer = openRightDiv;
                showQueue = false;
            }
            return;
        } 
        // This code will run only if there's enough width to open the div at the right. 
        if (openRightDiv) { // Since the controls container won't be visible in lyrics mode, let's apply an opacity transition
            controlsMainContainer.style.opacity = "0"; 
        } else if (rightDivContainer) { // Same thing as above: the right div will no longer be visible, so let's do an opacity transition
            rightDivContainer.style.opacity = "0";
        }
        await new Promise(res => setTimeout(res, 210));
        // Now, let's completely hide the two divs. Svelte will clean up them after we change the variables
        if (!openRightDiv && rightDivContainer) rightDivContainer.style.display = "none"; 
        if (openRightDiv) controlsMainContainer.style.display = "none";
        if (!openRightDiv) { // When we opened the right div, we didn't remove the controls div, instead we put it on the top of the controls container. Therefore, we need make it visible again
            controlsMainContainer.style.display = "";
            await new Promise(res => setTimeout(res, 10));
            controlsMainContainer.style.opacity = "1";
            await new Promise(res => setTimeout(res, 210));
        }
        if (rightDivContainer) rightDivContainer.style.opacity = "1";
        // And now, let's update the variables, so that Svelte can render the new components
        showLyricsPlayer = openRightDiv && !openQueue;
        showQueue = openRightDiv && !!openQueue;
    }
    $effect(() => {
        if ((showLyricsPlayer || showQueue) && isImageTransitionDone) { // Add a transition animation for the right div.
            setTimeout(() => {
                rightDivContainer.animate([{opacity: 0}, {opacity: 1}], {duration: 200, easing: "ease-in-out"});
                rightDivContainer.style.opacity = "1";
            }, 200)
        }
    })
    onMount(() => {
        if (!skipHistoryUrlForFullscreenView) {
            const params = new URLSearchParams(window.location.hash.substring(1));
            params.set("appSection", "fullscreen")
            window.history.pushState("", "", `./#${params.toString()}`);
        }
        fullscreenObject.lyrics.openRightSectionOfFullscreen = openRightSectionOfFullscreen;

        function resizeFn() { // Function called when the user resizes the window
            if (!hasUserClickedOnLyricsPlayerButton && !showQueue) showLyricsPlayer = window.innerWidth > 800; // If the user hasn't manaully opened or closed the lyrics view, let's check if it's time to open it again since there's enough space.
            if (window.innerWidth > 800 && (showLyricsPlayer || showQueue) && controlsMainContainer.style.display === "none") { // There's enough space to show both the controls div and the lyrics 
                controlsMainContainer.style.display = "";
                controlsMainContainer.style.opacity = "1";
            } 
            if (((showLyricsPlayer && hasUserClickedOnLyricsPlayerButton) || showQueue) && window.innerWidth <= 800 && controlsMainContainer.style.display !== "none") openRightSectionOfFullscreen(true, showQueue, true); // There isn't enough space to show both the divs, so we need to hide the controls view
            controlsMainContainer.classList[controlsMainContainer.scrollWidth > controlsMainContainer.clientHeight ? "remove" : "add"]("wcenter"); // If the height is to little to contain all of the controls, let's remove the vertically-centered property so that it's possible to scroll all the div
        }
        window.addEventListener("resize", resizeFn);
        controlsMainContainer.classList[controlsMainContainer.scrollWidth > controlsMainContainer.clientHeight ? "remove" : "add"]("wcenter"); // If the height is to little to contain all of the controls, let's remove the vertically-centered property so that it's possible to scroll all the div
        /**
         * Function called from the AudioManager when there's an event on the audio
         */
        function updateContent({
            title,
            author,
            albumArt,
            duration,
            currentTime,
            newAudioInstance,
            isPaused,
            lyrics,
        }: UpdateContentProps) {
            if (songTitle && typeof title !== "undefined")
                songTitle.textContent = title;
            if (songArtists && typeof author !== "undefined")
                songArtists.textContent = author;
            if (permanentImg && typeof albumArt !== "undefined") {
                const newUrl = URL.createObjectURL(albumArt);
                if (permanentImg.src) URL.revokeObjectURL(permanentImg.src);
                FullscreenAlbumArtCrossfade.triggerTransition({
                    albumArts: [permanentImg, albumArtBackground.firstChild as HTMLImageElement],
                    newSource: newUrl,
                });
            }
            if (duration) {
                if (progress) progress.max = duration.toString();
                if (durationLabel)
                    durationLabel.textContent =
                        ConvertSecondsInTimestamp(duration);
            }
            if (currentTime) {
                if (progress && !blockProgressUpdate) {
                    progress.value = currentTime.toString();
                    progress.dispatchEvent(new Event("change")); // Important: let's dispatch the "change" event so that the custom slider position is updated. We do not need to dispatch the "input" event since that would also update the song position to the current one, and this would cause an infinite loop.
                }
                if (secondsLabel)
                    secondsLabel.textContent =
                        ConvertSecondsInTimestamp(currentTime);
            }
            if (newAudioInstance && playIcon) IconsManager.updateIcon("pause", playIcon);
            if (typeof isPaused !== "undefined" && playIcon) IconsManager.updateIcon(isPaused ? "play" : "pause", playIcon);
            if (typeof lyrics !== "undefined") {
                alreadyFetchedLrcLib = false;
                if (lyrics === null || (typeof lyrics === "string" && lyrics.trim() === "") || (typeof lyrics === "object" && lyrics.length === 0)) {
                    availableLyrics = false;
                    showLyricsPlayer = false;
                    hasUserClickedOnLyricsPlayerButton = false;
                if (Settings.lyrics.useLrcLibByDefault) fetchLyrics(JSON.parse(JSON.stringify(AudioManager.currentMetadata)));
                } else availableLyrics = true;
                currentLyrics = lyrics ?? undefined;
                if (typeof lyrics === "string" && Settings.lyrics.useLrcLibIfLyricsArentSynced) fetchLyrics(JSON.parse(JSON.stringify(AudioManager.currentMetadata)));
            }
        }
        AudioManager.addToUpdateContent(updateContent);
        // Let's add to the fullscreenObject global object the two divs that can be used from the back event to trigger some animations
        fullscreenObject.fullscreenContent.container = container;
        fullscreenObject.fullscreenContent.image = permanentImg;
        if ((!availableLyrics && Settings.lyrics.useLrcLibByDefault) || (typeof currentLyrics === "string" && Settings.lyrics.useLrcLibIfLyricsArentSynced)) fetchLyrics(JSON.parse(JSON.stringify(AudioManager.currentMetadata)));

        // Let's tell the user they can go in fullscreen mode by clicking the image
        if (localStorage.getItem("MusicPlayer-FullscreenTipSeen") !== "a") {
            setTimeout(() => {
                alert(lang("Last tip: click on the album art to make the webpage fullscreen. Do the same to exit."));
                localStorage.setItem("MusicPlayer-FullscreenTipSeen", "a");
            }, 1000);
        }
        return () => {
            window.removeEventListener("resize", resizeFn);
            AudioManager.addToUpdateContent(updateContent, true);
            fullscreenObject.fullscreenContent.container = undefined;
            fullscreenObject.fullscreenContent.image = undefined;
            fullscreenObject.lyrics.openRightSectionOfFullscreen = undefined;
        };
    });
    /**
     * The blurred album art as the background image
     */
    let albumArtBackground: HTMLElement;
    /**
     * The div that contains all the album metadata and controls, but not the album art
     */
    let infoContainer: HTMLElement;
    /**
     * The container of the lyrics/queue div
     */
    let rightDivContainer: HTMLElement;
    /**
     * Container of the button to go back
     */
    let backButtonContainer: HTMLElement;
    /**
     * The main container of all the fullscreen object
     */
    let container: HTMLElement;
    /**
     * The container of all the controls section, including the unblurred album art
     */
    let controlsMainContainer: HTMLElement;
    /**
     * The button to show/hide lyrics
     */
    let lyricsButton: HTMLButtonElement;

</script>

<div class="mainBodyHover opacity ensureClickableElements" bind:this={container} style="z-index: 10; opacity: 1">
    <div
        bind:this={albumArtBackground}
        class="backgroundImage opacity"
        style="background-color: var(--background);"
    >
        <img src={initAlbumArt} alt="Background art" />
    </div>
    <div style="margin: 5px; position: fixed; z-index: 999" bind:this={backButtonContainer}>
        <BackButton></BackButton>
    </div>
    <div class="flex wrap gap dynamicFlex forceMaxHeight" style="padding: 15px; height: calc(100% - 30px); gap: 25px;">
            <div
                class="flex adaptiveFlex wcenter adaptiveHcenter gap opacity"
                style="flex-direction: column; opacity: 1;"
                bind:this={controlsMainContainer} 
            >
                <div
                    style="max-height: 40vh; display: flex"
                    class="flex wcenter"
                >
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                    <img
                        onclick={() => {
                            document.fullscreenElement ? document.exitFullscreen() : container.requestFullscreen();
                        }}
                        onload={async (e) => {
        !isImageTransitionDone && await imageTransitionCallback(e.target as HTMLImageElement, [
            {
                element: albumArtBackground,
                opacityChange: "start",
            },
            {
                element: e.target as HTMLImageElement,
                opacityChange: "end",
            },
            {
                element: infoContainer,
                opacityChange: "end",
            }, {
                element: backButtonContainer.firstChild as HTMLElement,
                opacityChange: "start"
            }, ...(rightDivContainer ? [{element: rightDivContainer, opacityChange: "end" as "end"}] : [])
        ])
        isImageTransitionDone = true;
        }}
    onerror={async (e) => {
        !isImageTransitionDone && await imageTransitionCallback(e.target as HTMLImageElement, [
            {
                element: albumArtBackground,
                opacityChange: "start",
            },
            {
                element: e.target as HTMLImageElement,
                opacityChange: "end",
            },
            {
                element: infoContainer,
                opacityChange: "end",
            }, {
                element: backButtonContainer.firstChild as HTMLElement,
                opacityChange: "start"
            }, ...(rightDivContainer ? [{element: rightDivContainer, opacityChange: "end" as "end"}] : [])
        ])
        isImageTransitionDone = true;
        }}
                        src={initAlbumArt}
                        bind:this={permanentImg}
                        class="imgBoxShadow mainImageSize opacity hover"
                        style="border-radius: 12px; object-fit: cover;"
                        alt={lang("Album art")}
                    />
                </div>
                <div class="opacity" bind:this={infoContainer}>
                    <h2 bind:this={songTitle}>
                        {AudioManager.currentMetadata?.metadata.title}
                    </h2>
                    <p
                        style="font-size: 18px; margin-bottom: 10px;"
                        bind:this={songArtists}
                        class="secondaryMetadata"
                    >
                        {AudioManager.currentMetadata?.metadata.artist}
                    </p>
                    <div style="width: 100%;">
                        <input
                            class="maxWidth"
                            style="width: 100%;"
                            onmousedown={() => (blockProgressUpdate = true)}
                            onmouseup={() => (blockProgressUpdate = false)}
                            ontouchstart={() => (blockProgressUpdate = true)}
                            ontouchend={() => (blockProgressUpdate = false)}
                            defaultValue={AudioManager.audio?.currentTime}
                            max={AudioManager.audio?.duration}
                            onchange={() => {
                            }}
                            bind:this={progress}
                            type="range"
                            use:inputRangeStyle={() => {
                                const audio =
                                    AudioManager.audio as HTMLAudioElement;
                                audio.currentTime = +progress.value;
                            }}
                            step="0.001"
                        />
                        <span style="float: left;" bind:this={secondsLabel}>{ConvertSecondsInTimestamp(AudioManager.audio?.currentTime ?? 0)}</span>
                        <span style="float: right" bind:this={durationLabel}>{ConvertSecondsInTimestamp(AudioManager.audio?.duration ?? 0)}</span>
                    </div><br>
                <div class="flex wcenter gap">
                    <button class="emptyButton" title={lang("Enable/disable shuffle")} onclick={(e) => {
                        AudioManager.audioContext.shuffle = !AudioManager.audioContext.shuffle;
                        const img =( (e.target as HTMLElement)?.firstChild ?? e.target) as HTMLImageElement;
                        if (img) img.src = IconsManager.getIconObjectUrl(AudioManager.audioContext.shuffle ? "shuffle" : "shuffleoff");
                    }}>
                        <img class="icon" use:AutoRevokeUrl src={IconsManager.getIconObjectUrl(AudioManager.audioContext.shuffle ? "shuffle" : "shuffleoff")} alt={lang("Enable/disable shuffle")}>
                    </button>
                    <button class="emptyButton" onclick={() => AudioManager.prevButton()} title={lang("Previous track")}>
                        <img class="icon" use:AutoRevokeUrl src={IconsManager.getIconObjectUrl("prev")} alt={lang("Previous track")}>
                    </button>
                    <button class="emptyButton" title={lang("Play/pause")} onclick={() => {
                        const audio = (AudioManager.audio as HTMLAudioElement);
                        audio[audio.paused ? "play" : "pause"]();
                        IconsManager.updateIcon(audio.paused ? "play" : "pause", playIcon);                
                    }}>
                        <img class="icon" use:AutoRevokeUrl bind:this={playIcon} src={IconsManager.getIconObjectUrl(AudioManager.audio?.paused ? "play" : "pause")} alt={lang("Play/pause")}>
                    </button>
                    <button class="emptyButton" onclick={() => AudioManager.nextButton()} title={lang("Next track")}>
                        <img class="icon" use:AutoRevokeUrl src={IconsManager.getIconObjectUrl("next")} alt={lang("Next track")}>
                    </button>
                    <button class="emptyButton" title={lang("Toggle between loop options")} onclick={(e) => {
                        AudioManager.audioContext.repeat = AudioManager.audioContext.repeat === "none" ? "loop" : AudioManager.audioContext.repeat === "loop" ? "loopSingle" : "none";
                        const img =( (e.target as HTMLElement)?.firstChild ?? e.target) as HTMLImageElement;
                        if (img) img.src = IconsManager.getIconObjectUrl(AudioManager.audioContext.repeat === "none" ? "repeatalloff" : AudioManager.audioContext.repeat === "loop" ? "repeatall" : "repeat1");
                    }}>
                        <img class="icon" use:AutoRevokeUrl src={IconsManager.getIconObjectUrl(AudioManager.audioContext.repeat === "none" ? "repeatalloff" : AudioManager.audioContext.repeat === "loop" ? "repeatall" : "repeat1")} alt={lang("Toggle between loop options")}>
                    </button>
            </div>
            <div class={`flex wcenter gap dynamicMarginBottom${showLyricsPlayer ? " dynamicMarginLyrics" : ""}`}>
                {#if availableLyrics || !alreadyFetchedLrcLib}
                        <button bind:this={lyricsButton} class="emptyButton" title={lang("Show/hide lyrics")} onclick={async () => {
                            let tempMetadata = !AudioManager.currentMetadata ? undefined : JSON.parse(JSON.stringify(AudioManager.currentMetadata)) as MetadataSource; // Create a new metadata object
                            /**
                             * If the lyrics fetched were from LRCLib.
                             */
                            let fetchingFromLrcLib = false;
                            if (tempMetadata && typeof currentLyrics === "string" && Settings.lyrics.useLrcLibIfLyricsArentSynced) await fetchLyrics(tempMetadata);
                            if (!availableLyrics && !alreadyFetchedLrcLib && tempMetadata) {
                                if (!Settings.lyrics.useLrcLibByDefault && !confirm(lang("No lyrics were uploaded for this track. Do you want to fetch them online? Some metadata will be shared with LRCLib."))) return;
                                lyricsButton.disabled = true; // Avoid multiple fetch requests
                                fetchingFromLrcLib = true;
                                if (!await fetchLyrics(tempMetadata)) {
                                    return;
                                }
                                alreadyFetchedLrcLib = true;
                                lyricsButton.disabled = false;
                            }

                            hasUserClickedOnLyricsPlayerButton = true; // Let's mark that the user has manually opened the lyrics, so that they'll remain open even if the user resizes the window
                            openRightSectionOfFullscreen(fetchingFromLrcLib ? showLyricsPlayer : !showLyricsPlayer, undefined, true);
                        }}>
                        <img class="icon" use:AutoRevokeUrl src={IconsManager.getIconObjectUrl(showLyricsPlayer ? "micoff" : "mic")} alt={lang("Show/hide lyrics")}>
                    </button>
                {/if}
                <button class="emptyButton" title={lang("Show/hide queue")} onclick={() => {
                    openRightSectionOfFullscreen(!showQueue, true, true);
                }}>
                    <img class="icon" use:AutoRevokeUrl src={IconsManager.getIconObjectUrl("list")} alt={lang("Show/hide queue")}>
                </button>
                <DropdownButtonShow placeholderIcon="timer" iconAlt={lang("Enable/disable sleep timer")}>
                      {#snippet children(scaleInfo: PopupScalingInfo)}
                        <SleepTimer {scaleInfo}></SleepTimer>
                      {/snippet}
                </DropdownButtonShow>
                <DropdownButtonShow placeholderIcon="speaker2" iconAlt={lang("Change volume")}>
                    {#snippet children(scaleInfo: PopupScalingInfo)}
                        <ChangeVolume {scaleInfo}></ChangeVolume>
                    {/snippet}
                </DropdownButtonShow>
                <DropdownButtonShow placeholderIcon="topspeed" iconAlt={lang("Change playback speed")}>
                    {#snippet children(scaleInfo: PopupScalingInfo)}
                        <ChangePlaybackRate {scaleInfo}></ChangePlaybackRate>
                    {/snippet}
                </DropdownButtonShow>
            </div>
        </div>
    </div>
    {#if (availableLyrics && showLyricsPlayer) || showQueue}
        <div bind:this={rightDivContainer} class="opacity" out:fade={{duration: 200, easing: cubicInOut}} in:fade={{duration: 200, easing: cubicInOut}}>
                    {#if availableLyrics && showLyricsPlayer}
                    <div>
                        <LyricsPlayer lyrics={currentLyrics}></LyricsPlayer>
                    </div>
                    {:else}
                    <div>
                        <Queue {albumArtDb}></Queue>
                    </div>
                    {/if}
                </div>
            {/if}
            
        </div>
</div>

<style>
    h2,
    p {
        padding: 0px 25px;
        margin-bottom: 0px;
        text-align: center;
    }
    .dynamicMarginBottom {
        margin-top: 15px;
    }
    .forceMaxHeight {
        max-height: calc(100vh - 100px);
        margin-top: 50px;
    }
    .forceMaxHeight > div {
        height: 100%;
        overflow: auto;
    }
    @media (max-width: 800px) {
        .forceMaxHeight {
            max-height: calc(100vh - 50px);
            margin-top: 0px;
        }
    }

</style>

