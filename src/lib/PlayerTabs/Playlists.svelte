<script lang="ts">
    import { onMount } from "svelte";
    import type { DatabaseContainer, playlistDB } from "../../ts/Database/DatabaseInterfaces";
        import type { PlaylistContainer, InfoProps, MetadataSource, MetadataSourcePlaylist } from "../../ts/Player/PlayerInterfaces";
    import GetAllPlaylists from "../../ts/DataFetcher/GetAllPlaylists";
    import ArtistImageManager from "../../ts/DataFetcher/ArtistImageManager";
    import { addImageToMap, imageMap } from "../../ts/SvelteComponentsHelpers/GlobalInformation";
    import HistoryHandler from "../../ts/Player/HistoryHandler";
    import { lang } from "../../ts/SvelteComponentsHelpers/Language";
    import { fade } from "svelte/transition";
    import IconsManager from "../../ts/Icons/IconsManager";
    import IndexedDatabase from "../../ts/Database/IndexedDatabase";
    import AutoRevokeUrl from "../../ts/SvelteComponentsHelpers/AutoRevokeUrl";
    import ShowNewPlaylist from "../../ts/SvelteComponentsHelpers/ShowNewPlaylist";
    import CheckOpenedResource from "../../ts/SvelteComponentsHelpers/CheckOpenedResource";

    let {metadata, databases, updateContent, passPlaylists}: {
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
        metadata?: ([string, MetadataSource[]])[],
        /**
         * Function called when all the playlists have been fetched from the database
         * @param item the array with all the playlists. If the component is destroyed, undefined will be returned.
         */
        passPlaylists: (item: PlaylistContainer[] | undefined) => void
    } = $props();
    /**
     * A list of all the playlists that have been created by the user. If undefined, the lists are still being loaded by the application.
     */
    let playlists = $state<PlaylistContainer[] | undefined>(undefined);
    onMount(() => {
        GetAllPlaylists(databases.playlistDb).then((content) => {
            playlists = content;
            passPlaylists(playlists);
        })
        return () => {
            playlists = undefined;
            passPlaylists(undefined);
        }
    })
    /**
     * A list of the items that should be shown in the list. It might be filtered.
     */
    let itemToShow = $derived(playlists);
    /**
     * Get the metadata of all the songs in a single playlist
     * @param list the list to read
     */
    function getMetadata(list: PlaylistContainer) {
        const result: MetadataSourcePlaylist[] = [];
        const flatMetadata = metadata?.flatMap(i => i[1]);
        if (!flatMetadata) return;
        for (const item of list.data.contents) {
            const file = flatMetadata.find(i => i.trackId === item);
            if (file) result.push({
                ...file,
                playlistId: crypto.randomUUID() // Let's add a random playlist ID so that the album viewer can uniquely identify the songs, even if they have the same track ID
            });
        }
        return result;
    }   
    /**
     * The number of items to render
     */
    let renderItems = $state(0);
    onMount(() => {
        function deleteItemFromList(id: string) {
            const index = playlists?.findIndex(i => i.id === id) ?? -1;
            if (index !== -1) playlists?.splice(index, 1);
        }
        HistoryHandler.backContext.deletePlaylist = deleteItemFromList;
        function scrollFn() {
            if ((window.scrollY + window.innerHeight) > (document.body.scrollHeight * 85 / 100)) { // If the user is near the end of the scroll section, let's render more items
                renderItems += (10 * Math.max(1, Math.floor(window.innerWidth / 400)));
                if (metadata && renderItems > metadata.length) window.removeEventListener("scroll", scrollFn); // Since all items have been loaded, we no longer need the event trigger
            }
        }
        window.addEventListener("scroll", scrollFn);
        ShowNewPlaylist.showPlaylist = (playlist) => {
            playlists?.push(playlist);
        }
        return () => {
            window.removeEventListener("scroll", scrollFn);
            HistoryHandler.backContext.deletePlaylist = undefined;
            ShowNewPlaylist.showPlaylist = undefined;
        }
    });
        $effect(() => {
         // Get the previously-opened resource, and try to restore it
        const resource = new URLSearchParams(window.location.hash.substring(1)).get("openedResource");
        if (resource !== null && itemToShow) {
            const index = itemToShow.findIndex(i => i.id === resource);
            if (index !== -1 && index > renderItems) renderItems = index + 1; // Increase the number of loaded resources so that also the previously-opened artist can be loaded and opened 
        }
    })
    let searchBox: HTMLInputElement;
</script>

{#if !metadata || !playlists}
<p>{lang("Loading data")}...</p>
{:else}
<h2>{lang("Playlists")}:</h2>
    {#if playlists.length === 0}
        <p>{lang("No playlists were found. You can create one by clicking on the three dots at the right of each track")}.</p>
    {:else}
    <input type="text" bind:this={searchBox} placeholder={lang("Search playlists")} oninput={(e) => {
        const val = searchBox.value.trim().toLowerCase();
        itemToShow = val === "" ? playlists : (playlists as PlaylistContainer[]).filter(i => i.data.name.toLowerCase().indexOf(val) !== -1);
    }}><br><br>
       <div class="flex hcenter gap wrap" style="align-items: stretch"> 
            {#each itemToShow as playlistItem, i (playlistItem.id)}
                {#if renderItems + (10 * Math.max(1, Math.floor(window.innerWidth / 400))) > i}
                <button class="emptyButton flex hcenter gap card maxWidth" style="display: flex; height: auto;" use:CheckOpenedResource={{id: playlistItem.id, waitUntilImageMap: `PlaylistImg-${playlistItem.id}`}} onclick={(e) => {
                    if ((e.target as HTMLElement).getAttribute("data-disableclick") !== null || (e.target as HTMLElement).closest("[data-disableclick]")) return; // Avoid playing the track if the user clicked on the three dots
                    const metadata = getMetadata(playlistItem);
                    if (!metadata || metadata.length === 0) return;
                    updateContent({
                        metadata: metadata,
                        type: "playlist",
                        albumArt: imageMap.get(`PlaylistImg-${playlistItem.id}`)?.src,
                        albumArtImg: imageMap.get(`PlaylistImg-${playlistItem.id}`),
                        playlistObject: playlists,
                        playlistId: playlistItem.id,
                    })}
                }>
                    {#await ArtistImageManager.fetchImage({author: playlistItem.data.name, artistImageDb: databases.playlistImgDb, isPlaylist: true, customQuery: playlistItem.id})}
                    {:then src}
                    <!-- svelte-ignore a11y_img_redundant_alt -->
                    <img use:AutoRevokeUrl alt={lang("Playlist picture")} src={URL.createObjectURL(src)} use:addImageToMap={`PlaylistImg-${playlistItem.id}`}>
                {/await}
                    <div class="maxWidth">
                        {playlistItem.data.name}
                    </div>
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div data-disableclick title={lang("Pin/unpin playlist")} onclick={async (e) => {
                        if (!playlists) return;
                        if (playlistItem.data.isPinned) { // Let's move the playlist below
                            let index = 0;
                            while (index < playlists.length) {
                                if (playlists[index].data.isPinned) {
                                    index++;
                                    continue;
                                };
                                if (playlists[index].data.name.localeCompare(playlistItem.data.name) === 1) break;
                                index++;
                            }
                            playlistItem.data.isPinned = undefined;
                            playlists.splice(index - 1, 0, ...playlists.splice(i, 1)); // We need to subtract "1" since, when we calculated the index, our playlists was still pinned. Since we first splice the item, and later add it again, we need to consider that item as removed
                        } else { // Let's move the playlist up, after all the previously pinned playlists
                            let index = playlists?.findIndex(i => !i.data.isPinned);
                            playlistItem.data.isPinned = Date.now();
                            playlists.splice(index, 0, ...playlists.splice(i, 1));
                        }
                        await IndexedDatabase.set({
                            db: databases.playlistDb,
                            request: "playlist",
                            object: {
                                id: playlistItem.id,
                                data: JSON.parse(JSON.stringify(playlistItem.data)) as playlistDB
                            }
                        })
                    }}>
                        <img use:AutoRevokeUrl style="width: 24px; height: 24px;" src={IconsManager.getIconObjectUrl(playlistItem.data.isPinned ? "pinoff" : "pin")} alt={lang("Pin/unpin playlist")}>
                    </div>
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div data-disableclick title={lang("Delete playlist")} onclick={async (e) => {
                        if (!confirm(`${lang("Do you want to delete this playlist")}: ${playlistItem.data.name}`)) return;
                        const mainBtn = (e.target as HTMLElement).closest("button");
                        if (mainBtn) {
                            mainBtn.style.opacity = "0";
                            await new Promise<void>(res => mainBtn.animate([{opacity: "1"},{opacity: "0"}], {duration: 400, easing: "ease-in-out"}).addEventListener("finish", () => res()));
                        }
                        HistoryHandler.backContext.deletePlaylist && HistoryHandler.backContext.deletePlaylist(playlistItem.id);
                        IndexedDatabase.remove({db: databases.playlistDb, request: "playlist", query: playlistItem.id});
                        IndexedDatabase.remove({db: databases.playlistImgDb, request: "playlistImg", query: playlistItem.id});
                    }}>
                        <img use:AutoRevokeUrl style="width: 24px; height: 24px;" src={IconsManager.getIconObjectUrl("delete")} alt={lang("Delete playlist")}>
                    </div>
                </button>
                {/if}
            {/each}
        </div>
        {#if (renderItems + (10 * Math.max(1, Math.floor(window.innerWidth / 400)))) < (itemToShow ?? playlists).length}
            <button class="btn" onclick={() => (renderItems += (10 * Math.max(1, Math.floor(window.innerWidth / 400))))}>{lang("Load more items")}</button>
        {/if}
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