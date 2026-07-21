<script lang="ts">
    import ArtistImageManager from "../../ts/DataFetcher/ArtistImageManager";
    import type { DatabaseContainer } from "../../ts/Database/DatabaseInterfaces";
    import { addImageToMap, imageMap } from "../../ts/SvelteComponentsHelpers/GlobalInformation";
    import LoadMetadata from "../../ts/DataFetcher/LoadMetadata";
    import type { InfoProps, MetadataSource } from "../../ts/Player/PlayerInterfaces";
    import { lang } from "../../ts/SvelteComponentsHelpers/Language";
    import { fade, slide } from "svelte/transition";
    import { onMount } from "svelte";
    import AutoRevokeUrl from "../../ts/SvelteComponentsHelpers/AutoRevokeUrl";
    import CheckOpenedResource from "../../ts/SvelteComponentsHelpers/CheckOpenedResource";
    import Card from "../Card.svelte";
    import IconsManager from "../../ts/Icons/IconsManager";
    import { cubicInOut } from "svelte/easing";

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
    $effect(() => {
         // Get the previously-opened resource, and try to restore it
        const resource = new URLSearchParams(window.location.hash.substring(1)).get("openedResource");
        if (resource !== null && itemToShow) {
            const index = itemToShow.findIndex(i => i[0] === resource);
            if (index !== -1 && index > renderItems) renderItems = index + 1; // Increase the number of loaded resources so that also the previously-opened artist can be loaded and opened 
        }
    })
    let searchBox: HTMLInputElement;
    /**
     * If true, the tip to add custom separators should not be displayed
     */
    let hideDividePart = $state(localStorage.getItem("MusicPlayer-DivideArtists") === "a");
</script>

<h2>{!isAlbumArtist ? lang("Artists") : lang("Album artists")}:</h2>
{#if !metadata}
    <p>{lang("Loading data")}...</p>
{:else}
    <input type="text" bind:this={searchBox} placeholder={lang(`Search${isAlbumArtist ? " album" : ""} artists`)} oninput={(e) => {
        const val = searchBox.value.trim().toLowerCase();
        itemToShow = val === "" ? metadata : metadata.filter(i => i[0].toLowerCase().indexOf(val) !== -1);
    }}><br><br>
    {#if !hideDividePart}
        <div out:slide={{duration: 200, easing: cubicInOut}}>
            <Card>
                <div class="flex hcenter gap">
                    <p><strong>{lang("Tip")}:</strong> {lang(`If you've added multiple artists in the same artist tag, you can divide them by specifying the divider symbol (for example a comma) in the settings (under the "Artist separation" tab)`)}</p>
                    <button class="emptyButton flex hcenter wcenter" onclick={() => {
                        hideDividePart = true;
                        localStorage.setItem("MusicPlayer-DivideArtists", "a");
                    }}>
                        <img use:AutoRevokeUrl src={IconsManager.getIconObjectUrl("dismiss")} alt={lang("Close")} style="width: 24px; height: 24px;">
                    </button>
                </div>
            </Card><br>
        </div>
    {/if}
    <div class="flex hcenter gap wrap" style="align-items: stretch">
        {#each itemToShow as [name, entries], i (name)}
            {#if renderItems + (10 * Math.max(1, Math.floor(window.innerWidth / 400))) > i}
            <button use:CheckOpenedResource={{id: name, waitUntilImageMap: `ArtistImg-${name}`}} onclick={() => {
                updateContent({
                metadata: entries,
                passedId: name,
                type: isAlbumArtist ? "albumArtist" : "artist",
                albumArt: imageMap.get(`ArtistImg-${name}`)?.src,
                albumArtImg: imageMap.get(`ArtistImg-${name}`)
            })
            }} class="emptyButton flex hcenter gap card maxWidth" style="display: flex; height: auto;">
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