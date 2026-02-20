<script lang="ts">
    import { onMount } from "svelte";
    import type { PopupScalingInfo } from "../../ts/Animations/AnimationTypes";
    import AudioManager from "../../ts/Player/AudioManager";
    import { lang } from "../../ts/SvelteComponentsHelpers/Language";
    import DropdownAnimation from "../../ts/Animations/DropdownAnimation";
    import inputRangeStyle from "../../ts/SvelteComponentsHelpers/InputTypeRangeStyle";

    let {scaleInfo}: {
        /**
         * Information used to animate the opening of the sleep dialog 
         */
        scaleInfo: PopupScalingInfo
    } = $props();
    let {closeCallback, scaling, limits} = $derived(scaleInfo);
    /**
     * Function to call when the user changes the volume value
     * @param num the new volume value, from `0` to `1` (ex: `0.75`)
     */
    function updateAudio(num: number) {
        AudioManager.audioContext.volume = num;
        if (AudioManager.audio) {
            AudioManager.audio.volume = num;
            AudioManager.audio.muted = num === 0; // Since Safari on iOS doesn't allow changing the volume property, we can use as a fallback the muted one.
        }
    }
    let currentAudio = $state(AudioManager.audioContext.volume);
    onMount(() => DropdownAnimation.triggerAnimation(container, false, scaling))
    let container: HTMLDivElement;
    </script>
<div bind:this={container} class="miniDialog" style={`opacity: 1; padding: 15px; overflow: auto; ${limits}`}> 
    <label class="flex hcenter gap">
        <input style="width: min(250px, 50vw)" use:inputRangeStyle={(e) => {
            updateAudio(+(e.target as HTMLInputElement).value);
        }} type="range" min="0" max="1" bind:value={currentAudio} step="0.01" >
    </label>
    <p style="text-align: center;">{lang("Current")}: {Math.round(currentAudio * 100)}%</p>
</div>