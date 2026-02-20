<script lang="ts">
    import IndexedDatabase from "../../ts/Database/IndexedDatabase";
    import GetAlbumArtId from "../../ts/DataFetcher/GetAlbumArtId";
    import ParseLrcFiles from "../../ts/DataFetcher/ParseLrcFiles";
    import ParseTTMLFile from "../../ts/DataFetcher/ParseTTMLFiles";
    import type { FilterType, MetadataSource } from "../../ts/Player/PlayerInterfaces";
    import { lang } from "../../ts/SvelteComponentsHelpers/Language";
    import Card from "../Card.svelte";
    import Dialog from "../Dialog.svelte";
    import SaveAndCloseButton from "./InnerComponents/SaveAndCloseButton.svelte";

    let {metadataDb, songs, songNumber, closeCallback, context, albumArtDb}: {
        /**
         * Database where song metadata can be fetched and updated
         */
        metadataDb: IDBDatabase, 
        /**
         * List of all the songs that are currently displayed in the album/playlist viewer.
         */
        songs: MetadataSource[], 
        /**
         * The position in the `songs` object of the song to edit
         */
        songNumber: number, 
        /**
         * Function called when the dialog should be closed
         * @param removeFromList if passed, the position in the `songs` object of the song to remove from the list
         */
        closeCallback: (removeFromList?: number) => void, 
        /**
         * The filter that has been applied to the `MetadataSource` main object.
         */
        context: FilterType, 
        /**
         * Database where the albums' album art can be fetched and upadted
         */
        albumArtDb: IDBDatabase
    } = $props();

    // Clone the metadata object so that no changes will be saved if the user aborts the request
    let tempMetadata = JSON.parse(JSON.stringify(songs[songNumber])) as MetadataSource;
    function updateMetadata(e: Event, type: keyof MetadataSource["metadata"]) {
        // @ts-ignore
        tempMetadata.metadata[type] = (e.target as HTMLInputElement).type === "number" ? +(e.target as HTMLInputElement).value : (e.target as HTMLInputElement).value;
    }
    /**
     * String that indicates the type of lyrics that have been uploaded
     */
    let currentLyricsStatus = $state(songs[songNumber].metadata.syncedLyrics.length !== 0 ? "synced" : songs[songNumber].metadata.embeddedLyrics.trim() !== "" ? "plain" : "no")
</script>

<Dialog closeFn={closeCallback}>
    <div class="circularButton emptyButton flex hcenter multiCircularButton gap">
        <SaveAndCloseButton closeFn={() => closeCallback()} saveFn={async () => {
            const [newAlbumId, prevAlbumId] = [GetAlbumArtId({albumAuthor: tempMetadata.metadata.albumArtist, year: tempMetadata.metadata.year, albumName: tempMetadata.metadata.album}), GetAlbumArtId({albumAuthor: songs[songNumber].metadata.albumArtist, year: songs[songNumber].metadata.year, albumName: songs[songNumber].metadata.album})];
            if (newAlbumId !== prevAlbumId) { // Different album ID. Let's clone the album art.
                const currentAlbumArt = await IndexedDatabase.get({
                    db: albumArtDb,
                    request: "albumArt",
                    query: prevAlbumId
                });
                if (currentAlbumArt?.data) await IndexedDatabase.set({
                    db: albumArtDb,
                    request: "albumArt",
                    object: {
                        id: newAlbumId,
                        data: currentAlbumArt?.data
                    }
                })
            }
            const removeFromList = context === "playlist" ? undefined : context === "artist" ? tempMetadata.metadata.artist !== songs[songNumber].metadata.artist : context === "albumArtist" ? tempMetadata.metadata.albumArtist !== songs[songNumber].metadata.albumArtist : tempMetadata.metadata.album !== songs[songNumber].metadata.album;
            songs[songNumber] = tempMetadata;
            if (context === "playlist") { // Playlists could contain multiple times the same song. In this case, we need to update all of those song instances, since they probably are stored as different objects.
                for (let i = 0; i < songs.length; i++) {
                    if (i === songNumber) continue;
                    if (songs[i].trackId === songs[songNumber].trackId) songs[i].metadata = tempMetadata.metadata;
                }
            }
            await IndexedDatabase.set({db: metadataDb, request: "musicMetadata", object: {id: tempMetadata.trackId, data: tempMetadata.metadata}});
            closeCallback(removeFromList ? songNumber : undefined);
        }}></SaveAndCloseButton>
    </div>
    <h3>{lang("Edit the metadata of")} <i>{songs[songNumber].metadata.title}</i>:</h3>
    <label class="flex hcenter gap">
        {lang("Album")}: <input style="background-color: var(--secondcard);" type="text" defaultValue={songs[songNumber].metadata.album} onchange={(e) => updateMetadata(e, "album")}>
    </label><br>
    <Card secondCard={true}>
        <h4>{lang("Authors")}:</h4>
        <label class="flex hcenter gap">
            {lang("Song authors")}:
            <input type="text" defaultValue={songs[songNumber].metadata.artist} onchange={(e) => updateMetadata(e, "artist")}>
        </label><br>
        <label class="flex hcenter gap">
            {lang("Song authors (sort by)")}:
            <input type="text" defaultValue={songs[songNumber].metadata.artistSort} onchange={(e) => updateMetadata(e, "artistSort")}>
        </label><br>
        <label class="flex hcenter gap">
            {lang("Composers")}:
            <input type="text" defaultValue={songs[songNumber].metadata.composer ?? ""} onchange={(e) => updateMetadata(e, "composer")}>
        </label>
    </Card><br>
    <Card secondCard={true}>
        <h4>{lang("Track")}:</h4>
        <label class="flex hcenter gap">
            {lang("Title")}:
            <input type="text" defaultValue={songs[songNumber].metadata.title} onchange={(e) => updateMetadata(e, "title")}>
        </label><br>
        <label class="flex hcenter gap">
            {lang("Track number")}: <input type="number" defaultValue={songs[songNumber].metadata.track} onchange={(e) => updateMetadata(e, "track")}>
        </label><br>
        <label class="flex hcenter gap">
            {lang("Disk number")}: <input type="number" defaultValue={songs[songNumber].metadata.disk} onchange={(e) => updateMetadata(e, "disk")}>
        </label>
    </Card>
    {#if context === "playlist"}
    <br>
    <Card secondCard={true}>
        <h4>{lang("Album")}:</h4>
        <label class="flex hcenter gap">
            {lang("Album artists (sort by)")}: <input type="text" defaultValue={songs[0].metadata.albumArtistSort} onchange={(e) => updateMetadata(e, "albumArtistSort")}>
        </label><br>
        <label class="flex hcenter gap">
            {lang("Album name (sort by)")}:
            <input type="text" defaultValue={songs[0].metadata.albumSort} onchange={(e) => updateMetadata(e, "albumSort")}>
        </label><br>
        <label class="flex hcenter gap">
            {lang("Release year")}: <input type="number" defaultValue={songs[0].metadata.year} onchange={(e) => updateMetadata(e, "year")}>
        </label><br>
        <label class="flex hcenter gap">
            {lang("Disc count")}:
            <input type="number" defaultValue={songs[0].metadata.diskCount} onchange={(e) => updateMetadata(e, "diskCount")}>
        </label><br>
        <label class="flex hcenter gap">
            {lang("Total tracks (for the disk with this track)")}:
            <input type="number" defaultValue={songs[0].metadata.diskCount} onchange={(e) => updateMetadata(e, "totalTracks")}>
        </label>
    </Card>
    {/if}<br>
    <Card secondCard={true}>
        <h4>{lang("Lyrics")}:</h4>
        <p>{lang("The application will use")}: {lang(`${currentLyricsStatus} lyrics`)}</p>
        <p>{lang("If available, synced lyrics will always be used. However, you can also add plain lyrics by writing them in the text area below")}.</p>
        <textarea onchange={() => {
            currentLyricsStatus = tempMetadata.metadata.syncedLyrics.length !== 0 ? "synced" : tempMetadata.metadata.embeddedLyrics.trim() !== "" ? "plain" : "no"
        }} bind:value={tempMetadata.metadata.embeddedLyrics}></textarea><br><br>
        <div class="flex hcenter gap">
            <button class="btn" onclick={() => {
                const input = Object.assign(document.createElement("input"), {
                    type: "file",
                    onchange: async () => {
                        if (input.files && (input.files[0].name.endsWith(".lrc") || input.files[0].name.endsWith(".xml") || input.files[0].name.endsWith(".ttml"))) {
                            tempMetadata.metadata.syncedLyrics = input.files[0].name.endsWith(".lrc") ? ParseLrcFiles(await input.files[0].text()) : ParseTTMLFile(await input.files[0].text());
                            currentLyricsStatus = "synced";
                        }
                    }
                })
                input.click();
            }}>{lang("Upload LRC/TTML file")}</button>
            <button class="btn" onclick={() => {
                tempMetadata.metadata.syncedLyrics = [];
                currentLyricsStatus = tempMetadata.metadata.embeddedLyrics.trim() !== "" ? "plain" : "no";
            }}>{lang("Delete synced lyrics")}</button>
        </div>
    </Card>
</Dialog>