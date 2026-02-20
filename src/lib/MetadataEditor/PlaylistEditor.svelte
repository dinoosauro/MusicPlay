<script lang="ts">
    import { imageMap } from "../../ts/SvelteComponentsHelpers/GlobalInformation";
    import IndexedDatabase from "../../ts/Database/IndexedDatabase";
    import type { MetadataSource, PlaylistContainer } from "../../ts/Player/PlayerInterfaces";
    import Card from "../Card.svelte";
    import Dialog from "../Dialog.svelte";
    import ImageEditor from "./InnerComponents/ImageEditor.svelte";
    import ImageViewer from "./InnerComponents/ImageViewer.svelte";
    import SaveAndCloseButton from "./InnerComponents/SaveAndCloseButton.svelte";
    import { lang } from "../../ts/SvelteComponentsHelpers/Language";
    let {playlists, playlistId, albumArt, playlistImgDb, closeCallback, deleteCallback, songs}: {
        /**
         * List of all the playlists created by the user
         */
        playlists: PlaylistContainer[], 
        /**
         * Identifier of the playlist that is being edited
         */
        playlistId: string, 
        /**
         * Link to the image of the current playlist
         */
        albumArt: string, 
        /**
         * Database where the playlist images are stored
         */
        playlistImgDb: IDBDatabase, 
        /**
         * Function called when the user decides to delete the playlist
         */
        deleteCallback: () => void, 
        /**
         * Function called when the user closes the dialog
         * @param newSrc if passed, the URL that contains the new playlist image. The playlist image has already been saved in the database and in the database list, but not on the playlist song viewer.
         */
        closeCallback: (newSrc?: string) => void,
        /**
         * The metadata of all the songs in the playlist
         */
        songs: MetadataSource[]
    } = $props();
    /**
     * The object of the playlist that is being edited
     */
    const currentPlaylist = playlists.find(i => i.id === playlistId);
    /**
     * Image element that contains the playlist thumbnail
     */
    let img: HTMLImageElement;
    /**
     * The name of the new playlist
     */
    let newPlaylistName = currentPlaylist?.data.name ?? "";
</script>
<Dialog closeFn={closeCallback}>
    <div class="circularButton emptyButton flex hcenter multiCircularButton gap">
    <SaveAndCloseButton saveFn={async () => {
            const req = await fetch(img.src);
            IndexedDatabase.set({db: playlistImgDb, request: "playlistImg", object: {id: playlistId, data: {img: await req.blob()}}});
            const listImg = imageMap.get(`${"PlaylistImg"}-${playlistId}`);
            if (listImg && listImg.src !== img.src) {
                URL.revokeObjectURL(listImg.src);
                listImg.src = img.src;
            }
            if (currentPlaylist && currentPlaylist.data.name !== newPlaylistName) currentPlaylist.data.name = newPlaylistName;
            closeCallback(img.src);
    }} closeFn={closeCallback}></SaveAndCloseButton>
</div>
    <h3>{lang("Edit")} <i>{currentPlaylist?.data.name}</i></h3>
    {#if currentPlaylist}
        <Card secondCard={true}>
            <h4>{lang("Playlist information")}:</h4>
            <label class="flex hcenter gap">
                {lang("Name")}: <input type="text" bind:value={newPlaylistName}>
            </label>
        </Card><br>
        <Card secondCard={true}>
            <h4>{lang("Playlist art")}:</h4>
            <p>{lang("Upload a custom playlist image by clicking on it, or customize the standard text")}.</p>
        <ImageViewer src={albumArt} getImg={(image) => (img = image)}></ImageViewer>
        <br>
        <ImageEditor isFirstCard={true} {img} text={currentPlaylist.data.name}></ImageEditor>
        </Card><br>
        <div class="flex hcenter gap">
            <button class="btn" style="background-color: var(--secondcard);" onclick={async () => {
                if (!confirm(lang("Do you want to delete this playlist? You won't be able to recover it."))) return;
                closeCallback();
                deleteCallback();
            }}>{lang("Delete playlist")}</button>
            <button class="btn" style="background-color: var(--secondcard);" onclick={() => {
                let text = "#EXTM3U";
                for (const {metadata} of songs) text += `\n#EXTINF:${Math.floor(metadata.duration)},${metadata.title} - ${metadata.artist}\n${metadata.name.substring(metadata.name.lastIndexOf("/") + 1)}`;
                const a = Object.assign(document.createElement("a"), {
                    href: URL.createObjectURL(new Blob([text], {type: "text/plain"})),
                    download: `${newPlaylistName}.m3u`,
                    target: "_blank"
                });
                a.click();
                setTimeout(() => URL.revokeObjectURL(a.href), 5000);
            }}>{lang("Export playlist")}</button>
        </div>
    {/if}
</Dialog>