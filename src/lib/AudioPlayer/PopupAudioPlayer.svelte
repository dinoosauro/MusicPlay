<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import type { UpdateContentProps } from "../../ts/Player/PlayerInterfaces";
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
     * If true, the slider won't be updated when the AudioManager will send new currentTime events.
     * This is currently used so that the user can change the playback value
     */
    let blockProgressUpdate = false;
    let {fullscreenCallback}: {
        /**
         * The function that'll be called when the user wants to go in fullscreen mode
         * @param img the album art element, used for the transition
         */
        fullscreenCallback: (img: HTMLImageElement) => void
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
        function updateContent({title, albumName, author, albumArt, audioPlaying, duration, currentTime, newAudioInstance, isPaused}: UpdateContentProps) {
            if (title && titleContainer) {
                titleContainer.textContent = title;
                titleContainer.scrollTo({left: 0});
                (img.parentElement as HTMLElement).style.display = "flex";
            };
            if ((albumName || author) && paragraphContainer) {
                paragraphContainer.textContent = `${albumName} – ${author}`;
                paragraphContainer.scrollTo({left: 0});
            }
            if (albumArt && img) {
                if (img.src) {
                    URL.revokeObjectURL(img.src);
                    AlbumArtCrossfade.triggerTransition({
                        albumArts: [img],
                        newSource: URL.createObjectURL(albumArt),
                        appendToBody: true,
                        zIndex: 6
                    });
                } else img.src = URL.createObjectURL(albumArt);
                img.style.display = "block";
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
        return () => {
            AudioManager.addToUpdateContent(updateContent, true);
            fullscreenObject.goToFullscreen = undefined;
            settingsUpdate.updateFloatingPlayerMiniValue = undefined;
        }
    });
    let main: HTMLElement;
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_interactive_supports_focus -->
<div use:registerFloatingPlayerDiv class={`flex mainFlexGap hcenter${isMiniMode ? "" : " dynamicFlex"}`} role="button" onclick={(e) => {
    if ((e.target as HTMLElement).tagName === "DIV") fullscreenCallback(img);
}} bind:this={main}>
    <div class="albumArtBtns">
        <button class="emptyButton flex hcenter wcenter" style="width: 100%; display: flex" onclick={() => fullscreenCallback(img)} title={lang("Album art")}>
            <img bind:this={img} style="display: none;" alt={lang("Album art")}>
        </button>
        {#if isAudioBeingPlayed}
        <div class="flex wcenter gap dynamicGap" style="margin-top: 5px;">
            <button class="emptyButton hideIfSmall" onclick={() => AudioManager.prevButton()} title={lang("Previous track")}>
                <img class="icon" use:AutoRevokeUrl src={Icons.getIconObjectUrl("prev")} alt={lang("Previous track")}>
            </button>
            <button class="emptyButton" title={lang("Play/pause button")} onclick={() => {
                const audio = (AudioManager.audio as HTMLAudioElement);
                audio[audio.paused ? "play" : "pause"]();
                Icons.updateIcon(audio.paused ? "play" : "pause", playIcon);                
            }}>
                <img class="icon" use:AutoRevokeUrl bind:this={playIcon} src={Icons.getIconObjectUrl("pause")} alt={lang("Play/pause button")}>
            </button>
            <button class="emptyButton hideIfSmall" title={lang("Next track")} onclick={() => AudioManager.nextButton()}>
                <img class="icon" use:AutoRevokeUrl src={Icons.getIconObjectUrl("next")} alt={lang("Next track")}>
            </button>
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
    {#if isAudioBeingPlayed}
    <div style="width: 100%;" class="miniHide">
        <div style="height: 10px"></div>
        <input class="maxWidth" style="width: 100%" onmousedown={() => (blockProgressUpdate = true)} onmouseup={() => (blockProgressUpdate = false)} ontouchstart={() => (blockProgressUpdate = true)} ontouchend={() => (blockProgressUpdate = false)} bind:this={progress} use:inputRangeStyle={() => {
            const audio = (AudioManager.audio as HTMLAudioElement);
            audio.currentTime = +progress.value;
        }} type="range" step="0.001">
        <span style="float: left;" bind:this={secondsLabel}></span>
        <span style="float: right" bind:this={durationLabel}></span>
    </div>
    {/if}
   </div> 
</div>


<style>
    img {
        max-width: 20vw;
        max-height: 20vh;
        border-radius: 12px;
    }
    .mainFlexGap {
        gap: 25px
    }
   @media screen and (max-width: 470px) {
    .dynamicFlex {
        flex-direction: column;
    }
    .albumArtBtns {
        display: flex;
        gap: 5px;
    }
    .mainFlexGap {
        gap: 5px;
    }
    .miniHide {
        display: none;
    }
    .dynamicGap {
        gap: 2px !important;
    }
   }
   @media (max-width: 400px) {
    .hideIfSmall {
        display: none;
    }
   }

   div:hover {
    cursor: pointer;
   }
   p:hover, span:hover, h4:hover {
    cursor: default;
   }
</style>