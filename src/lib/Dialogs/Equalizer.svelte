<script lang="ts">
    import { onMount } from "svelte";
    import AudioManager from "../../ts/Player/AudioManager";
    import Settings from "../../ts/Settings";
    import inputRangeStyle from "../../ts/SvelteComponentsHelpers/InputTypeRangeStyle";
    import { lang } from "../../ts/SvelteComponentsHelpers/Language";
    import Card from "../Card.svelte";

    // Variables used to add a new frequency to the equalizer
    let newFrom = 60;
    let newTo = 250;
    let dbIncrease = $state(0);
    let frequencyMode = "peaking";
    /**
     * All the already-added equalizer settings
     */
    let itemsToDisplay = $state(Settings.equalizer.map(i => {return {...i, id: crypto.randomUUID()}}));
    const possibleModes = ["allpass", "bandpass", "highpass", "highshelf", "lowpass", "lowshelf", "notch", "peaking"];

    /**
     * For easy mode, the suggested Hz to edit
     */
    const suggestedPicks = [60, 150, 400, 1000, 2400, 15000];
    let easyMode = $state(true);
    let easyModePicks = $state(suggestedPicks.slice(0, -1).map((val, i) => Settings.equalizer.find(j => j.from === suggestedPicks[i] && j.to === suggestedPicks[i + 1])?.db ?? 0));

    /**
     * Update the equalizer settings also in the currently-playing track
     * @param position the position in the equalizer array of the item to edit
     */
    function updateAlreadyExistingValues(position: number) {
        const {center, q} = AudioManager.audioEffects.equalizer.getEqValues(Settings.equalizer[position].from, Settings.equalizer[position].to);
        AudioManager.audioEffects.equalizer.equalizerObjects[position].Q.value = q;
        AudioManager.audioEffects.equalizer.equalizerObjects[position].frequency.value = center;
        AudioManager.audioEffects.equalizer.equalizerObjects[position].type = Settings.equalizer[position].type;
        AudioManager.audioEffects.equalizer.equalizerObjects[position].gain.value = Settings.equalizer[position].db;
    }
    /**
     * Create a new equalizer object. This function both saves the new equalizer in the Settings, and adds it as a filter in the audio playback section.
     */
    function createNew() {
        if (dbIncrease === 0) return;
        const obj = {
            from: newFrom,
            to: newTo,
            db: dbIncrease,
            type: "peaking" as "peaking",
        }
        Settings.equalizer.push(obj);
        itemsToDisplay.push({...obj, id: crypto.randomUUID()});
        AudioManager.audioEffects.equalizer.equalizerObjects.push(AudioManager.audioEffects.equalizer.getEqualizer(obj));
        AudioManager.audioEffects.connectAudioProcessing({});
    }
    /**
     * Delete an equalizer option
     * @param i the position of the equalizer option to delete
     */
    function deleteEq(i: number) {
        AudioManager.audioEffects.equalizer.equalizerObjects[i].disconnect();
        AudioManager.audioEffects.equalizer.equalizerObjects.splice(i, 1);
        Settings.equalizer.splice(i, 1);
        itemsToDisplay.splice(i, 1);
        AudioManager.audioEffects.connectAudioProcessing({});
    }
    let easyModeRangeContainer: HTMLDivElement;
    /**
     * Update the justify-content of the easy mode container so that:
     * - It can be centered if there's more space than the necessary;
     * - It can be scrolled if there's less space than the necessary.
     */
    function checkResize() {
        if (easyModeRangeContainer) {
            easyModeRangeContainer.style.justifyContent = Math.floor(easyModeRangeContainer.scrollWidth) > Math.floor(easyModeRangeContainer.offsetWidth) ?  "start" : "center";
        } 
    }
    onMount(() => {
        checkResize();
        window.addEventListener("resize", checkResize);
        return () => window.removeEventListener("resize", checkResize);
    })
    $effect(() => {
        if (easyMode) checkResize();
    })
</script>
<Card secondCard={true}>
    <h4>{lang("Equalizer")}:</h4>
    <p>{lang("Create your own equalizer: pick the range of frequencies to edit and choose the effect to apply")}.</p>
    <label class="flex hcenter gap">
        <input type="checkbox" bind:checked={easyMode}>{lang("Enable easy mode")}
    </label><br>
    {#if easyMode}
    <Card>
        <div bind:this={easyModeRangeContainer} class="flex gap" style="overflow: auto; gap: 30px">
            {#each [...suggestedPicks].slice(0, -1) as possiblePick, i}
                <label>
                    <div class="flex wcenter">
                        <div style="width: 50px;">
                            <input type="range" style="height: 100px; width: 50px;" min="0" defaultValue={easyModePicks[i] + 30} max="60" use:inputRangeStyle={{
                                isVertical: true,
                                isRotated: true,
                                inputEvent: (e) => {
                                    const findSetting = Settings.equalizer.findIndex(j => j.from === suggestedPicks[i] && j.to === suggestedPicks[i + 1]);
                                    dbIncrease = +(e.target as HTMLInputElement).value - 30;
                                    easyModePicks[i] = dbIncrease;
                                    if (findSetting === -1) {
                                        newFrom = suggestedPicks[i];
                                        newTo = suggestedPicks[i + 1];
                                        createNew();
                                    } else {
                                        Settings.equalizer[findSetting].db = dbIncrease;
                                        AudioManager.audioEffects.equalizer.equalizerObjects[findSetting].gain.value = dbIncrease;
                                        if (dbIncrease === 0) deleteEq(findSetting);
                                    }
                                }
                            }}>
                        </div>
                    </div>
                    <div style="height: 10px;"></div>
                    <span>
                        <div style="width: 100%; text-align: center;">{suggestedPicks[i]}-{suggestedPicks[i+1]} Hz</div>
                        <div style="height: 5px;"></div>
                        <div style="width: 100%; text-align: center">({lang("Value")}: {easyModePicks[i]})</div>
                    </span>
                </label>
            {/each}
        </div><br>
                    <button class="emptyButton maxWidth" onclick={() => {
                for (const item of easyModeRangeContainer.querySelectorAll("input[type=range]")) {
                    (item as HTMLInputElement).value = "30";
                    item.dispatchEvent(new Event("input"));
                    item.dispatchEvent(new Event("change"));
                }
            }}>
                <u>{lang("Reset")}</u>
            </button><br>
    </Card>
    {:else}
    <Card>
        <label class="flex hcenter gap">{lang("From")}: <input type="number" style="background-color: var(--secondcard);" bind:value={newFrom}></label>
        <label class="flex hcenter gap">{lang("To")}: <input type="number" style="background-color: var(--secondcard);" bind:value={newTo}></label>
        <label class="flex hcenter gap">{lang("Effect style")}: <select style="background-color: var(--secondcard);" bind:value={frequencyMode}>
            {#each possibleModes as option}
                <option value={option}>{option}</option>
            {/each}
        </select></label>
        <label class="flex hcenter gap">{lang("Decibels increase/decrease")}: <input type="number" style="background-color: var(--secondcard);" bind:value={dbIncrease}></label><br>
        <button class="emptyButton maxWidth" onclick={() => createNew()}><u>{lang("Add frequency")}</u></button>
    </Card><br>
    <u>{lang("Already-added items")}:</u><br><br>
    {#each itemsToDisplay as item, i (item.id)}
    <Card>
        <label class="flex hcenter gap">{lang("From")}: <input type="number" style="background-color: var(--secondcard);" min="-30" max="30" bind:value={Settings.equalizer[i].from} onchange={() => updateAlreadyExistingValues(i)}></label>
        <label class="flex hcenter gap">{lang("To")}: <input type="number" style="background-color: var(--secondcard);" min="-30" max="30" bind:value={Settings.equalizer[i].to} onchange={() => updateAlreadyExistingValues(i)}></label>
        <label class="flex hcenter gap">{lang("Effect style")}: <select style="background-color: var(--secondcard);" onchange={() => updateAlreadyExistingValues(i)} bind:value={Settings.equalizer[i].type}>
            {#each possibleModes as option}
                <option value={option}>{option}</option>
            {/each}
        </select></label>
        <label class="flex hcenter gap">{lang("Decibels")}: <input type="number" style="background-color: var(--secondcard);" min="-30" max="30" bind:value={Settings.equalizer[i].db} onchange={() => updateAlreadyExistingValues(i)}></label><br>
        <button class="emptyButton maxWidth" onclick={() => deleteEq(i)}><u>{lang("Delete")}</u></button>
    </Card>
    {/each}
    {/if}
</Card>