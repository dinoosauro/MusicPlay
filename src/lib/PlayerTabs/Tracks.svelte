<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import AudioManager from "../../ts/Player/AudioManager";
    import type { DatabaseContainer, songsStatsDB } from "../../ts/Database/DatabaseInterfaces";
    import GetAlbumArt from "../../ts/DataFetcher/GetAlbumArt";
    import GetAlbumArtId from "../../ts/DataFetcher/GetAlbumArtId";
    import GetAudioFile from "../../ts/DataFetcher/GetAudioFile";
    import LoadMetadata from "../../ts/DataFetcher/LoadMetadata";
    import type { MetadataSource } from "../../ts/Player/PlayerInterfaces";
    import SongMoreOptions from "../DropdownMenu/SongMoreOptions.svelte";
    import SongMetadataEditor from "../MetadataEditor/SongMetadataEditor.svelte";
    import SongStats from "../Dialogs/SongStats.svelte";
    import IndexedDatabase from "../../ts/Database/IndexedDatabase";
    import { lang } from "../../ts/SvelteComponentsHelpers/Language";
    import { fade } from "svelte/transition";
    import SingleTrackButton from "./SingleItem/SingleTrackButton.svelte";
    const {databases, metadataObj, selectCallback}: {
        /**
         * Object that contains all the IndexedDatabases used by the application
         */
        databases: DatabaseContainer, 
        /**
         * List of all the metadata fetched, if loaded. They should be already sorted by album.
         */
        metadataObj?: ([string, MetadataSource[]])[],
        /**
         * Function to call when the user selects a track
         */
        selectCallback: () => void
    } = $props();
    /**
     * A map that contains the album art ID as the key, and the album art source link as the value.
     */
    const albumArtCache = new Map<string, string>();
    /**
     * The list of album identifiers that are currently being fetched. 
     * This is done so that we can avoid fetching multiple times the same album art (and creating multiple object URLs that point to the same Blob)
     */
    let ongoingAlbumArtOperations = new Set();
    /**
     * Obtain the album art of the current track, either from the cached album art or from the database
     * @param albumArtId the ID to use to get the album art
     * @param name the name of the album, so that a standard album art can be generated if nothing else is available
     */
    async function handleAlbumArtCache(albumArtId: string, name: string) {
        if (ongoingAlbumArtOperations.has(albumArtId)) { // The application is already fetching that album art. Let's wait a little bit and let's try agaim
            await new Promise(res => setTimeout(res, 15));
            return await handleAlbumArtCache(albumArtId, name);
        }
        const cacheResult = albumArtCache.get(albumArtId);
        if (cacheResult) return cacheResult;
        // No cached album art has been found. Let's fetch it from the database
        ongoingAlbumArtOperations.add(albumArtId);
        const albumArtResult = await GetAlbumArt({db: databases.albumArtDb, id: albumArtId, name});
        const output = URL.createObjectURL(albumArtResult ?? new Blob());
        albumArtCache.set(albumArtId, output);
        ongoingAlbumArtOperations.delete(albumArtId);
        return output;
    }
    onMount(() => {
        function scrollFn() {
            if ((window.scrollY + window.innerHeight) > (document.body.scrollHeight * 85 / 100)) { // If the user is near the end of the scroll section, let's render more items
                renderItems += (10 * Math.max(1, Math.floor(window.innerWidth / 400)));
                if (metadataObj && renderItems > metadataObj.length) window.removeEventListener("scroll", scrollFn); // Since all items have been loaded, we no longer need the event trigger
            }
        }
        window.addEventListener("scroll", scrollFn);
        return () => {
            for (const [key, url] of albumArtCache) URL.revokeObjectURL(url);
            window.removeEventListener("scroll", scrollFn);
        }
    })
    let showTrackOption = $state<number | undefined>(undefined);
    let showStats = $state<number | undefined>(undefined);
    let songStats: songsStatsDB;
    /**
     * The number of items to render
     */
    let renderItems = $state(0);
    let searchBox: HTMLInputElement;
    /**
     * A list of the items that should be shown in the list. It might be filtered.
     */
    let itemToShow = $derived(metadataObj);

</script>

<h2>{lang("Tracks")}:</h2>
{#if !metadataObj}
    <p>{lang("Loading data")}...</p>
{:else} 
    <input type="text" bind:this={searchBox} placeholder={lang("Search tracks")} oninput={(e) => {
        const val = searchBox.value.trim().toLowerCase();
        itemToShow = val === "" ? metadataObj.map(i => {
            i[0] = i[1][0].trackId;
            return i;
        }) : metadataObj.filter(i => i[1][0].metadata.title.toLowerCase().indexOf(val) !== -1).map(i => {
            i[0] = i[1][0].trackId;
            return i;
        });
    }}><br><br>
   <div class="flex hcenter gap wrap trackWrap" style="align-items: stretch"> 
    {#each itemToShow as [numStr, metadata], i (numStr)}
    {#if renderItems + (10 * Math.max(1, Math.floor(window.innerWidth / 400))) > i}
        <SingleTrackButton {selectCallback} {albumArtCache} currentPosition={i} {databases} {metadataObj} {metadata} {handleAlbumArtCache} editMetadataCallback={() => {
            showTrackOption = i;
        }} showStatsCallback={async () => {
            const stats = await IndexedDatabase.get({
                db: databases.songStatsDb,
                query: metadata[0].trackId,
                request: "songStats"
            });
            if (stats?.data) {
                songStats = stats.data as songsStatsDB;
                showStats = i;
            }
        }}></SingleTrackButton>
    {/if}
    {/each}
   </div> 
   {#if (renderItems + (10 * Math.max(1, Math.floor(window.innerWidth / 400)))) < (itemToShow ?? metadataObj).length}
   <button class="btn" onclick={() => (renderItems += (10 * Math.max(1, Math.floor(window.innerWidth / 400))))}>{lang("Load more items")}</button>
   {/if}
{/if}

{#if typeof showTrackOption !== "undefined" && metadataObj}
   <SongMetadataEditor albumArtDb={databases.albumArtDb} metadataDb={databases.metadataDb} songs={metadataObj[showTrackOption][1]} songNumber={0} closeCallback={() => {showTrackOption = undefined}} context="playlist"></SongMetadataEditor>
{/if}

{#if typeof showStats !== "undefined" && metadataObj}
   <SongStats songMetadata={metadataObj[showStats][1][0]} {songStats} closeCallback={() => (showStats = undefined)}></SongStats>
{/if}


<style>
    img {
        width: 65px;
        height: 65px;
        border-radius: 12px;
    }
    p {
        margin: 0px;
    }
</style>