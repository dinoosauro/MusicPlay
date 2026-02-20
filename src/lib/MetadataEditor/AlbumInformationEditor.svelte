<script lang="ts">
    import GetAlbumArtId from "../../ts/DataFetcher/GetAlbumArtId";
    import { imageMap } from "../../ts/SvelteComponentsHelpers/GlobalInformation";
    import IndexedDatabase from "../../ts/Database/IndexedDatabase";
    import type { MetadataSource } from "../../ts/Player/PlayerInterfaces";
    import Card from "../Card.svelte";
    import Dialog from "../Dialog.svelte";
    import ImageEditor from "./InnerComponents/ImageEditor.svelte";
    import ImageViewer from "./InnerComponents/ImageViewer.svelte";
    import SaveAndCloseButton from "./InnerComponents/SaveAndCloseButton.svelte";
    import { lang } from "../../ts/SvelteComponentsHelpers/Language";

    const {metadataDb, albumArtDb, songs, albumArt, closeCallback}: {
        /**
         * Database used to fetch/update all the metadata of a single song
         */
        metadataDb: IDBDatabase, 
        /**
         * Database used to fetch/update the album art
         */
        albumArtDb: IDBDatabase, 
        /**
         * Source link of the album art
         */
        albumArt: string, 
        /**
         * The list of songs to update
         */
        songs: MetadataSource[], 
        /**
         * Function called when the user closes the dialog
         * @param imgSrc if passed, the user has changed the album art. It contains the new link to the image. This component already saves the new image in the database and updates it in the album list, but does not update it in the album tracks viewer.
         * @param requireIdUpdate if the user has edited one of the fields that uniquely identify an album.
         */
        closeCallback: (imgSrc?: string, requireIdUpdate?: boolean) => void
    } = $props();
    /**
     * The image element where is displayed the album art
     */
    let img: HTMLImageElement;
    /**
     * Let's get the number of disks
     */
    const getDisks = new Set(songs.map(i => i.metadata.disk).filter(i => i !== null));
    /**
     * Let's create a temp array so that, if the user aborts without saving, no changes are done.
     */
    const tempSongs = JSON.parse(JSON.stringify(songs)) as MetadataSource[];
    function updateFields(e: Event, key: keyof MetadataSource["metadata"], updateDisk?: number | null) {
        for (const item of tempSongs) {
            if (typeof updateDisk !== "undefined" && item.metadata.disk !== updateDisk) continue;
            // @ts-ignore
            item.metadata[key] = (e.target as HTMLInputElement).type === "number" ? +(e.target as HTMLInputElement).value : (e.target as HTMLInputElement).value;
        }
    }
</script>

<Dialog closeFn={closeCallback}>
    <div class="circularButton emptyButton flex hcenter multiCircularButton gap">
        <SaveAndCloseButton saveFn={async () => {
            const requireIdUpdate = tempSongs[0].metadata.album !== songs[0].metadata.album || tempSongs[0].metadata.albumArtist !== songs[0].metadata.albumArtist || tempSongs[0].metadata.year !== songs[0].metadata.year;  // Check if the properties used to uniquely identify the album have been changed
            for (let i = 0; i < tempSongs.length; i++) { // Save the edits
                songs[i] = tempSongs[i];
                await IndexedDatabase.set({db: metadataDb, request: "musicMetadata", object: {id: tempSongs[i].trackId, data: tempSongs[i].metadata}})
            } 
            if (img.src !== albumArt) { // Let's update the album art
                const albumArtId = GetAlbumArtId({albumAuthor: songs[0].metadata.albumArtist, year: songs[0].metadata.year, albumName: songs[0].metadata.album});
                const cachedImage = imageMap.get(`AArt-${albumArtId}`);
                if (cachedImage) {
                    URL.revokeObjectURL(cachedImage.src);
                    cachedImage.src = img.src;
                }
                const req = await fetch(img.src);
                const blob = await req.blob();
                await IndexedDatabase.set({db: albumArtDb, request: "albumArt", object: {id: albumArtId, data: {img: blob}}})
                closeCallback(img.src, requireIdUpdate);
                return;
            }
            closeCallback(undefined, requireIdUpdate);
        }} closeFn={() => closeCallback()}></SaveAndCloseButton>
    </div>
    <h3>{lang("Edit the metadata of")} <i>{songs[0].metadata.album}</i>:</h3>
    <Card secondCard={true}>
        <h4>{lang("Album art options")}:</h4>
        <p>{lang("Click on the album art to upload a custom image, or change the default text with the options below")}.</p>
        <ImageViewer src={albumArt} getImg={(image) => (img = image)}></ImageViewer><br>
        <ImageEditor text={songs[0].metadata.album} {img} isFirstCard={true}></ImageEditor>
    </Card><br>
    <Card secondCard={true}>
        <h4>{lang("Other album information")}:</h4>
        <label class="flex hcenter gap">
            {lang("Album name")}:
            <input type="text" defaultValue={songs[0].metadata.album} onchange={(e) => updateFields(e, "album")}>
        </label><br>
        <label class="flex hcenter gap">
            {lang("Album name (sort by)")}:
            <input type="text" defaultValue={songs[0].metadata.albumSort} onchange={(e) => updateFields(e, "albumSort")}>
        </label><br>
        <label class="flex hcenter gap">
            {lang("Album artists")}: <input type="text" defaultValue={songs[0].metadata.albumArtist} onchange={(e) => updateFields(e, "albumArtist")}>
        </label><br>
        <label class="flex hcenter gap">
            {lang("Album artists (sort by)")}: <input type="text" defaultValue={songs[0].metadata.albumArtistSort} onchange={(e) => updateFields(e, "albumArtistSort")}>
        </label><br>
        <label class="flex hcenter gap">
            {lang("Release year")}: <input type="number" defaultValue={songs[0].metadata.year} onchange={(e) => updateFields(e, "year")}>
        </label><br>
        <label class="flex hcenter gap">
            {lang("Disc count")}:
            <input type="number" defaultValue={songs[0].metadata.diskCount} onchange={(e) => updateFields(e, "diskCount")}>
        </label><br>
        {#each getDisks as diskNumber}
            <label class="flex hcenter gap">
                {lang(`Total tracks count (for disk`)} {diskNumber}):
                <input type="number" defaultValue={songs.find(i => i.metadata.disk === diskNumber)?.metadata.totalTracks} onchange={(e) => updateFields(e, "totalTracks", diskNumber)}>
            </label><br>
        {/each}
    </Card>
</Dialog>