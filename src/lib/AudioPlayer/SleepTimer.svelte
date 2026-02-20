<script lang="ts">
    import { onMount } from "svelte";
    import SleepTimer from "../../ts/Player/SleepTimer";
    import DropdownAnimation from "../../ts/Animations/DropdownAnimation";
    import type { PopupScalingInfo } from "../../ts/Animations/AnimationTypes";
    import { lang } from "../../ts/SvelteComponentsHelpers/Language";
    /**
     * The span that can be used to update the time remaining to the end of the sleep timer
     */
    let timerUpdateText: HTMLSpanElement;
    onMount(() => {
        /**
         * The interval used to update the remaining time if the user has already started a sleep timer
         */
        let interval: number | undefined;
        if (timerUpdateText && SleepTimer.timerArguments.isRunning) { // Let's update the time missing before the end of the sleep timer
            function updateTextContent() {
                const isFinished = SleepTimer.timerArguments.remainingSeconds === 0 && SleepTimer.timerArguments.remainingMinutes === 0 && SleepTimer.timerArguments.remainingHours === 0;
                timerUpdateText.textContent = `${SleepTimer.timerArguments.remainingHours === 0 ? "" : `${SleepTimer.timerArguments.remainingHours} ${lang(`hour${SleepTimer.timerArguments.remainingHours === 1 ? "" : "s"}`)}, `}${SleepTimer.timerArguments.remainingMinutes === 0 ? "" : `${SleepTimer.timerArguments.remainingMinutes} ${lang(`minute${SleepTimer.timerArguments.remainingMinutes === 1 ? "" : "s"}`)} and `}${SleepTimer.timerArguments.remainingSeconds} ${lang(`second${SleepTimer.timerArguments.remainingSeconds === 1 ? "" : "s"}`)} ${lang("remaining")}.${isFinished && SleepTimer.timerArguments.stopAtNextTrack ? ` ${lang("Playback will be paused at the end of this song")}.` : ""}`;
                if (isFinished && !SleepTimer.timerArguments.stopAtNextTrack) closeWrapper();
            }
            interval = setInterval(updateTextContent, 1000);
            updateTextContent();
        }
        DropdownAnimation.triggerAnimation(container, false, scaling);
        return () => {
            clearInterval(interval);
        }
    });
    async function closeWrapper() {
        await DropdownAnimation.triggerAnimation(container, true, scaling);
        closeCallback();
    }
    let {scaleInfo}: {
        /**
         * Information used to animate the opening of the sleep dialog 
         */
        scaleInfo: PopupScalingInfo
    } = $props();
    let {closeCallback, scaling, limits} = $derived(scaleInfo);
    let container: HTMLDivElement;
</script>


<div bind:this={container} class="miniDialog" style={`opacity: 1; padding: 15px; overflow: auto; ${limits}`}> 
    <h2>{lang("Sleep timer")}:</h2>
    {#if SleepTimer.timerArguments.isRunning}
    <div class="flex hcenter gap">
        <p>{lang("Timer running")}: <span bind:this={timerUpdateText}>0 seconds remaining</span></p>
    </div>
    {:else}
        <div class="flex hcenter gap sameWidth">
            <div>
                <label>
                    <p>{lang("Hours")}:</p>
                    <input bind:value={SleepTimer.timerArguments.remainingHours} type="number" min="0">
                </label>
            </div>
            <div>
                <label>
                    <p>{lang("Minutes")}:</p>
                    <input bind:value={SleepTimer.timerArguments.remainingMinutes} type="number" min="0" max="59">
                </label>
            </div>
            <div>
                <label>
                    <p>{lang("Seconds")}:</p>
                    <input bind:value={SleepTimer.timerArguments.remainingSeconds} type="number" min="0" max="59">
                </label>
            </div>
        </div><br>
        <label class="flex hcenter gap">
            <input type="checkbox" bind:checked={SleepTimer.timerArguments.stopAtNextTrack}>{lang("Wait the end of the song before pausing the track")}
        </label>
    {/if}
    <br>
    <div class="flex hcenter gap">
        <button class="btn" onclick={() => {
            SleepTimer[SleepTimer.timerArguments.isRunning ? "clearSleepTimer" : "startSleepTimer"]();
            closeCallback();
        }}>{SleepTimer.timerArguments.isRunning ? lang("Disable") : lang("Start")}</button>
        <button class="btn" onclick={() => closeWrapper()}>{lang("Close")}</button>
    </div>
</div>

<style>
    input:not([type=checkbox]) {
        width: 100%;
        background-color: var(--cardtransparent);
    }
    .btn {
        background-color: var(--cardtransparent);
    }
    .sameWidth > div {
        width: 100%;
    }
</style>