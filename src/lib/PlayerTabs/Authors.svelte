<script lang="ts">
    import ArtistImageManager from "../../ts/DataFetcher/ArtistImageManager";
    import type { DatabaseContainer } from "../../ts/Database/DatabaseInterfaces";
    import { addImageToMap, imageMap } from "../../ts/SvelteComponentsHelpers/GlobalInformation";
    import LoadMetadata from "../../ts/DataFetcher/LoadMetadata";
    import type { InfoProps, MetadataSource } from "../../ts/Player/PlayerInterfaces";
    import { lang } from "../../ts/SvelteComponentsHelpers/Language";
    import { fade } from "svelte/transition";
    import { onMount } from "svelte";
    import AutoRevokeUrl from "../../ts/SvelteComponentsHelpers/AutoRevokeUrl";

    const { databases, updateContent, isAlbumArtist, metadata }: { 
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
        /**
         * If the filtering option was for "album artists", and not "artists"
         */
        isAlbumArtist?: boolean, 
    } = $props();
    /**
     * A list of the items that should be shown in the list. It might be filtered.
     */
    let itemToShow = $derived(metadata);
    /**
     * The number of items to render
     */
    let renderItems = $state(0);
    onMount(() => {
        function scrollFn() {
            if ((window.scrollY + window.innerHeight) > (document.body.scrollHeight * 85 / 100)) { // If the user is near the end of the scroll section, let's render more items
                renderItems += (10 * Math.max(1, Math.floor(window.innerWidth / 400)));
                if (metadata && renderItems > metadata.length) window.removeEventListener("scroll", scrollFn); // Since all items have been loaded, we no longer need the event trigger
            }
        }
        window.addEventListener("scroll", scrollFn);
        return () => {
            window.removeEventListener("scroll", scrollFn);
        }
    })
    let searchBox: HTMLInputElement;
</script>

<h2>{!isAlbumArtist ? lang("Artists") : lang("Album artists")}:</h2>
{#if !metadata}
    <p>{lang("Loading data")}...</p>
{:else}
    <input type="text" bind:this={searchBox} placeholder={lang(`Search${isAlbumArtist ? " album" : ""} artists`)} oninput={(e) => {
        const val = searchBox.value.trim().toLowerCase();
        itemToShow = val === "" ? metadata : metadata.filter(i => i[0].toLowerCase().indexOf(val) !== -1);
    }}><br><br>
    <div class="flex hcenter gap wrap">
        {#each itemToShow as [name, entries], i (name)}
            {#if renderItems + (10 * Math.max(1, Math.floor(window.innerWidth / 400))) > i}
            <button onclick={() => {
                updateContent({
                metadata: entries,
                type: isAlbumArtist ? "albumArtist" : "artist",
                albumArt: imageMap.get(`ArtistImg-${name}`)?.src,
                albumArtImg: imageMap.get(`ArtistImg-${name}`)
            })

            }} class="emptyButton flex hcenter gap card maxWidth maxHeight" style="display: flex">
                {#await ArtistImageManager.fetchImage({author: name, artistImageDb: databases.artistImgDb})}
                {:then src}
                    <!-- svelte-ignore a11y_img_redundant_alt -->
                    <img use:AutoRevokeUrl alt={lang("Artist picture")} src={URL.createObjectURL(src)} use:addImageToMap={`ArtistImg-${name}`}>
                {/await}
                <p>{name}</p>
            </button>
            {/if}
        {/each}
    </div>
    {#if (renderItems + (10 * Math.max(1, Math.floor(window.innerWidth / 400)))) < (itemToShow ?? metadata).length}
        <button class="btn" onclick={() => (renderItems += (10 * Math.max(1, Math.floor(window.innerWidth / 400))))}>{lang("Load more items")}</button>
   {/if}
{/if}

<style>
    img {
        width: 65px;
        height: 65px;
        border-radius: 12px;
    }
    .wrap > * {
        flex: 1 0 400px;
    }
    p {
        margin: 0px;
    }
</style>