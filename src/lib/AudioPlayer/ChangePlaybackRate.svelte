<script lang="ts">
    import { onMount } from "svelte";
    import type { PopupScalingInfo } from "../../ts/Animations/AnimationTypes";
    import AudioManager from "../../ts/Player/AudioManager";
    import DropdownMenuOpen from "../DropdownMenu/DropdownMenuOpen.svelte";
    import DropdownAnimation from "../../ts/Animations/DropdownAnimation";
    import { lang } from "../../ts/SvelteComponentsHelpers/Language";
    import inputRangeStyle from "../../ts/SvelteComponentsHelpers/InputTypeRangeStyle";

    let {scaleInfo}: {
        /**
         * Information used to animate the opening of the sleep dialog 
         */
        scaleInfo: PopupScalingInfo
    } = $props();
    let {closeCallback, scaling, limits} = $derived(scaleInfo);
    let container: HTMLDivElement;
    /**
     * Function to call when the user updates the audio playback rate
     * @param id the value converted to string of the new playback rate (ex: `1.5`)
     */
    function audioCallback(id: string) {
        AudioManager.audioContext.playbackRate = +id;
        if (AudioManager.audio) AudioManager.audio.playbackRate = +id;
    }
    onMount(() => DropdownAnimation.triggerAnimation(container, false, scaling))
    let selectedPlaybackRate = $state(AudioManager.audioContext.playbackRate)
</script>

<div bind:this={container} class="miniDialog" style={`opacity: 1; padding: 15px; overflow: auto; ${limits}`}> 
    <label class="flex hcenter gap">
        <input type="range" use:inputRangeStyle={() => {
            audioCallback(selectedPlaybackRate.toString());
        }} min="0.25" bind:value={selectedPlaybackRate} max="4" step="0.01">
    </label>
    <p style="text-align: center;">{lang("Current")}: {selectedPlaybackRate}x</p>
    <DropdownMenuOpen callback={(id) => {
        audioCallback(id);
        DropdownAnimation.triggerAnimation(container, true, scaling);
        closeCallback();
    }} options={["0.5", "0.75", "1", "1.25", "1.5", "2"].map(i => {return {
        categoryItems: [],
        categoryInfo: {
            text: `${i}x`,
            id: i,
        }
    }})}></DropdownMenuOpen>
</div>