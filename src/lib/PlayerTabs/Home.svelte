<script lang="ts">
    import { onMount } from "svelte";
    import type { DatabaseContainer } from "../../ts/Database/DatabaseInterfaces";
    import type { InfoProps, MetadataSource, PlaylistContainer, PossibleSortingOptions, RecentlyPlayed } from "../../ts/Player/PlayerInterfaces";
    import AutoRevokeUrl from "../../ts/SvelteComponentsHelpers/AutoRevokeUrl";
    import { addImageToMap, imageMap } from "../../ts/SvelteComponentsHelpers/GlobalInformation";
    import { lang } from "../../ts/SvelteComponentsHelpers/Language";
    import Card from "../Card.svelte";
    import LoadMetadata from "../../ts/DataFetcher/LoadMetadata";
    import GetAllPlaylists from "../../ts/DataFetcher/GetAllPlaylists";
    import GetAlbumArt from "../../ts/DataFetcher/GetAlbumArt";
    import ArtistImageManager from "../../ts/DataFetcher/ArtistImageManager";
    import GetAlbumArtId from "../../ts/DataFetcher/GetAlbumArtId";
    import getMetadataOfPlaylist from "../../ts/DataFetcher/GetMetadataOfPlaylist";
    import GetAudioFile from "../../ts/DataFetcher/GetAudioFile";
    import AudioManager from "../../ts/Player/AudioManager";
    import { getHomePageContent, saveHomePageContent, spliceHomePageContent } from "../../ts/DataFetcher/HomePageContent";
    import Settings from "../../ts/Settings";
    import CheckOpenedResource from "../../ts/SvelteComponentsHelpers/CheckOpenedResource";
    import AddLongPressEventForHomepage from "../../ts/SvelteComponentsHelpers/AddLongPressEventForHomepage";
    import HistoryHandler from "../../ts/Player/HistoryHandler";
    import UpdateRecentlyPlayed from "../../ts/SvelteComponentsHelpers/UpdateRecentlyPlayed";
    import IconsManager from "../../ts/Icons/IconsManager";
    import IndexedDatabase from "../../ts/Database/IndexedDatabase";
    import CloudStorage from "../../ts/Database/CloudStorage";
    /**
     * All the elements that have been recently played
     */
    let recentlyPlayedList = $state<RecentlyPlayed[]>(JSON.parse(localStorage.getItem("MusicPlayer-RecentlyPlayed") ?? "[]"));
    /**
     * All the metadata of the songs, divided by album. Requested only if used by the application.
     */
    let albumList: [string, MetadataSource[]][] | undefined = undefined;
    /**
     * A list of all the playlists saved by the user. Requested only if used by the application.
     */
    let playlistList: PlaylistContainer[] | undefined = undefined;
    /**
     * All the metadata of the songs, divided by artist. Requested only if used by the application.
     */
    let artistList: [string, MetadataSource[]][] | undefined= undefined;
    /**
     * All the metadata of the songs, divided by album artist. Requested only if used by the application.
     */
    let albumArtistList: [string, MetadataSource[]][] | undefined = undefined;
    /**
     * All the metadata of the songs, divided by single track. Requested only if used by the application
     */
    let trackList: MetadataSource[] | undefined = undefined;
    let {databases, updateContent, updateLoadedMetadata}: {
        /**
         * All the databases loaded by the application
         */
        databases: DatabaseContainer, 
        /**
         * Function called when the AlbumViewer should be opened. It passes the information about the clicked item.
         * @param content information about the clicked item
         */
        updateContent: (content: InfoProps) => void,
        /**
         * Update the `loadedMetadata` object from the App component with the one tied to the current type
         * @param loadedMetadata the metadata object used
         * @param type the type used to fetch the loadedMetadata object
         */
        updateLoadedMetadata: (loadedMetadata: [string, MetadataSource[]][], type: PossibleSortingOptions) => void
    } = $props();
    interface InformationToUse extends RecentlyPlayed {
        firstString: string,
        secondString?: string,
        albumArt: Promise<Blob>,
        /**
        * If the user has started dragging the element. If true, it shouldn't be removed
        */
        isBeingMoved?: boolean
    }
    /**
     * A list with the information necessary to render the **Recently played tab**
     */
    let dataToShow = $state<InformationToUse[]>([]);
    /**
     * A nested array, composed with [the name of the card to create, a list with the information necessary to render each song/album/artist etc. item]
     */
    let homeTabsContent = $state<[RecentlyPlayed["type"], InformationToUse[]][]>([]);
    /**
     * If true, the "long-press to remove" element won't be fired.
     */
    let disableRemoveEvent = false;
    /**
     * Get the information used to display each single card
     * @param item the RecentlyPlayed object fetched either from the Recently Played array or from the Homepage content lists.
     */
    async function getDisplayItem(item: RecentlyPlayed): Promise<InformationToUse | undefined> {
        switch(item.type) {
            case "album":
            case "track": {
                if (!albumList || !trackList) {
                    albumList = await LoadMetadata({metadataDb: databases.metadataDb}, "album");
                    trackList = albumList.map(i => i[1]).flat();
                }
                let albumArtId = item.id;
                let firstString = "";
                let secondString = "";
                if (item.type === "track") {
                    const track = trackList?.find(i => i.trackId === item.id);
                    if (!track) return;
                    firstString = `${track?.metadata.title}`;
                    secondString = `${track?.metadata.album} – ${track?.metadata.artist}`;
                    if (track) albumArtId = GetAlbumArtId({albumAuthor: track.metadata.albumArtist, albumName: track.metadata.album, year: track.metadata.year});
                } else {
                    const album = albumList.find(i => i[0] === albumArtId);
                    if (!album) return;
                    if (album) {
                        firstString = album[1][0].metadata.album;
                        secondString = album[1][0].metadata.albumArtist
                    }
                }
                return ({
                    firstString,
                    secondString,
                    albumArt: GetAlbumArt({db: databases.albumArtDb, id: albumArtId, name: firstString}),
                    ...item
                });
            }
            case "albumartist":
            case "artist": {
                if (item.type === "albumartist" && !albumArtistList) albumArtistList = await LoadMetadata({metadataDb: databases.metadataDb}, "albumauthors");
                if (item.type === "artist" && !artistList) artistList = await LoadMetadata({metadataDb: databases.metadataDb}, "authors");
                if (item.type === "artist" && !artistList?.find(i => i[0] === item.id)) return;
                if (item.type === "albumartist" && !albumArtistList?.find(i => i[0] === item.id)) return;
                return ({
                    firstString: item.id,
                    albumArt: ArtistImageManager.fetchImage({author: item.id, artistImageDb: databases.artistImgDb }),
                    ...item
                });
            }
            case "playlist": {
                if (!playlistList) playlistList = await GetAllPlaylists(databases.playlistDb);
                if (!albumList || !trackList) {
                    albumList = await LoadMetadata({metadataDb: databases.metadataDb}, "album");
                    trackList = albumList.map(i => i[1]).flat();
                }
                const playlist = playlistList?.find(i => i.id === item.id);
                if (!playlist) return;
                return ({
                    firstString: playlist?.data.name,
                    albumArt: ArtistImageManager.fetchImage({author: playlist?.data.name, artistImageDb: databases.playlistImgDb, isPlaylist: true, customQuery: playlist.id }),
                    ...item
                });
            }
        }
    }
    async function renderRecentlyPlayed() {
        dataToShow = [];
        let haveItemsBeenRemoved = false;
        for (let i = 0; i < recentlyPlayedList.length; i++) {
            const temp = await getDisplayItem(recentlyPlayedList[i]);
            if (!temp) { // Remove elements that are no longer available
                recentlyPlayedList.splice(i, 1);
                i--;
                haveItemsBeenRemoved = true;
            } else dataToShow.push(temp);
        }
        if (haveItemsBeenRemoved) {
            localStorage.setItem("MusicPlayer-RecentlyPlayed", JSON.stringify(recentlyPlayedList));
            IndexedDatabase.cloudHelper.driveSetWrapper({object: {id: "MusicPlayer-RecentlyPlayed", data: recentlyPlayedList as any}, request: "localStorageInfo"});
        }
    }
    async function renderHomepageContent() {
        homeTabsContent = [];
        const homePageContent = getHomePageContent();
        let haveItemsBeenRemoved = false;
        for (const type of Settings.homepage.contentToShow) {
            if (!homePageContent[type]) continue; // Skip if there are no elements inside that card
            homeTabsContent[homeTabsContent.length] = [type, []];
            for (let i = 0; i < homePageContent[type].length; i++) {
                const temp = await getDisplayItem({id: homePageContent[type][i], type});
                if (!temp) { // Remove elements that are no longer available
                    spliceHomePageContent(type, i, 1, true);
                    haveItemsBeenRemoved = true;
                    i--;
                } else homeTabsContent[homeTabsContent.length - 1][1].push(temp);
            }
        }
        if (haveItemsBeenRemoved) saveHomePageContent();
    }
    onMount(() => {
        (async () => {
            await renderRecentlyPlayed();
            await renderHomepageContent();
        })()
        HistoryHandler.backContext.deleteFromHomeTab = (data) => { // Function called when an element has been removed from the database, and so should be removed also from the webpage
            const dataIndex = dataToShow.findIndex(i => i.id === data.id && data.type === data.type);
            if (dataIndex !== -1) dataToShow.splice(dataIndex, 1);
            const entryIndex = homeTabsContent.find(i => i[0] === data.type)?.[1].findIndex(i => i.id === data.id);
            if (typeof entryIndex === "number" && entryIndex !== -1) homeTabsContent.find(i => i[0] === data.type)?.[1].splice(entryIndex, 1);
        }
        HistoryHandler.backContext.removeAlbumNameFromHomeTab = async (id) => { // Function called when the album ID has completely changed, so the album should be removed from the homepage
            const entryInData = dataToShow.findIndex(i => i.id === id);
            if (entryInData !== -1) dataToShow.splice(entryInData, 1);
            const albumIndex = homeTabsContent.findIndex(i => i[0] === "album");
            if (albumIndex === -1) return;
            const tabsIndex = homeTabsContent[albumIndex][1].findIndex(i => i.id === id);
            if (tabsIndex !== -1) homeTabsContent[albumIndex][1].splice(tabsIndex, 1);
        }
        // Now let's add the callbacks of a successful sync with Google Drive or OneDrive about the home stats
        let callbackIndex = CloudStorage.localStorageEditCallbacks.length;
        CloudStorage.localStorageEditCallbacks.push((name) => {
            switch(name) {
                case "MusicPlayer-RecentlyPlayed":
                    recentlyPlayedList = JSON.parse(localStorage.getItem("MusicPlayer-RecentlyPlayed") ?? "[]");
                    renderRecentlyPlayed();
                    break;
                case "MusicPlayer-HomePage":
                    renderHomepageContent();
                    break;
            }
        })
        return () => {
            HistoryHandler.backContext.deleteFromHomeTab = undefined;
            HistoryHandler.backContext.removeAlbumNameFromHomeTab = undefined;
            CloudStorage.localStorageEditCallbacks.splice(callbackIndex, 1);
        }
    })
</script>

{#snippet itemToPlay(recentlyPlayedItem: InformationToUse, isFromRecentlyPlayed?: boolean)}    

<button draggable={!isFromRecentlyPlayed} ondragover={(e) => e.preventDefault()} ondrop={isFromRecentlyPlayed ? undefined : async (e) => {
    e.preventDefault();
    const data = e.dataTransfer?.getData("text/plain");
    if (typeof data !== "undefined") {
        const tabContent = homeTabsContent.findIndex(i => i[0] === recentlyPlayedItem.type);
        if (tabContent === -1) return;
        const num = homeTabsContent[tabContent][1].findIndex(i => i.id === data);
        const prevPosition = homeTabsContent[tabContent][1].findIndex(i => i.id === recentlyPlayedItem.id);
        if (prevPosition === -1 || prevPosition === num || num === -1 || homeTabsContent[tabContent][1][prevPosition].type !== homeTabsContent[tabContent][1][num].type) return;
        homeTabsContent[tabContent][1].splice(prevPosition, 0, ...homeTabsContent[tabContent][1].splice(num, 1));
        spliceHomePageContent(recentlyPlayedItem.type, prevPosition, 0, false, ...spliceHomePageContent(recentlyPlayedItem.type, num, 1, true));
    }
}} ondragstart={(e) => {
    e.dataTransfer?.setData("text/plain", recentlyPlayedItem.id);
    recentlyPlayedItem.isBeingMoved = true;
}} class="emptyButton card" style={`height: auto; background-color: var(--secondcard); max-height: 35vh;${isFromRecentlyPlayed ? "" : " -webkit-user-drag: element;"}`} use:AddLongPressEventForHomepage={{...recentlyPlayedItem, checkIfIsBeingMoved: () => disableRemoveEvent || !!recentlyPlayedItem.isBeingMoved, callback: (success) => {
    const index = homeTabsContent.findIndex(i => i[0] === recentlyPlayedItem.type);
    if (success) {
        if (index === -1) {
            homeTabsContent.push([recentlyPlayedItem.type, [recentlyPlayedItem]]);
        } else homeTabsContent[index][1].push(recentlyPlayedItem);
    } else {
        if (index !== -1) {
            const songIndex = homeTabsContent[index][1].findIndex(i => i.id === recentlyPlayedItem.id);
            if (songIndex !== -1) homeTabsContent[index][1].splice(songIndex, 1);
        }
    }
} }} use:CheckOpenedResource={recentlyPlayedItem.type === "track" ? "no" : recentlyPlayedItem.type === "album" ? `${isFromRecentlyPlayed ? "FromRecentlyPlayed" : ""}${recentlyPlayedItem.id}` : {id: recentlyPlayedItem.id, waitUntilImageMap: `${isFromRecentlyPlayed ? "FromRecentlyPlayed" : ""}${recentlyPlayedItem.type === "playlist" ? "PlaylistImg" : "ArtistImg"}-${recentlyPlayedItem.id}`}} onclick={async (e) => {
    if ((e.target as HTMLElement).getAttribute("data-disableclick") !== null || (e.target as HTMLElement).closest("[data-disableclick]")) return; // Avoid playing the track if the user clicked on the delete icon
    switch(recentlyPlayedItem.type) {
        case "album":
            albumList && updateLoadedMetadata(albumList, "album");
            updateContent({
                albumArt: await recentlyPlayedItem.albumArt ?? undefined,
                type: "album",
                metadata: albumList?.find(i => i[0] === recentlyPlayedItem.id)?.[1] as MetadataSource[],
                albumArtImg: imageMap.get(`${isFromRecentlyPlayed ? "FromRecentlyPlayed" : ""}AArt-${recentlyPlayedItem.id}`) ?? undefined,
                isFromRecentlyPlayed
            });
            break;
        case "albumartist":
        case "artist": {
            const isAlbumArtist = recentlyPlayedItem.type === "albumartist";
            updateLoadedMetadata((isAlbumArtist ? albumArtistList : artistList) as [string, MetadataSource[]][], isAlbumArtist ? "albumauthors" : "authors");
            updateContent({
                metadata: ((isAlbumArtist ? albumArtistList : artistList)?.find(i => i[0] === recentlyPlayedItem.id) as [string, MetadataSource[]])[1],
                passedId: recentlyPlayedItem.id,
                type: isAlbumArtist ? "albumArtist" : "artist",
                albumArt: imageMap.get(`${isFromRecentlyPlayed ? "FromRecentlyPlayed" : ""}ArtistImg-${recentlyPlayedItem.id}`)?.src,
                albumArtImg: imageMap.get(`${isFromRecentlyPlayed ? "FromRecentlyPlayed" : ""}ArtistImg-${recentlyPlayedItem.id}`),
                isFromRecentlyPlayed
            });
            break;
        }
        case "playlist": {
            const newMetadata = getMetadataOfPlaylist(playlistList?.find(i => i.id === recentlyPlayedItem.id) as PlaylistContainer, albumList as [string, MetadataSource[]][]);
            if (!newMetadata || newMetadata.length === 0) return;
            updateContent({
                metadata: newMetadata,
                type: "playlist",
                albumArt: imageMap.get(`${isFromRecentlyPlayed ? "FromRecentlyPlayed" : ""}PlaylistImg-${recentlyPlayedItem.id}`)?.src,
                albumArtImg: imageMap.get(`${isFromRecentlyPlayed ? "FromRecentlyPlayed" : ""}PlaylistImg-${recentlyPlayedItem.id}`),
                playlistObject: playlistList,
                playlistId: recentlyPlayedItem.id,
                isFromRecentlyPlayed
            });
            break;
        }
        case "track": {
            const trackMetadata = trackList?.find(i => i.trackId === recentlyPlayedItem.id);
            if (!trackMetadata) return;
            const getAudio = await GetAudioFile({songDb: databases.songDb, songId: recentlyPlayedItem.id, metadataDb: databases.metadataDb});
            AudioManager.playAudio({
                file: getAudio,
                metadata: trackMetadata,
                albumArt: await recentlyPlayedItem.albumArt
            });
            AudioManager.audioContext.queue = [{...trackMetadata, queueId: crypto.randomUUID()}];
            AudioManager.audioContext.originalQueue = [...AudioManager.audioContext.queue];
            AudioManager.audioContext.queuePosition = 0;
            AudioManager.audioContext.playlistId = null;
            UpdateRecentlyPlayed({type: "track", id: recentlyPlayedItem.id, date: Date.now()});
        }
    }
}}>
    <div style="height: 100%; padding: 5px 0px; max-height: calc(35vh - 30px); flex-direction: column;" class="flex">
    {#if isFromRecentlyPlayed}
    <p style="margin-top: 0px; margin-bottom: 10px; color: var(--secondtext); flex-shrink: 0;" >{lang(recentlyPlayedItem.type === "albumartist" ? "Album artists" : `${recentlyPlayedItem.type[0].toLocaleUpperCase()}${recentlyPlayedItem.type.substring(1)}`)} <span role="button" data-disableclick onclick={() => {
        const index = recentlyPlayedList.findIndex(i => i.id === recentlyPlayedItem.id);
        if (index !== -1) {
            recentlyPlayedList.splice(index, 1);
            const dataIndex = dataToShow.findIndex(i => i.id === recentlyPlayedItem.id);
            if (dataIndex !== -1) dataToShow.splice(dataIndex, 1);
            localStorage.setItem("MusicPlayer-RecentlyPlayed", JSON.stringify(recentlyPlayedList));
            IndexedDatabase.cloudHelper.driveSetWrapper({object: {id: "MusicPlayer-RecentlyPlayed", data: recentlyPlayedList as any}, request: "localStorageInfo"});
        }
    }}>
        <img use:AutoRevokeUrl style="width: 14px; height: 14px; transform: translateY(3px)" src={IconsManager.getIconObjectUrl("dismiss", "--secondtext")} alt={lang("Remove from recently played")}>
</span></p>
    {/if}
        <div class="flex wcenter" style="flex-shrink: 1; min-height: 0;">
        <div>
            {#await recentlyPlayedItem.albumArt}
            {:then blob}
                <div style="height: 100%;">
                    <img style="height: 100%; aspect-ratio: 1/1; max-height: fit-content; max-width: fit-content" use:AutoRevokeUrl
                    use:addImageToMap={`${isFromRecentlyPlayed ? "FromRecentlyPlayed" : ""}${recentlyPlayedItem.type === "playlist" ? "PlaylistImg" : recentlyPlayedItem.type === "album" ? "AArt" : "ArtistImg"}-${recentlyPlayedItem.id}`}
                    src={URL.createObjectURL(blob)}
                    alt={lang("Album art")}>
                </div>
            {/await}
        </div>
        </div>
        <div style="flex-shrink: 0;">
            <p>{recentlyPlayedItem.firstString}</p>
            {#if recentlyPlayedItem.secondString}
            <p style="color: var(--secondtext); margin-bottom: 0px">{recentlyPlayedItem.secondString}</p>
            {/if}
        </div>
    </div>

</button>
{/snippet}
<h2>{lang("Home")}:</h2>
<Card>
    <h3>{lang("Your recent picks")}:</h3>
    <div class={`flex gap${!Settings.homepage.scrollRecentlyPlayed ? " hcenter wrap" : " forceWidth"}`} style={`align-items: stretch;${!Settings.homepage.scrollRecentlyPlayed ? "" : " overflow: auto"}`}>
        {#each dataToShow as recentlyPlayedItem (`${recentlyPlayedItem.type}-${recentlyPlayedItem.id}`)}
            {@render itemToPlay(recentlyPlayedItem, true)}
        {/each}
    </div>
    {#if Settings.homepage.scrollRecentlyPlayed}
    <br>
    <i>{lang("Scroll for more")}</i>
    {/if}
</Card><br>
{#each homeTabsContent as [type, infoList] (type)}
<Card>
    <h3>{lang(`Your pinned ${type === "albumartist" ? "album artists" : `${type}s`}`)}</h3>
    <div class={`flex gap${!Settings.homepage.scrollOtherContent ? " hcenter wrap" : " forceWidth"}`} style={`align-items: stretch;${!Settings.homepage.scrollOtherContent ? "" : " overflow: auto"}`}>
        {#each infoList as information (information.id)}
            {@render itemToPlay(information)}
        {/each}
    </div>
    {#if Settings.homepage.scrollOtherContent}
    <br>
    <i>{lang("Scroll for more")}</i>
    {/if}
</Card><br>
{/each}
<p>{lang("You can pin tracks, albums, artists and playlists to the homepage by long pressing them. To move their position, drag and drop them")}.</p>
<label class="flex hcenter gap">
    <input type="checkbox" bind:checked={disableRemoveEvent}>{lang("Disable removing elements by long-pressing them. This should permit you to drag and drop elements also on mobile devices")}.
</label><br>
<style>
    img {
        border-radius: 12px;
    }
    img, .limitText {
        width: 100%;
    }
    .forceWidth > .card {
        max-width: min(45vw, 250px);
        flex-shrink: 0;
    }
    .forceWidth p {
        word-break: break-word;
    }
    .wrap > * {
        flex: 1 0 min(250px, 100%);
    }
</style>