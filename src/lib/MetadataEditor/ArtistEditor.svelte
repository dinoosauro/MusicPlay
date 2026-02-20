<script lang="ts">
    import ArtistImageManager from "../../ts/DataFetcher/ArtistImageManager";
    import { imageMap } from "../../ts/SvelteComponentsHelpers/GlobalInformation";
    import IconsManager from "../../ts/Icons/IconsManager";
    import IndexedDatabase from "../../ts/Database/IndexedDatabase";
    import type { PlaylistContainer } from "../../ts/Player/PlayerInterfaces";
    import Card from "../Card.svelte";
    import Dialog from "../Dialog.svelte";
    import ImageEditor from "./InnerComponents/ImageEditor.svelte";
    import ImageViewer from "./InnerComponents/ImageViewer.svelte";
    import SaveAndCloseButton from "./InnerComponents/SaveAndCloseButton.svelte";
    import { lang } from "../../ts/SvelteComponentsHelpers/Language";
    const {artistId, artistAlbumArt, artistImgDb, closeCallback}: {
        /**
         * Name of the artist
         */
        artistId: string, 
        /**
         * Either the Blob or the link to the artist image, if available
         */
        artistAlbumArt?: string | Blob, 
        /**
         * The database where the new image of the artist will be stored
         */
        artistImgDb: IDBDatabase, 
        /**
         * Function called to close the component.
         * @param imageUrl if passed, the user has uploaded a new picture. This property includes the link to the new image. The image has already been stored to the database and updated in the artists list, but not on the artist song viewer.
         */
        closeCallback: (imageUrl?: string) => void
    } = $props();
    let img: HTMLImageElement;
</script>

<Dialog closeFn={closeCallback}>
    <div class="circularButton emptyButton flex hcenter multiCircularButton gap">
        <SaveAndCloseButton saveFn={async () => {
                const req = await fetch(img.src);
                IndexedDatabase.set({db: artistImgDb, request: "artistImg", object: {id: artistId, data: {img: await req.blob()}}});
                const listImg = imageMap.get(`${"ArtistImg"}-${artistId}`);
                if (listImg && listImg.src !== img.src) {
                    URL.revokeObjectURL(listImg.src);
                    listImg.src = img.src;
                }
                closeCallback(img.src);
        }} closeFn={closeCallback}></SaveAndCloseButton>
    </div>
    <h3>{lang("Artist image editor")}:</h3>
    <strong>{artistId}</strong>
        <p>{lang("Upload a custom artist image by clicking on it, or customize the standard text")}.</p>
        <ImageViewer src={typeof artistAlbumArt === "string" ? artistAlbumArt : URL.createObjectURL(artistAlbumArt ?? new Blob())} getImg={(image) => (img = image)}></ImageViewer>
        <br>
        <ImageEditor {img} text={artistId}></ImageEditor>
</Dialog>