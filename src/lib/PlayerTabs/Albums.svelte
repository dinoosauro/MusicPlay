<script lang="ts">
    import {imageMap, addImageToMap} from "../../ts/SvelteComponentsHelpers/GlobalInformation";
    import AudioManager from "../../ts/Player/AudioManager";
    import type { DatabaseContainer } from "../../ts/Database/DatabaseInterfaces";
    import GetAlbumArt from "../../ts/DataFetcher/GetAlbumArt";
    import LoadMetadata from "../../ts/DataFetcher/LoadMetadata";
    import type { InfoProps, MetadataSource } from "../../ts/Player/PlayerInterfaces";
    import ArtistImageManager from "../../ts/DataFetcher/ArtistImageManager";
    import { onMount } from "svelte";
    import { fade, slide } from "svelte/transition";
    import { cubicInOut } from "svelte/easing";
    import { lang } from "../../ts/SvelteComponentsHelpers/Language";
    import AutoRevokeUrl from "../../ts/SvelteComponentsHelpers/AutoRevokeUrl";
    import SingleAlbumButton from "./SingleItem/SingleAlbumButton.svelte";
    const { databases, updateContent, metadata }: { 
        /**
         * Object that contains all the IndexedDatabases used by the application
         */
        databases: DatabaseContainer, 
        /**
         * Function called when the user has clicked on an album
         * @param content the InfoProps object contains all the necessary information to show the AlbumViewer. For more information, see the description of each property of the `InfoProps` object.
         */
        updateContent: (content: InfoProps) => void, 
        /**
         * List of all the metadata fetched, if loaded. They should be already sorted by album.
         */
        metadata?: ([string, MetadataSource[]])[] 
    } = $props();
    /**
     * The number of items to render
     */
    let renderItems = $state(0);
    let itemToShow = $derived(metadata);
    onMount(() => {
        function scrollFn() {
            if ((window.scrollY + window.innerHeight) > (document.body.scrollHeight * 85 / 100)) { // If the user is near the end of the scroll section, let's render more items
                renderItems += (10 * Math.max(1, Math.floor(window.innerWidth / 300)));
                if (metadata && renderItems > metadata.length) window.removeEventListener("scroll", scrollFn); // Since all items have been loaded, we no longer need the event trigger
            }
        }
        window.addEventListener("scroll", scrollFn);
        return () => {
            window.removeEventListener("scroll", scrollFn);
        }
    });

    const metadataMap = new Map<string, [string, string]>([]);
    function getAuthorOf(id: string, metadata: MetadataSource[]) {
        if (metadata.length === 0) {
            const data = metadataMap.get(id);
            metadataMap.delete(id);
            if (data) return data;
            return ["", ""];
        }
        metadataMap.set(id, [metadata[0].metadata.album, metadata[0].metadata.albumArtist]);
        return [metadata[0].metadata.album, metadata[0].metadata.albumArtist];
    }
    let searchBox: HTMLInputElement;
</script>

<h2>{lang("Albums")}:</h2>
{#if !metadata}
    <p>{lang("Loading data")}...</p>
{:else}
<input type="text" bind:this={searchBox} placeholder={lang("Search albums")} oninput={(e) => {
    const val = searchBox.value.trim().toLowerCase();
    itemToShow = val === "" ? metadata : metadata.filter(i => i[1][0].metadata.album.toLowerCase().indexOf(val) !== -1);
}}><br><br>
        <div class="flex gap wrap wcenter" style="align-items: stretch">
            {#each itemToShow as [albumId, entries], i (albumId)}
                {#if renderItems + (10 * Math.max(1, Math.floor(window.innerWidth / 300))) > i}
                    <SingleAlbumButton {databases} {albumId} {entries} {updateContent}></SingleAlbumButton>
                {/if}
            {/each}
        </div>
    {#if (renderItems + (10 * Math.max(1, Math.floor(window.innerWidth / 300)))) < (itemToShow ?? metadata).length}
        <button class="btn" onclick={() => (renderItems += (10 * Math.max(1, Math.floor(window.innerWidth / 300))))}>{lang("Load more items")}</button>
   {/if}
{/if}

<style>
    p {
        margin: 0px;
    }
</style>