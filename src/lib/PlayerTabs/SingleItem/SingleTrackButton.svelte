<script lang="ts">
    import { fade } from "svelte/transition";
    import type { DatabaseContainer, songsStatsDB } from "../../../ts/Database/DatabaseInterfaces";
    import IndexedDatabase from "../../../ts/Database/IndexedDatabase";
    import GetAlbumArtId from "../../../ts/DataFetcher/GetAlbumArtId";
    import GetAudioFile from "../../../ts/DataFetcher/GetAudioFile";
    import AudioManager from "../../../ts/Player/AudioManager";
    import SongMoreOptions from "../../DropdownMenu/SongMoreOptions.svelte";
    import type { MetadataSource } from "../../../ts/Player/PlayerInterfaces";
    let {metadata, albumArtCache, databases, metadataObj, currentPosition, handleAlbumArtCache, editMetadataCallback, showStatsCallback}: {
        /**
         * An array of the metadata that contains only an entry
         */
        metadata: MetadataSource[],
        /**
         * The current position in the `metadataObj` object array
         */
        currentPosition: number
        /**
         * The map that contains as a key the album art ID, and as a value the link to the album art image
         */
        albumArtCache: Map<string, string>,
        /**
         * All the databases used by the application
         */
        databases: DatabaseContainer,
        /**
         * The object that contains the metadata of all the songs uploaded by the user
         */
        metadataObj: [string, MetadataSource[]][],
        /**
        * Obtain the album art of the current track, either from the cached album art or from the database
        * @param albumArtId the ID to use to get the album art
        * @param name the name of the album, so that a standard album art can be generated if nothing else is available
        */
        handleAlbumArtCache: (albumArtId: string, name: string) => Promise<string>,
            /**
             * The function to call when the user wants to edit the metadata of this song
             */
        editMetadataCallback: () => void,
        /**
         * The function to call when the user wants to see the listening stats of the song
         */
        showStatsCallback: () => void
    } = $props();


    // We'll now declare the used metadata as a State. However, we won't mark them as derived, since we'll update thier value only if the entries length isn't zero (since otherwise, the application wouldn't throw an exception)

    let albumArtist = $state(metadata[0].metadata.albumArtist);
    let year = $state(metadata[0].metadata.year);
    let albumName = $state(metadata[0].metadata.album);
    let trackId = $state(metadata[0].trackId);
    let artist = $state(metadata[0].metadata.artist);
    let title = $state(metadata[0].metadata.title);

    $effect(() => {
        if (metadata.length !== 0) {
            albumArtist = metadata[0].metadata.albumArtist;
            year = metadata[0].metadata.year;
            albumName = metadata[0].metadata.album;
            trackId = metadata[0].trackId;
            artist = metadata[0].metadata.artist;
            title = metadata[0].metadata.title;
        } else {
            opacityBtn.animate([{opacity: "1"}, {opacity: "0"}], {duration: 400}).addEventListener("finish", () => metadataObj.splice(currentPosition, 1))
            opacityBtn.style.opacity = "0";
        };
    })
    let opacityBtn: HTMLElement;
</script>
<button bind:this={opacityBtn} onclick={async (e) => {
        if ((e.target as HTMLElement).getAttribute("data-disableclick") !== null || (e.target as HTMLElement).closest("[data-disableclick]")) return; // Avoid playing the track if the user clicked on the three dots
        const albumArtId = GetAlbumArtId({albumAuthor: albumArtist, year, albumName});
        const cache = albumArtCache.get(albumArtId);
        const getAudio = await GetAudioFile({songDb: databases.songDb, songId: trackId, metadataDb: databases.metadataDb});
        // If we found the album art, let's get the Blob object to pass to the playAudio function. We need to create a new Blob since the AudioManager will automatically revoke the album art object URL after the song has been played.
        let blob;
        if (cache) {
            const res = await fetch(cache);
            blob = await res.blob();
        }
        AudioManager.playAudio({
            file: getAudio,
            metadata: metadata[0],
            albumArt: blob
        });
        /**
         * The MetadataSource list of all the metadata available
         */
        const newItem = [...metadataObj.map(i => i[1])].flat();
        newItem.unshift(...newItem.splice(currentPosition)); // Let's move all the items after the selected track at the start of the queue
        AudioManager.audioContext.queue = newItem.map(i => {return {...i, queueId: crypto.randomUUID()}});
        AudioManager.audioContext.queuePosition = 0;
        Audio
    }} class="emptyButton flex hcenter gap card maxWidth" out:fade={{duration: 1, delay: 1000}} style="display: flex; height: auto">
        {#await handleAlbumArtCache(GetAlbumArtId({albumAuthor: albumArtist, year, albumName}), albumName)}
            
        {:then item} 
            <img src={item}>
        {/await}
        <div class="maxWidth">
            <p>{title}</p>
            <p class="secondaryMetadata">{artist} – {albumName}</p>
        </div>
        <div data-disableclick>
            <SongMoreOptions songs={metadataObj[currentPosition][1]} position={0} {databases} {editMetadataCallback} {showStatsCallback}></SongMoreOptions>
        </div>
    </button>

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