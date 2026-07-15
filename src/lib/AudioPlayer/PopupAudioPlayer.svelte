<script lang="ts">
    import { mount, onDestroy, onMount } from "svelte";
    import type { MetadataSource, UpdateContentProps } from "../../ts/Player/PlayerInterfaces";
    import AudioManager from "../../ts/Player/AudioManager";
    import Icons from "../../ts/Icons/IconsManager";
    import ConvertSecondsInTimestamp from "../../ts/SvelteComponentsHelpers/ConvertSecondsInTimestamp";
    import { HandleMultipleTextOverflows } from "../../ts/SvelteComponentsHelpers/HandleTextOverflow";
    import {registerFloatingPlayerDiv} from "../../ts/SvelteComponentsHelpers/EmptySpace"
    import FullscreenAudioPlayer from "./FullscreenAudioPlayer.svelte";
    import { fullscreenObject } from "../../ts/Animations/CrossComponentAnimationsInfo";
    import AlbumArtCrossfade from "../../ts/Animations/AlbumArtCrossfade";
    import AutoRevokeUrl from "../../ts/SvelteComponentsHelpers/AutoRevokeUrl";
    import { lang } from "../../ts/SvelteComponentsHelpers/Language";
    import Settings from "../../ts/Settings";
    import { settingsUpdate } from "../../ts/SvelteComponentsHelpers/GlobalInformation";
    import inputRangeStyle from "../../ts/SvelteComponentsHelpers/InputTypeRangeStyle";
    import type { syncedLyricsObj } from "../../ts/Database/DatabaseInterfaces";
    import LyricsPlayer from "./LyricsPlayer.svelte";
    import { fade } from "svelte/transition";
    import { cubicInOut } from "svelte/easing";
    import GetAlbumArt from "../../ts/DataFetcher/GetAlbumArt";
    import GetAlbumArtId from "../../ts/DataFetcher/GetAlbumArtId";
    import OpenPictureInPictureMode from "../../ts/SvelteComponentsHelpers/OpenPictureInPictureMode";
    import LrcLibIntegration from "../../ts/DataFetcher/LrcLibIntegration";
    import IndexedDatabase from "../../ts/Database/IndexedDatabase";
    /**
     * The image that displays the currently-playing album art
     */
    let img: HTMLImageElement;
    /**
     * The heading that contains the track title
     */
    let titleContainer: HTMLHeadingElement;
    /**
     * Secodnary track metadata
     */
    let paragraphContainer: HTMLParagraphElement;
    /**
     * If an audio file is being played, and therefore controls button should be shown
     */
    let isAudioBeingPlayed = $state(false);
    /**
     * The icon to play/pause the track
     */
    let playIcon: HTMLImageElement;
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
     * If enabled, the text will be put at the bottom of the controls if there's little width
     */
    let isMiniMode = $state(Settings.miniPlayer.enableMiniMode);
    /**
     * If enabled, also the shuffle and the repeat buttons will be visible
     */
    let showAdvancedControls = $state(Settings.miniPlayer.showAdvancedControls);
    /**
     * If true, the slider won't be updated when the AudioManager will send new currentTime events.
     * This is currently used so that the user can change the playback value
     */
    let blockProgressUpdate = false;
    let {fullscreenCallback, isPiPMode, albumArtDb, metadataDb}: {
        /**
         * The function that'll be called when the user wants to go in fullscreen mode
         * @param img the album art element, used for the transition
         */
        fullscreenCallback: (img: HTMLImageElement) => void,
        /**
         * If the pop-up is being displayed in the Picture-in-Picture mode
         */
        isPiPMode?: boolean,
        /**
         * The database used to fetch the album art. 
         * This is used only in Picture-in-Picture mode so that the application can fetch the album art of the currently-playing item.
         */
        albumArtDb: IDBDatabase,
        /**
         * The database used to fetch the metadata. 
         * This is used only in Picture-in-Picture mode so that the application can save the lyrics fetched from LRCLib.
         */
        metadataDb: IDBDatabase
    } = $props();
    $effect(() => {
        // Let's tell the user they can go in fullscreen mode by clicking the image
        if (isAudioBeingPlayed && localStorage.getItem("MusicPlayer-GoToMainPlayerTipSeen") !== "a") {
            setTimeout(() => {
                alert(lang("Tip: click on the album art of the floating music player to open the main audio player."));
                localStorage.setItem("MusicPlayer-GoToMainPlayerTipSeen", "a");
            }, 1000)
        }
    })
    onMount(() => {
        // Function called from the AudioManager callback
        function updateContent({title, albumName, author, albumArt, audioPlaying, duration, currentTime, newAudioInstance, isPaused, lyrics}: UpdateContentProps) {
            if (title && titleContainer) {
                titleContainer.textContent = title;
                titleContainer.scrollTo({left: 0});
                (img.parentElement as HTMLElement).style.display = "flex";
            };
            if ((albumName || author) && paragraphContainer) {
                paragraphContainer.textContent = `${albumName} – ${author}`;
                paragraphContainer.scrollTo({left: 0});
            }
            if (title && author) { // Update page title
                if (isPiPMode && window.documentPictureInPicture?.window?.document) {
                    window.documentPictureInPicture.window.document.title = `${title} – ${author} [MusicPlay]`;
                } else {
                    document.title = `${title} – ${author} [MusicPlay]`;
                }
            }
            if (lyrics && isPiPMode) { // Save the lyrics in Picture-in-Picture mode so that the user can read them by clicking on the album art.
                currentLyrics = lyrics;
                alreadyFetchedLrcLib = false;
                currentLyricsKey = crypto.randomUUID();
                if (isPiPMode && typeof currentLyrics === "string" && Settings.lyrics.useLrcLibIfLyricsArentSynced) fetchLyrics(); // Check if synced lyrics are available on LRCLib
            }
            if (albumArt && img) {
                if (img.src) {
                    URL.revokeObjectURL(img.src);
                    AlbumArtCrossfade.triggerTransition({
                        albumArts: isPiPMode ? [albumArtBackground?.firstChild as HTMLImageElement, img] : [img],
                        newSource: URL.createObjectURL(albumArt),
                        appendToBody: !isPiPMode,
                        zIndex: 6,
                        usePiPAsOutputWindow: isPiPMode
                    });
                } else {
                    img.src = URL.createObjectURL(albumArt);
                    if (albumArtBackground?.firstChild instanceof HTMLImageElement) albumArtBackground.firstChild.src = img.src;
                }
                img.style.display = "block";
                if (albumArtBackground?.firstChild instanceof HTMLImageElement) albumArtBackground.firstChild.style.display = "block";
                if (albumArtBackground instanceof HTMLElement) albumArtBackground.style.opacity = "1";
                if (isPiPMode) PiPModeImgResize();
            }
            if (typeof audioPlaying !== "undefined") {
                isAudioBeingPlayed = audioPlaying;
            }
            if (duration) {
                if (progress) progress.max = duration.toString();
                if (durationLabel) durationLabel.textContent = ConvertSecondsInTimestamp(duration);
            }
            if (currentTime) {
                if (progress && !blockProgressUpdate) {
                    progress.value = currentTime.toString();
                    progress.dispatchEvent(new Event("change")); // Important: let's dispatch the "change" event so that the custom slider position is updated. We do not need to dispatch the "input" event since that would also update the song position to the current one, and this would cause an infinite loop.
                }
                if (secondsLabel) secondsLabel.textContent = ConvertSecondsInTimestamp(currentTime);
            }
            if (newAudioInstance && playIcon) Icons.updateIcon("pause", playIcon);      
            if (typeof isPaused !== "undefined" && playIcon) Icons.updateIcon(isPaused ? "play" : "pause", playIcon);
        }
        AudioManager.addToUpdateContent(updateContent);
        if (titleContainer && paragraphContainer) HandleMultipleTextOverflows([titleContainer.parentElement as HTMLElement, paragraphContainer.parentElement as HTMLElement]); // If the metadata text overflows, this function will automatically handle the scroll transition
        fullscreenObject.goToFullscreen = () => img.closest("button")?.click(); // Add also the function to go to fullscreen in the global fullscreenObject, so that it can be called even if the user goes backwards/forwards in the page navigation
        settingsUpdate.updateFloatingPlayerMiniValue = () => {
            isMiniMode = Settings.miniPlayer.enableMiniMode;
        };
        settingsUpdate.updateFloatingPlayerShuffleRepeatVisibility = () => {
            showAdvancedControls = Settings.miniPlayer.showAdvancedControls;
        }
        if (isPiPMode) { // Add resize event listener
            window.documentPictureInPicture?.window?.addEventListener("resize", PiPModeImgResize);
            PiPModeImgResize();
            if (localStorage.getItem("MusicPlayer-GoToLyricsPiPSeen") !== "a") {
                setTimeout(() => {
                    window.documentPictureInPicture?.window?.alert(lang("Tip: click on the album art of the Picture-in-Picture player to view the lyrics."));
                    localStorage.setItem("MusicPlayer-GoToLyricsPiPSeen", "a");
                }, 1000)
            }
        }
        if (AudioManager.currentMetadata) { // Restore the metadata of the currently-playing track
            const albumArtPromise = albumArtDb ? GetAlbumArt({
                db: albumArtDb,
                id: GetAlbumArtId({
                    albumAuthor: AudioManager.currentMetadata.metadata.albumArtist,
                    year: AudioManager.currentMetadata.metadata.year,
                    albumName: AudioManager.currentMetadata.metadata.album
                })
            }) : new Promise<Blob>((res, rej) => rej());
                let albumArt: Blob | undefined;
                albumArtPromise.then((blob) => {
                    albumArt = blob;
                });
                albumArtPromise.finally(() => {
                    if (!AudioManager.currentMetadata) return;
                    updateContent({
                        title: AudioManager.currentMetadata.metadata.title,
                        albumName: AudioManager.currentMetadata.metadata.album,
                        author: AudioManager.currentMetadata.metadata.artist,
                        isPaused: AudioManager.audio?.paused,
                        currentTime: AudioManager.audioInformation.currentTime,
                        duration: AudioManager.audioInformation.duration,
                        lyrics: (AudioManager.currentMetadata.metadata.syncedLyrics.length !== 0 ? AudioManager.currentMetadata.metadata.syncedLyrics : AudioManager.currentMetadata.metadata.embeddedLyrics) ?? null,
                        albumArt
                    });
                    isPiPMode && PiPModeImgResize();
                })
            }
            return () => {
                AudioManager.addToUpdateContent(updateContent, true);
                fullscreenObject.goToFullscreen = undefined;
                settingsUpdate.updateFloatingPlayerMiniValue = undefined;
                window.documentPictureInPicture?.window?.removeEventListener("resize", PiPModeImgResize);
            }
        });
        let main: HTMLElement;
        
    /**
     * Handle width/height changes when the pop-up is opened in Picture-in-Picture mode
     */
    function PiPModeImgResize() {
        if (isAudioBeingPlayed) {
            // We need to calculate the height of the play/pause controls, so that we can fill the rest of the page with the album art (without any overflow)
            const element = main.cloneNode(true) as HTMLElement;
            // Let's remove the album art so that we can get the real height of the controls
            const clonedImg = element.querySelector("[data-albumart]");
            (clonedImg?.parentElement as HTMLButtonElement).style.height = "auto";
            clonedImg?.remove();
            (element as HTMLElement).style.opacity = "0";
            (element as HTMLElement).style.zIndex = "-1";
            document.body.append(element);
            PiPVerticalMode = (window.documentPictureInPicture?.window?.innerWidth ?? 0) > 500 && (window.documentPictureInPicture?.window?.innerHeight ?? 0) < 400; // If true, the controls will be shown at the right of the album art
            const outHeight = (window.documentPictureInPicture?.window?.innerHeight ?? 0) - (element as HTMLElement).scrollHeight - (PiPVerticalMode ? 0 : 50);
            const maxWidth = (window.documentPictureInPicture?.window?.innerWidth ?? 0) * 85 / 100;
            img.style.height = `${outHeight > maxWidth ? maxWidth : outHeight}px`;
            (img.parentElement as HTMLElement).style.height = `${outHeight}px`;
            (element as HTMLElement).remove();
        }
    }
    /**
     * If true, the controls will be shown at the right of the album art
     */
    let PiPVerticalMode = $state((window.documentPictureInPicture?.window?.innerWidth ?? 0) > 500 && (window.documentPictureInPicture?.window?.innerHeight ?? 0) < 400);
    /**
     * The container of the background album art, that is added only in Picture-in-Picture mode
     */
    let albumArtBackground: HTMLDivElement;
    /**
     * The currently-available lyrics
     */
    let currentLyrics = $state<string | syncedLyricsObj[] | undefined>(
        AudioManager.currentMetadata?.metadata.syncedLyrics.length !== 0
            ? AudioManager.currentMetadata?.metadata.syncedLyrics
            : AudioManager.currentMetadata?.metadata.embeddedLyrics,
    );
    /**
     * A random identifier for the current lyrics. This must be changed every time the `currentLyrics` object changes, so that the Lyrics component is re-rendered.
     */
    let currentLyricsKey: string = $state(crypto.randomUUID());
    /**
     * If true, the Lyrics UI will be shown
     */
    let showLyrics = $state(false);
    /**
     * If a request to LRCLib for the current song has already been made
     */
    let alreadyFetchedLrcLib = false;
    $effect(() => {
        main.style.opacity = showLyrics && currentLyrics ? "0" : "1";
    })
    /**
     * Get the lyrics of the currently-playing track from LRCLib, and save them in the metadata storage.
     */
    async function fetchLyrics() {
        let tempMetadata = !AudioManager.currentMetadata ? undefined : JSON.parse(JSON.stringify(AudioManager.currentMetadata)) as MetadataSource; // Create a new metadata object, so that, if the song changes, we won't mix the lyrics
        if (!tempMetadata) return;
        alreadyFetchedLrcLib = true;
        const str = await LrcLibIntegration({metadata: tempMetadata, isFromPiP: true});
        if (str.length !== 0) {
            currentLyrics = str;
            currentLyricsKey = crypto.randomUUID();
            if (typeof str === "string") tempMetadata.metadata.embeddedLyrics = str; else tempMetadata.metadata.syncedLyrics = str;
            if (AudioManager.currentMetadata?.trackId === tempMetadata.trackId) {
               if (typeof str === "string") AudioManager.currentMetadata.metadata.embeddedLyrics = str; else AudioManager.currentMetadata.metadata.syncedLyrics = str;
            }
            IndexedDatabase.set({db: metadataDb, request: "musicMetadata", object: {
                id: tempMetadata.trackId,
                data: tempMetadata.metadata
            }});
        }
    }

</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_interactive_supports_focus -->
<div use:registerFloatingPlayerDiv={isPiPMode} class={`flex opacity hcenter${isMiniMode ? " gap dynamicFlex" : " mainFlexGap"}`} style={`opacity: 1;${isPiPMode && !PiPVerticalMode ? " flex-direction: column" : ""}`} role="button" onclick={(e) => {
    if ((e.target as HTMLElement).tagName === "DIV") fullscreenCallback(img);
}} bind:this={main}>
    {#if !isPiPMode && isAudioBeingPlayed && typeof window.documentPictureInPicture?.requestWindow === "function"}
        <button style="position: absolute; right: 15px; top: 15px; width: auto; height: auto;" class="emptyButton" onclick={() => OpenPictureInPictureMode({albumArtDb, metadataDb})}>
            <img class="icon" use:AutoRevokeUrl src={Icons.getIconObjectUrl("pictureinpicture")} alt={lang("Enable/disable Picture-in-Picture mode")}>
        </button>
    {/if}
    <div class={isPiPMode ? "" : "albumArtBtns"}>
        <button class="emptyButton flex hcenter wcenter" style="width: 100%; display: flex" onclick={async (e) => {
            fullscreenCallback(img);
            if (isPiPMode && !alreadyFetchedLrcLib) {
                const lookForSyncedLyrics = typeof currentLyrics === "string" && Settings.lyrics.useLrcLibIfLyricsArentSynced;
                if (AudioManager.currentMetadata && !alreadyFetchedLrcLib && (lookForSyncedLyrics || typeof currentLyrics === undefined)) {
                    if (!Settings.lyrics.useLrcLibByDefault && !lookForSyncedLyrics && !(isPiPMode ? window.documentPictureInPicture?.window : window)?.confirm(lang("No lyrics were uploaded for this track. Do you want to fetch them online? Some metadata will be shared with LRCLib."))) return;
                    fetchLyrics();
                }
            }
            if (isPiPMode && currentLyrics) showLyrics = true;
        }} title={lang("Album art")}>
            <img bind:this={img} data-albumart onload={() => isPiPMode && setTimeout(() => PiPModeImgResize(), 50)} class={isPiPMode ? "imgBoxShadow" : undefined} style={`display: none; border-radius: 12px;${!isPiPMode ? "max-width: 20vw; max-height: 20vh;" : "max-width: 75vw; max-height: 75vh"}`} alt={lang("Album art")}>
        </button>
        {#if isAudioBeingPlayed || isPiPMode}
        <div class="flex wcenter gap dynamicGap" style="margin-top: 10px;">
            {#if isPiPMode || showAdvancedControls}
                <button class={`emptyButton${isPiPMode ? "" : ` hideIfSmall`}`} title={lang("Enable/disable shuffle")} onclick={(e) => {
                    AudioManager.audioContext.shuffle = !AudioManager.audioContext.shuffle;
                    const img =( (e.target as HTMLElement)?.firstChild ?? e.target) as HTMLImageElement;
                    if (img) img.src = Icons.getIconObjectUrl(AudioManager.audioContext.shuffle ? "shuffle" : "shuffleoff");
                }}>
                    <img class="icon" use:AutoRevokeUrl src={Icons.getIconObjectUrl(AudioManager.audioContext.shuffle ? "shuffle" : "shuffleoff")} alt={lang("Enable/disable shuffle")}>
                </button>
            {/if}
            <button class={`emptyButton${isPiPMode ? "" : ` hideIf${isMiniMode ? "Really" : ""}Small`}`} onclick={() => AudioManager.prevButton()} title={lang("Previous track")}>
                <img class="icon" use:AutoRevokeUrl src={Icons.getIconObjectUrl("prev")} alt={lang("Previous track")}>
            </button>
            <button class="emptyButton" title={lang("Play/pause button")} onclick={() => {
                const audio = (AudioManager.audio as HTMLAudioElement);
                audio[audio.paused ? "play" : "pause"]();
                Icons.updateIcon(audio.paused ? "play" : "pause", playIcon);                
            }}>
                <img class="icon" use:AutoRevokeUrl bind:this={playIcon} src={Icons.getIconObjectUrl("pause")} alt={lang("Play/pause button")}>
            </button>
            <button class={`emptyButton${isPiPMode ? "" : ` hideIf${isMiniMode ? "Really" : ""}Small`}`} title={lang("Next track")} onclick={() => AudioManager.nextButton()}>
                <img class="icon" use:AutoRevokeUrl src={Icons.getIconObjectUrl("next")} alt={lang("Next track")}>
            </button>
            {#if isPiPMode || showAdvancedControls}
                <button class={`emptyButton${isPiPMode ? "" : ` hideIfSmall`}`} title={lang("Toggle between loop options")} onclick={(e) => {
                    AudioManager.audioContext.repeat = AudioManager.audioContext.repeat === "none" ? "loop" : AudioManager.audioContext.repeat === "loop" ? "loopSingle" : "none";
                    const img =( (e.target as HTMLElement)?.firstChild ?? e.target) as HTMLImageElement;
                    if (img) img.src = Icons.getIconObjectUrl(AudioManager.audioContext.repeat === "none" ? "repeatalloff" : AudioManager.audioContext.repeat === "loop" ? "repeatall" : "repeat1");
                }}>
                    <img class="icon" use:AutoRevokeUrl src={Icons.getIconObjectUrl(AudioManager.audioContext.repeat === "none" ? "repeatalloff" : AudioManager.audioContext.repeat === "loop" ? "repeatall" : "repeat1")} alt={lang("Toggle between loop options")}>
                </button>
            {/if}
        </div>
        {/if}
    </div>
   <div class="maxWidth" style="min-width: 0;">
    <div class="maxWidth overflow">
        <h4 style="margin-top: 0px" bind:this={titleContainer}>{lang("No track is being played")}</h4>
    </div>
    <div class="maxWidth overflow">
        <p bind:this={paragraphContainer}>{lang("Track information will appear here")}.</p>
    </div>
    {#if isAudioBeingPlayed || isPiPMode}
    <div style="width: 100%;" class={isPiPMode ? "" : "miniHide"}>
        <div style="height: 10px"></div>
        <input class="maxWidth" style="width: 100%" onmousedown={() => (blockProgressUpdate = true)} onmouseup={() => (blockProgressUpdate = false)} ontouchstart={() => (blockProgressUpdate = true)} ontouchend={() => (blockProgressUpdate = false)} bind:this={progress} use:inputRangeStyle={() => {
            AudioManager.audioInformation.updateCurrentTime(+progress.value);
        }} type="range" step="0.001">
        <span style="float: left;" bind:this={secondsLabel}></span>
        <span style="float: right" bind:this={durationLabel}></span>
    </div>
    {/if}
   </div> 
</div>
    {#if isPiPMode}
        <div
        bind:this={albumArtBackground}
        class="backgroundImage opacity"
        style="background-color: var(--background);"
    >
        <img alt="Background art" />
    </div>
{/if}
{#key currentLyricsKey}
    {#if showLyrics && currentLyrics}
        <div style="top: 0; left: 0; position: fixed; z-index: 5; padding: 20px;" in:fade={{duration: 200, easing: cubicInOut}} out:fade={{duration: 200, easing: cubicInOut}}>
            <button class="emptyButton opacity flex hcenter wcenter circularButton" style="width: 46px; height: 46px; opacity: 1; position: fixed; right: 15px; top: 15px; z-index: 8; display: block;" onclick={() => {
                showLyrics = false;
            }} title={lang("Back button")}>
                <img use:AutoRevokeUrl src={Icons.getIconObjectUrl("left")} class="icon" style="width: 24px; height: 24px; padding: 5px" alt={lang("Back button")}>
            </button>
            <LyricsPlayer lyrics={currentLyrics} customHeight="calc(100vh - 20px)"></LyricsPlayer>
        </div>
    {/if}
{/key}



<style>

   div:hover {
    cursor: pointer;
   }
   p:hover, span:hover, h4:hover {
    cursor: default;
   }
</style>