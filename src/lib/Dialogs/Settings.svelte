<script lang="ts">
    import { onMount } from "svelte";
    import AutoRevokeUrl from "../../ts/SvelteComponentsHelpers/AutoRevokeUrl";
    import type { DatabaseContainer } from "../../ts/Database/DatabaseInterfaces";
    import IconsManager from "../../ts/Icons/IconsManager";
    import Settings from "../../ts/Settings";
    import Card from "../Card.svelte";
    import Dialog from "../Dialog.svelte";
    import { lang } from "../../ts/SvelteComponentsHelpers/Language";
    import { settingsUpdate } from "../../ts/SvelteComponentsHelpers/GlobalInformation";
    import AudioManager from "../../ts/Player/AudioManager";
    import inputRangeStyle from "../../ts/SvelteComponentsHelpers/InputTypeRangeStyle";
    import OpenSource from "./OpenSource.svelte";
    let {closeCallback, databases}: {
        /**
         * Function called to close the settings dialog
         */
        closeCallback: () => void, 
        /**
         * All the databases opened by the application
         */
        databases?: DatabaseContainer
    } = $props();
    /**
     * Number of megabytes the application has used on the user's device
     */
    let navigatorQuota = $state("Loading...");
    /**
     * The colors that are used if there's no custom album art
     */
    let albumArtColors = $state(Settings.customArtColors);
    /**
     * Get the amount of storage the website is using, in megabytes
     */
    async function getNavigatorQuota() {
        return (((await navigator.storage.estimate()).usage ?? 0) / 1024 / 1024).toFixed(3)
    }
    /**
     * Delete all the entries of one or more database
     * @param keys the objectStore list that should be deleted
     */
    async function deleteAllDbEntries(keys: string[]) {
        if (!databases) return;
        for (const key of keys) {
            await new Promise<void>(r => {
                const [database, entryKey] = [key === "contentData" ? databases.songDb : key === "musicMetadata" ? databases.metadataDb : key === "albumArt" ? databases.albumArtDb : key === "artistImg" ? databases.artistImgDb : key === "folderHandle" ? databases.directoryHandleDb : key === "playlist" ? databases.playlistDb : key === "playlistImg" ? databases.playlistImgDb : databases.songStatsDb, key];
                const req = database.transaction(entryKey, "readwrite").objectStore(entryKey);
                const res = req.clear();
                res.onsuccess = () => r();
                res.onerror = () => r();
            })
        }
        window.location.href = "./";
    }
    onMount(async () => {
        navigatorQuota = await getNavigatorQuota();
    })
</script>
<Dialog closeFn={closeCallback}>
    <div class="circularButtonContainer" style="position: fixed; right: calc(15vw + 15px); z-index: 2">
        <button
    class="circularButton emptyButton flex hcenter gap" style="width: fit-content; display: flex;"
    onclick={() => closeCallback()}
    title={lang("Close settings dialog")}
>
    <img
        src={IconsManager.getIconObjectUrl("dismiss")}
        class="icon"
        use:AutoRevokeUrl
        alt={lang("Close settings dialog")}
    />
</button>
</div>
    <h3>{lang("Settings")}:</h3>
    <Card secondCard={true}>
        <h4>{lang("Lyrics integration")}:</h4>
        <p>{lang("The application can automatically fetch missing lyrics from")} <a href="https://lrclib.net" target="_blank">LRCLib</a>. {lang("The application will only share the necessary metadata to identify the currently-playing song. If you enable this, you're also subject to LRCLib's Terms of Service")}.</p>
        <label class="flex hcenter gap">
            <input type="checkbox" bind:checked={Settings.lyrics.useLrcLibByDefault}>{lang("Automatically fetch lyrics if missing")}
        </label><br>
        <label class="flex hcenter gap">
            <input type="checkbox" bind:checked={Settings.lyrics.useLrcLibIfLyricsArentSynced}>{lang("Automatically fetch lyrics if the uploaded ones aren't synced")}
        </label>
    </Card><br>
    <Card secondCard={true}>
        <h4>{lang("Browser buttons behavior")}:</h4>
        <p>{lang("You can control the behavior of the media buttons you can find in the Control Center while playing music")}.</p>
        <label class="flex hcenter gap">
            {lang("When clicking on the next/previous song button")}, <select bind:value={Settings.mediaSession.actionForNextPrevButtons}>
                <option value="next">{lang("Skip to the next/previous track")}</option>
                <option value="seek">{lang("Go forwards/backwards in the track")}</option>
            </select>
        </label><br>
        <label class="flex hcenter gap">
            {lang("When clicking on the go forwards/backwards button")}, <select bind:value={Settings.mediaSession.actionForSeekButtons}>
                <option value="next">{lang("Skip to the next/previous track")}</option>
                <option value="seek">{lang("Go forwards/backwards in the track")}</option>
            </select>
        </label><br>
        <label class="flex hcenter gap" style="overflow: auto;">
            <input type="checkbox" bind:checked={Settings.mediaSession.enableCustomOffset}>{lang("When using the go forwards/backwards button, always skip of")} <input style="width: 60px;" type="number" bind:value={Settings.mediaSession.customOffset}> {lang("seconds")}
        </label>
    </Card><br>
    <Card secondCard={true}>
        <h4>{lang("Floating player")}</h4>
        <label class="flex hcenter gap">
            <input type="checkbox" bind:checked={Settings.miniPlayer.enableMiniMode} onchange={() => {
                settingsUpdate.updateFloatingPlayerMiniValue && settingsUpdate.updateFloatingPlayerMiniValue();
            }}>
            {lang("Put the song/artist name below the controls if there's little space")}
        </label>
    </Card><br>
    <Card secondCard={true}>
        <h4>{lang("Playback rate")}</h4>
        <label class="flex hcenter gap">
            {lang("Default playback rate")}: <input use:inputRangeStyle type="range" min="0.25" max="4" bind:value={Settings.playback.standardPlaybackRate}>
        </label><br>
        <label class="flex hcenter gap">
            <input type="checkbox" bind:checked={Settings.playback.adjustPitchForPlaybackRate} onchange={() => {
                if (AudioManager.audio) AudioManager.audio.preservesPitch = Settings.playback.adjustPitchForPlaybackRate;
            }}>
            {lang("Adjust the picth to compensate to the new playback rate")}
        </label>
    </Card><br>
    <Card secondCard={true}>
        <h4>{lang("Application theme")}:</h4>
        <p>{lang("Here you can change all the colors and values used by the application. You can also customize the font and the CSS blur styling. Note that, if the font you've put doesn't load, you might need to disable your browser's privacy protection. The sliders below the color inputs permit to change the opacity of the property")}.</p>
        <div class="flex hcenter gap wrap">
            {#each [["background", lang("Background color"), "color"], ["text", lang("Text/icon color"), "color"], ["secondtext", lang("Secondary text color"), "color"], ["thirdtext", lang("Previous lyrics color (for word-by-word lyrics)"), "color"], ["card", lang("Main card color"), "color", true], ["secondcard", lang("Secondary card color"), "color"], ["accent", lang("Accent color"), "color"], ["boxshadow", lang("Color around the album art"), "color"], ["font", lang("CSS font name"), "text"], ["backgroundimgfilter", lang("CSS filter for the background album art"), "text"], ["imgboxshadowcode", lang("CSS filter for the box-shadow around album arts"), "text"]] as [cssValue, description, inputType, addTransparent]}
            <label class="flex hcenter gap card maxWidth" style="flex: 1 0 250px">
                {description}
                <div style="width: 100%;">
                <input type={inputType as "color"} defaultValue={getComputedStyle(document.body).getPropertyValue(`--${cssValue}`)} oninput={(e) => {
                    const opacity = getComputedStyle(document.body).getPropertyValue(`--${cssValue}`).substring(7, 9);
                    const val = `${(e.target as HTMLInputElement).value}${opacity}`;
                    document.body.style.setProperty(`--${cssValue}`, val);
                    Settings.cssColors[cssValue as string] = val;
                    if (addTransparent) { // Used only for "card"
                        document.body.style.setProperty(`--${cssValue}transparent`, `${val.substring(0, 7)}5e`);
                        Settings.cssColors[cssValue as string] = val;
                    }
                }}>
                {#if inputType === "color"}
                <div style="height: 10px"></div>
                    <input use:inputRangeStyle={(e) => {
                        const color = getComputedStyle(document.body).getPropertyValue(`--${cssValue}`).substring(0, 7);
                        const val = `${color}${(+(e.target as HTMLInputElement).value).toString(16).padStart(2, "0").toUpperCase()}`;
                        Settings.cssColors[cssValue as string] = val;
                        document.body.style.setProperty(`--${cssValue}`, val);
                    }} type="range" min="0" max="255" defaultValue={parseInt(getComputedStyle(document.body).getPropertyValue(`--${cssValue}`).substring(7, 9) === "" ? "FF" : getComputedStyle(document.body).getPropertyValue(`--${cssValue}`).substring(7, 9), 16)}>
                {/if}
                </div>
            </label>
            {/each}
        </div>
    </Card><br>
    <Card secondCard={true}>
        <h4>{lang("Custom colors")}</h4>
        <p>{lang("Here you can customize the colors used to generate the stats charts or when no album art is available")}.</p>
        <div class="flex hcenter gap wrap">
            {#each albumArtColors as color, i}
                <label class="flex hcenter gap card maxWidth" style="flex: 1 0 150px">
                    <input defaultValue={color} type="color" onchange={(e) => {
                        const value = (e.target as HTMLInputElement).value;
                        albumArtColors[i] = value;
                        Settings.customArtColors[i] = value;
                    }}>
                    <button class="emptyButton flex hcenter" title={lang("Delete this color")} onclick={() => {
                        albumArtColors.splice(i, 1);
                        Settings.customArtColors.splice(i, 1)
                    }}>
                        <img src={IconsManager.getIconObjectUrl("dismiss")} alt={lang("Delete this color")}>
                    </button>
                </label>
            {/each}
        </div><br>
        <button class="btn" onclick={() => {
            albumArtColors.push("#000000");
            Settings.customArtColors.push("#000000");
        }}>{lang("Add new color")}</button>
    </Card><br>
    <Card secondCard={true}>
        <h4>{lang("Application size")}:</h4>
        <p>{lang("The application is using")} {navigatorQuota} megabytes. {lang("If you're running low on memory, you can use the following buttons to save space. Note that the website will automatically refresh at the end of the process")}.</p>
        <div class="flex hcenter gap wrap">
            <button class="btn" style="flex: 1 0 250px" onclick={() => deleteAllDbEntries(["albumArt"])}>{lang("Delete all album arts")}</button>
            <button class="btn" style="flex: 1 0 250px" onclick={() => deleteAllDbEntries(["artistImg"])}>{lang("Delete all artist images")}</button>
            <button class="btn" style="flex: 1 0 250px" onclick={() => deleteAllDbEntries(["playlistImg"])}>{lang("Delete all playlist images")}</button>
            <button class="btn" style="flex: 1 0 250px" onclick={() => deleteAllDbEntries(["songStats"])}>{lang("Delete all song stats")}</button>
            <button class="btn" style="flex: 1 0 250px" onclick={() => deleteAllDbEntries(["contentData", "musicMetadata", "albumArt", "artistImg", "folderHandle", "playlist", "playlistImg", "songStats"])}>{lang("Delete everything")}</button>
        </div>
    </Card><br>
    <Card secondCard={true}>
        <h4>Language:</h4>
        <p>You might need to refresh the webpage to apply the selected language.</p>
        <select bind:value={Settings.language}>
            <option>Select a language</option>
            <option value="en">English</option>
            <option value="it">Italiano</option>
        </select>
    </Card><br>
    <OpenSource></OpenSource>
    <br>
    <Card secondCard={true}>
        <h4>{lang("Information about MusicPlay")}:</h4>
        <p>MusicPlay {lang("version")} {window.musicPlayerVersion}</p>
        <a href="https://github.com/dinoosauro/MusicPlay" target="_blank">{lang("View on GitHub")}</a>
    </Card>
</Dialog>

<style>
    select, input:not([type=checkbox]) {
        width: 100%;
    }
</style>