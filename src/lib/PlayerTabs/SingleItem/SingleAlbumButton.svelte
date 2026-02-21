<script lang="ts">
    import { fade } from "svelte/transition";
    import GetAlbumArt from "../../../ts/DataFetcher/GetAlbumArt";
    import AutoRevokeUrl from "../../../ts/SvelteComponentsHelpers/AutoRevokeUrl";
    import { imageMap, addImageToMap } from "../../../ts/SvelteComponentsHelpers/GlobalInformation";
    import type { DatabaseContainer } from "../../../ts/Database/DatabaseInterfaces";
    import type { InfoProps, MetadataSource } from "../../../ts/Player/PlayerInterfaces";
    let {databases, albumId, entries, updateContent}: {
        /**
         * Object that contains all the IndexedDatabases used by the application
         */
        databases: DatabaseContainer, 
        /**
         * Function called when the user has clicked on an album
         * @param content the InfoProps object contains all the necessary information to show the AlbumViewer. For more information, see the description of each property of the `InfoProps` object.
         */
        updateContent: (content: InfoProps) => void
        /**
         * The ID of the current album button
         */
        albumId: string,
        /**
         * All the songs that are part of the album
         */
        entries: MetadataSource[],
    } = $props();


    // We'll now declare the album name and the album authors as a State. However, we won't mark them as derived, since we'll update thier value only if the entries length isn't zero (since otherwise, the application wouldn't throw an exception)
    let albumName = $state(entries[0].metadata.album);
    let albumAuthors = $state(entries[0].metadata.albumArtist);
    $effect(() => {
        if (entries.length > 0) {
            albumName = entries[0].metadata.album;
            albumAuthors = entries[0].metadata.albumArtist;
        }
    })
</script>
<button
    class="emptyButton card"
    style="height: auto;"
    onclick={async () => {
        const albumArt = await GetAlbumArt({
            db: databases?.albumArtDb,
            id: albumId,
            name: entries[0].metadata.album,
        });
        updateContent({
            albumArt: albumArt ?? undefined,
            type: "album",
            metadata: entries,
            albumArtImg: imageMap.get(`AArt-${albumId}`) ?? undefined,
        });

        return;
    }}
>
    {#await GetAlbumArt( { db: databases.albumArtDb, id: albumId, name: albumName }, ) then albumArtBlob}
        <img
            use:AutoRevokeUrl
            use:addImageToMap={`AArt-${albumId}`}
            style="width: 200px; height: 200px; border-radius: 8px;"
            src={URL.createObjectURL(albumArtBlob ?? new Blob())}
        />
    {/await}
    <p>
        {albumName}
    </p>
    <p class="secondaryMetadata">
        {albumAuthors}
    </p>
</button>
