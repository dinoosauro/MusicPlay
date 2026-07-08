<script lang="ts">
    import { onMount } from "svelte";
    import type { OpacityChange } from "../ts/Animations/AnimationTypes";
    import AudioManager from "../ts/Player/AudioManager";
    import ConvertSecondsInTimestamp from "../ts/SvelteComponentsHelpers/ConvertSecondsInTimestamp";
    import type { DatabaseContainer, playlistDB, songsStatsDB } from "../ts/Database/DatabaseInterfaces";
    import GetAlbumArtId from "../ts/DataFetcher/GetAlbumArtId";
    import GetAudioFile from "../ts/DataFetcher/GetAudioFile";
    import type { FilterType, MetadataSource, MetadataSourcePlaylist, PlaylistContainer, PossibleSortingOptions } from "../ts/Player/PlayerInterfaces";
    import BackButton from "./BackButton.svelte";
    import ArtistEditor from "./MetadataEditor/ArtistEditor.svelte";
    import IconsManager from "../ts/Icons/IconsManager";
    import {registerEmptySpace} from "../ts/SvelteComponentsHelpers/EmptySpace"
    import AlbumInformationEditor from "./MetadataEditor/AlbumInformationEditor.svelte";
    import SongMetadataEditor from "./MetadataEditor/SongMetadataEditor.svelte";
    import HistoryHandler from "../ts/Player/HistoryHandler";
    import IndexedDatabase from "../ts/Database/IndexedDatabase";
    import SortAlbumTracks from "../ts/Database/SortAlbumTracks";
    import { mediaPlayerObject } from "../ts/Animations/CrossComponentAnimationsInfo";
    import { slide } from "svelte/transition";
    import { cubicInOut } from "svelte/easing";
    import SongMoreOptions from "./DropdownMenu/SongMoreOptions.svelte";
    import PlaylistEditor from "./MetadataEditor/PlaylistEditor.svelte";
    import SongStats from "./Dialogs/SongStats.svelte";
    import AutoRevokeUrl from "../ts/SvelteComponentsHelpers/AutoRevokeUrl";
    import { lang } from "../ts/SvelteComponentsHelpers/Language";
    import GetNewItemInMetadataListPosition from "../ts/DataFetcher/AddItemToMetadataList";
    import GetAlbumArt from "../ts/DataFetcher/GetAlbumArt";
    import SelectHelper from "../ts/SvelteComponentsHelpers/SelectHelper";
    import SelectableMusic from "../ts/SvelteComponentsHelpers/SelectableMusic";
    import MovePlaylistItem from "../ts/Database/MovePlaylistItem";

    const {
        songs,
        allMetadataLoaded,
        albumArt,
        databases,
        imageTransitionCallback,
        skipHistoryUrl,
        contentType,
        mediaControllerDiv,
        playlistContainer,
        playlistId,
        sortingType,
        selectCallback
    }: {
        /**
         * All the songs that should be displayed in the viewer
         */
        songs: (MetadataSource | MetadataSourcePlaylist)[];
        /**
         * All the metadata that have been fetched by the application.
         * This should be passed also here on the AlbumViewer so that, if the user edits the metadata and a new album/artist is created, it can be automatically added to the list.
         */
        allMetadataLoaded: [string, MetadataSource[]][]
        /**
         * The thumbnail to display and to use as a background image
         */
        albumArt?: Blob | string;
        /**
         * All the databases the appplicaiton uses
         */
        databases: DatabaseContainer;
        /**
         * If true, the application won't add a new URL (#metadataList) in the application history
         */
        skipHistoryUrl?: boolean,
        /**
         * From which section of the application this component has been called. For example, if it has been called from the "Artists" view, the "Album" view and so on
         */
        contentType?: FilterType,
        /**
         * The div of the floating album player
         */
        mediaControllerDiv: HTMLDivElement,
        /**
         * All the playlists that have been loaded by the application. This value, along with playlistId, should only be passed if `filterType` is set to `playlist`
         */
        playlistContainer?: PlaylistContainer[],
        /**
         * The ID of the playlist that is being shown here.
         */
        playlistId?: string,
        /**
         * How the `allMetadataLoaded` object has been sorted
         */
        sortingType: PossibleSortingOptions,
        /**
         * Function to call when the user selects or deselects a track
         */
        selectCallback: () => void
        /**
         * Function called when the album art has been loaded. This function is used so that a custom animation can be triggered.
         * @param img the element where the album art is shown
         * @param opacityChange the elements that should have their opacity changed
         */
        imageTransitionCallback: (
            img: HTMLImageElement,
            opacityChange: OpacityChange[],
        ) => void;
    } = $props();
    /**
     * Main container of the album viewer
     */
    let main: HTMLDivElement;
    /**
     * Container of all the album/artist/etc information, including all the tracks
     */
    let infoContainer: HTMLDivElement;
    /**
     * The div that contains the background blurred album art
     */
    let albumArtBackground: HTMLElement;
    /**
     * If the transition from the App component to the viewer has already been done
     */
    let isImageTransitionDone = $state(false);
    /**
     * The div that contains the button to go back to the previous section
     */
    let backButtonContainer: HTMLElement;
    /**
     * The image element that displays the album art
     */
    let mainAlbumArt: HTMLImageElement;
    /**
     * The link that contains the current album art
     */
    let outputAlbumArtSrc = $state(typeof albumArt === "string" ? albumArt : albumArt ? URL.createObjectURL(albumArt) : IconsManager.getIconObjectUrl("cd"));
    /**
     * If not undefined, it indicates the position of the song in the `songs` object whose stats should be displayed.
     */
    let showStatsDialog = $state<number | undefined>(undefined);
        /**
         * If true, the `allMetadataLoaded` array is sorted in reverse (from Z to A)
         */
    let isListInReverse = false;
    if (allMetadataLoaded.length > 1) {
        let [firstMetadataToCompare, secondMetadataToCompare] = sortingType === "album" ? [allMetadataLoaded[0][1][0].metadata.album, allMetadataLoaded[1][1][0].metadata.album] : [allMetadataLoaded[0][0], allMetadataLoaded[1][0]]
        isListInReverse = firstMetadataToCompare.localeCompare(secondMetadataToCompare) === 1;
    }
    onMount(() => {
        // Let's update the state of the current page, by adding the ID that can be used to get the image from which the transition originated. In this way, we can permit to trigger that animation even using browser's next/previous page controls
        const state = !contentType || contentType === "album" ? `AArt-${GetAlbumArtId({
            albumAuthor: songs[0].metadata.albumArtist,
            year: songs[0].metadata.year,
            albumName: songs[0].metadata.album
        })}` : `${contentType === "playlist" ? "PlaylistImg" : "ArtistImg"}-${contentType === "playlist" ? playlistId : songs[0].metadata[contentType === "artist" ? "artist" : "albumArtist"]}`;
        if (!skipHistoryUrl) {
            history.pushState(state, "", `./#metadataList`);
            HistoryHandler.prevImageId = state;
        }
        document.body.style.overflow = "hidden"; // Avoid that the user can continue to scroll the album/artist/etc list
        // Let's update some properties that are used when closing the album list viewer
        mediaPlayerObject.container = main;
        mediaPlayerObject.backButtonContainer = backButtonContainer;
        mediaPlayerObject.image = mainAlbumArt;
        if (playlistContainer) {
            mediaPlayerObject.sortPlaylist = (id: string, skipSaving?: boolean) => {
                /**
                 * Sort the two playlist entries according to their album name. 
                 * This should be done as a fallback if the value of any other sorting between two values is set to zero.
                 */
                function getAlbumSort(a: MetadataSource, b: MetadataSource) {
                    const fisrtNum = ((a.metadata.albumSort ?? a.metadata.album).localeCompare(b.metadata.albumSort ?? b.metadata.album));
                    if (fisrtNum !== 0) return fisrtNum;
                    return SortAlbumTracks(a, b);
                }
                let playlistIndex = playlistContainer.findIndex(i => i.id === playlistId);
                if (playlistIndex === -1) return;
                switch(id) {
                    case "sortAlbum": {
                        songs.sort((a, b) => getAlbumSort(a, b));
                        playlistContainer[playlistIndex].data.orderType = "album";
                        if (!skipSaving) playlistContainer[playlistIndex].data.reversed = false;
                        break;
                    }
                    case "sortArtist": {
                        songs.sort((a, b) => {
                            const num = (a.metadata.artistSort ?? a.metadata.artist).localeCompare(b.metadata.artistSort ?? b.metadata.artist);
                            if (num !== 0) return num;
                            return getAlbumSort(a, b);
                        });
                        playlistContainer[playlistIndex].data.orderType = "artist";
                        if (!skipSaving) playlistContainer[playlistIndex].data.reversed = false;
                        break;
                    }
                    case "sortAlbumArtist": {
                        songs.sort((a, b) => {
                            const num = (a.metadata.albumArtistSort ?? a.metadata.albumArtist).localeCompare(b.metadata.albumArtistSort ?? b.metadata.albumArtist);
                            if (num !== 0) return num;
                            return getAlbumSort(a, b);
                        });
                        playlistContainer[playlistIndex].data.orderType = "albumArtist";
                        if (!skipSaving) playlistContainer[playlistIndex].data.reversed = false;
                        break;
                    }
                    case "sortTitle": {
                        songs.sort((a, b) => {
                            const num = (a.metadata.title).localeCompare(b.metadata.title);
                            if (num !== 0) return num;
                            return getAlbumSort(a, b);
                        });
                        playlistContainer[playlistIndex].data.orderType = "title";
                        if (!skipSaving) playlistContainer[playlistIndex].data.reversed = false;
                        break;
                    }
                    case "sortCustom": {
                        // Since the user might have added multiple entries of the same song, we need to make sure that we don't pick the same object multiple times (since otherwise the `trackId` property would be the same, and Svelte would trigger an error). Therefore, we need to create a copy of the song array, and then we splice each entry we add to the output array
                        let output: MetadataSource[] = [];
                        let songTemp = [...songs];
                        for (const item of playlistContainer[playlistIndex].data.contents) {
                            const index = songTemp.findIndex(i => i.trackId === item);
                            if (index !== -1) output.push(...songTemp.splice(index, 1));
                        }
                        songs.splice(0, songs.length, ...output);
                        playlistContainer[playlistIndex].data.orderType = undefined;
                        if (!skipSaving) playlistContainer[playlistIndex].data.reversed = false;
                        break;
                    }
                    case "sortReverse": {
                        songs.reverse();
                        if (!skipSaving) playlistContainer[playlistIndex].data.reversed = !playlistContainer[playlistIndex].data.reversed;
                        break;
                    }
                }
                if (!skipSaving) IndexedDatabase.set({
                    db: databases.playlistDb,
                    request: "playlist",
                    object: {
                        id: playlistContainer[playlistIndex].id,
                        data: JSON.parse(JSON.stringify(playlistContainer[playlistIndex].data)) as playlistDB
                    }
                });
                arePlaylistItemsDraggable = !playlistContainer[playlistIndex].data.orderType;
            }
            // Let's find the current playlist object, so that we can restore the sorting applied the last time
            const currentPlaylistObject = playlistContainer.find(i => i.id === playlistId);
            if (currentPlaylistObject && mediaPlayerObject.sortPlaylist) {
                if (currentPlaylistObject.data.orderType) mediaPlayerObject.sortPlaylist(currentPlaylistObject.data.orderType === "album" ? "sortAlbum" : currentPlaylistObject.data.orderType === "artist" ? "sortArtist" : currentPlaylistObject.data.orderType === "albumArtist" ? "albumArtist" : "title", true);
                if (currentPlaylistObject.data.reversed) mediaPlayerObject.sortPlaylist("sortReverse", true);
            }

        }
        return () => {
            mediaPlayerObject.container = undefined;
            mediaPlayerObject.backButtonContainer = undefined;
            mediaPlayerObject.image = undefined;
            mediaPlayerObject.sortPlaylist = undefined;
        }
    });
    let arePlaylistItemsDraggable = $state((playlistContainer && playlistId && !playlistContainer.find(i => i.id === playlistId)?.data.orderType) || false)
    /**
     * The metadata viewer dialog that should be shown
     */
    let showMetadataEditor = $state<"none" | "album" | "author" | number>("none");
    /**
     * The entry of the song stats database that should be shown in the dialog.
     */
    let songStats: songsStatsDB;
    $effect(() => {
        mediaControllerDiv.style.opacity = showMetadataEditor !== "none" ? "0" : "1"; // Hide the metadata editor if a dialog is shown. _I don't think this is necessary now, but it certainly was before._
    })
    $effect(() => {
        if (songs.length === 0) { // No songs available, let's go back. And also, let's tell the "popstate" function to delete both from the DOM and from the database this entry
            HistoryHandler.backContext.delete = true;
            HistoryHandler.goBack();
        }
    })
</script>

<div
    bind:this={main}
    class="mainBodyHover"
>
    <div bind:this={albumArtBackground} class="backgroundImage opacity" style="background-color: var(--background);">
        {#if albumArt}
            <img
                src={outputAlbumArtSrc}
                alt=""
                bind:this={albumArtBackground}
            />
        {/if}
    </div>

    <div>
        {#if showMetadataEditor === "author" && playlistContainer && playlistId}
            <PlaylistEditor {songs} deleteCallback={async () => {
                playlistContainer.find(i => i.id === playlistId)?.data.contents.splice(0);
                songs.splice(0, songs.length);
            }} albumArt={outputAlbumArtSrc} closeCallback={(imgSrc) => {
                    showMetadataEditor = "none";
                    if (imgSrc) outputAlbumArtSrc = imgSrc;
            }} {playlistId} playlists={playlistContainer} playlistImgDb={databases.playlistImgDb} ></PlaylistEditor>
        {:else if showMetadataEditor === "author"}
                <ArtistEditor closeCallback={(imgSrc) => {
                    showMetadataEditor = "none";
                    if (imgSrc) outputAlbumArtSrc = imgSrc;
                }} artistImgDb={databases.artistImgDb} artistAlbumArt={outputAlbumArtSrc} artistId={contentType === "artist" ? songs[0].metadata.artist : songs[0].metadata.albumArtist}></ArtistEditor>
        {:else if showMetadataEditor === "album"}
            <AlbumInformationEditor closeCallback={async (imgSrc, requireIdUpdate) => {
                showMetadataEditor = "none";
                if (imgSrc) outputAlbumArtSrc = imgSrc;
                if (requireIdUpdate) {
                    // NOTE: AlbumInformationEditor can be shown only in "Album" mode. Therefore, this code will "reason" only for that specific occasion.
                    const newId = GetAlbumArtId({albumAuthor: songs[0].metadata.albumArtist, year: songs[0].metadata.year, albumName: songs[0].metadata.album});
                    // Since we've changed the album name (or the year/artists) for all songs, we need to move the album art from the old entry in the database to the new album ID.
                    await IndexedDatabase.remove({db: databases.albumArtDb, request: "albumArt", query: history.state.substring(history.state.indexOf("-") + 1)}); 
                    const outputReq = await fetch(outputAlbumArtSrc);
                    await IndexedDatabase.set({
                        db: databases.albumArtDb,
                        request: "albumArt",
                        object: {
                            id: newId,
                            data: {img: await outputReq.blob()}
                        }
                    });
                    // Now, we also need to update the ID from the `allMetadataLoaded` object, so that, if the user goes back and later opens again the album, they still can view all the information. Therefore, we need to find the position where the album was stored, and change its key
                    const currentAlbumIndex = allMetadataLoaded.findIndex(i => i[1][0].trackId === songs[0].trackId);
                    if (currentAlbumIndex !== -1) {
                        allMetadataLoaded[currentAlbumIndex][0] = newId;
                    }
                    history.replaceState(`AArt-${newId}`, "");
                    HistoryHandler.prevImageId = `AArt-${newId}`;
                }
            }} albumArtDb={databases.albumArtDb} metadataDb={databases.metadataDb} albumArt={outputAlbumArtSrc} {songs}></AlbumInformationEditor>
        {:else if showMetadataEditor !== "none"}
            <SongMetadataEditor albumArtDb={databases.albumArtDb} metadataDb={databases.metadataDb} songs={songs} songNumber={showMetadataEditor} context={contentType ?? "album"} closeCallback={async (removeFromList) => {
                if (typeof removeFromList !== "undefined") HistoryHandler.closeCommand = undefined; // The application must go back to the previous page, and we also need the standard events to fire (and this would be impossible if the "closeCommand" was a function, since it would prevent the other events from running)
                showMetadataEditor = "none";
                if (typeof removeFromList !== "undefined") { // We need to remove an item from the current list, probably because their album/artist/etc name has been changed. 
                // NOTE: This function is never called from the "Tracks" or "Playlist" context.
                    const item = [songs[removeFromList]];
                    const newId = contentType === "artist" || contentType === "albumArtist" ? `ArtistImg-${item[0].metadata[contentType === "artist" ? "artist" : "albumArtist"]}` : `AArt-${GetAlbumArtId({
                        albumAuthor: item[0].metadata.albumArtist,
                        year: item[0].metadata.year,
                        albumName: item[0].metadata.album
                    })}`;
                    // If the current item was the last one, we can remove the artist/album image from the database to save space.
                    if (songs.length === 1) await IndexedDatabase.remove({db: contentType === "artist" || contentType === "albumArtist" ? databases.artistImgDb : databases.albumArtDb, query: history.state.substring(history.state.indexOf("-") + 1), request: contentType === "artist" || contentType === "albumArtist" ? "artistImg" : "albumArt"}); 
                    // Let's now find the property where the song should be added
                    const newEntryId = allMetadataLoaded.findIndex(i => i[0] === newId.substring(newId.indexOf("-") + 1));
                    const newEntry = allMetadataLoaded[newEntryId];
                    if (!newEntry) { // We need to create a new album/artist/etc entry, since it's a new name. Therefore, we also need to create a new entry for the album art
                        const req = await fetch(outputAlbumArtSrc);
                        await IndexedDatabase.set({
                            db: contentType === "artist" || contentType === "albumArtist" ? databases.artistImgDb : databases.albumArtDb,
                            request: contentType === "artist" || contentType === "albumArtist" ? "artistImg" : "albumArt",
                            object: {
                                id: newId.substring(newId.indexOf("-") + 1),
                                data: {img: await req.blob()}
                            }
                        });            
                        allMetadataLoaded.splice(GetNewItemInMetadataListPosition({allMetadataLoaded, contentType: sortingType, isReversed: isListInReverse, itemToAdd: item[0]}), 0, [newId.substring(newId.indexOf("-") + 1), item]);
                    } else { // We just need to append this song to the previous element list
                        let i = 0;
                        while (i < newEntry[1].length) {
                            if (SortAlbumTracks(newEntry[1][i], item[0]) > 0) break;
                            i++;
                        }
                        newEntry[1].splice(i, 0, item[0]);
                    }
                    songs.splice(removeFromList, 1);
                }
            }}></SongMetadataEditor>
        {/if}
        {#if typeof showStatsDialog !== "undefined"}
            <SongStats songMetadata={songs[showStatsDialog]} songStats={songStats} closeCallback={() => (showStatsDialog = undefined)}></SongStats>
        {/if}
        <div style="margin: 5px; position: fixed" bind:this={backButtonContainer}>
            <BackButton></BackButton>
        </div>
        <div style="height: 70px;"></div>
        <div class="flex wcenter" style="flex-direction: column;">
            <div style="max-height: 40vh; display: flex" class="flex wcenter">
            <span class="hoverBtn">
                <button class="emptyButton" title={lang("Album art")} onclick={() => {
                showMetadataEditor = contentType === "albumArtist" || contentType === "artist" || contentType === "playlist" ? "author" : "album";
            }}>
<img
    alt={lang("Album art")}
    class="imgBoxShadow mainImageSize"
    onload={async (e) => {
        !isImageTransitionDone && await imageTransitionCallback(e.target as HTMLImageElement, [
            {
                element: albumArtBackground,
                opacityChange: "start",
            },
            {
                element: e.target as HTMLImageElement,
                opacityChange: "end",
            },
            {
                element: infoContainer,
                opacityChange: "end",
            }, {
                element: backButtonContainer.firstChild as HTMLElement,
                opacityChange: "start"
            }
        ])
        isImageTransitionDone = true;
        }}
    onerror={async (e) => {
        !isImageTransitionDone && await imageTransitionCallback(e.target as HTMLImageElement, [
            {
                element: albumArtBackground,
                opacityChange: "start",
            },
            {
                element: e.target as HTMLImageElement,
                opacityChange: "end",
            },
            {
                element: infoContainer,
                opacityChange: "end",
            }, 
            {
                element: backButtonContainer.firstChild as HTMLElement,
                opacityChange: "start"
            }
        ])
        isImageTransitionDone = true;
        }}
    style="border-radius: 12px; object-fit: cover; opacity: 0"
    bind:this={mainAlbumArt}
    src={outputAlbumArtSrc}
/>
                </button>
                {#if isImageTransitionDone}
                <button title={lang("Edit data")} class="emptyButton opacity flex hcenter wcenter circularButton hoveredBtn" style="display: flex; height: unset">
                    <img use:AutoRevokeUrl style="width: 24px; height: 24px; padding: 5px" class="icon" src={IconsManager.getIconObjectUrl("edit")} alt={lang("Edit data")}>
                </button>
                {/if}
                </span>
            </div>
        </div>
        <div class="opacity" bind:this={infoContainer}>
            {#if songs.length !== 0}
            <br />
            <h2 style="text-align: center; margin-bottom: 10px; overflow-wrap: anywhere;">
                {contentType === "playlist" ? playlistContainer?.find(i => i.id === playlistId)?.data.name : contentType === "artist" ? songs[0].metadata.artist : contentType === "albumArtist" ? songs[0].metadata.albumArtist : songs[0].metadata.album}
            </h2>
            {#if !contentType || contentType === "album"}
            <div
                style="font-size: 18px; color: var(--secondtext); text-align: center; margin-bottom: 0px; overflow-wrap: anywhere;"
            >
                {songs[0].metadata.albumArtist}
            </div>
            {/if}
            <div style="height: 15px"></div>
            {#each songs as song, i ((song as MetadataSourcePlaylist).playlistId ?? song.trackId)}
                {#if contentType === "album" && ((i === 0 && songs.some(a => a.metadata.disk !== songs[i].metadata.disk)) || (i !== 0 && songs[i].metadata.disk !== songs[i-1].metadata.disk))}
                <div class="flex hcenter gap" style="padding: 10px" out:slide={{duration: 200, easing: cubicInOut}}>
                    <img use:AutoRevokeUrl class="icon" src={IconsManager.getIconObjectUrl("cd", "--secondtext")} alt={lang("CD icon")}>
                    <p class="secondaryMetadata" style="font-size: 14px; margin: 0">{lang("Disk")} {songs[i].metadata.disk}</p>
                </div>
                {/if}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <div use:SelectableMusic.addToList={(song as MetadataSourcePlaylist).playlistId ?? song.trackId} class="flex" style={`padding: 10px; border-radius: 12px;${SelectHelper.selectedItems.has(song.trackId) ? " background-color: var(--cardtransparent)" : ""}`} draggable={arePlaylistItemsDraggable} role="button" tabindex={i} ondragover={(e) => {
                    e.preventDefault();
                }} onclick={(e) => {
                    if (SelectHelper.isSelectModeEnabled) { // Update the list of selected tracks by adding/removing this track
                        const id = (song as MetadataSourcePlaylist).playlistId ?? song.trackId;
                        SelectHelper.selectedItems[SelectHelper.selectedItems.has(id) ? "delete" : "add"](id);
                        const element = SelectableMusic.list.get(id);
                        if (element) (element as HTMLElement).style.backgroundColor = !SelectHelper.selectedItems.has(id) ? "" : "var(--cardtransparent)";
                        selectCallback();
                    }
                }} ondrop={async (e) => { // Let's move the element from the playlist
                    e.preventDefault();
                    const data = e.dataTransfer?.getData("text/plain");
                    if (typeof data !== "undefined") {
                        let num = +data;
                        if (num === i) return;
                        songs.splice(i, 0, ...songs.splice(num, 1));
                        if (!playlistContainer) return;
                        const playlistIndex = playlistContainer.findIndex(i => i.id === playlistId);
                        if (playlistIndex !== -1) {
                            await MovePlaylistItem({
                                sourcePosition: playlistContainer[playlistIndex].data.reversed ? playlistContainer[playlistIndex].data.contents.length - num - 1 : num,
                                destinationPosition: playlistContainer[playlistIndex].data.reversed ? playlistContainer[playlistIndex].data.contents.length - i - 1 : i,
                                playlist: playlistContainer[playlistIndex],
                                playlistDb: databases.playlistDb
                            });
                        }
                    }
                }} ondragstart={(e) => {
                    e.dataTransfer?.setData("text/plain", i.toString());
                    }} out:slide={{duration: 200, easing: cubicInOut}}>
                    <button onclick={() => {
                        showMetadataEditor = i;
                    }} style="width: 40px; height: 100%" class="emptyButton hoverBtn">
                        <span style="color: var(--secondtext);"
                            >{song.metadata.track ?? "-"}{song.metadata
                                .track === null
                                ? ""
                                : "."}</span>
                <div class="emptyButton opacity flex hcenter wcenter circularButton hoveredBtn" style="display: flex; height: unset; top: 50%; left: 50%; transform: translate(-50%, -50%); height: fit-content; width: fit-content">
                    <img use:AutoRevokeUrl class="icon" style="width: 24px; height: 24px;" src={IconsManager.getIconObjectUrl("edit")} alt={lang("Edit data")}>
                </div>
                    </button>
                    <div class="maxWidth" style="text-align: left;">
                        <button
                            class="emptyButton"
                            style="text-align: left; overflow-wrap: anywhere;"
                            onclick={async () => { // Let's play the new track
                                if (SelectHelper.isSelectModeEnabled) return;
                                let albumArtToSend: Blob | string | undefined = albumArt ? outputAlbumArtSrc : undefined;
                                if (contentType !== "album") {
                                    if (playlistContainer) { // We need to manually fetch the album art since otherwise we would set the playlist thumbnail as the album art for the popup player
                                        albumArtToSend = await GetAlbumArt({
                                            db: databases.albumArtDb,
                                            id: GetAlbumArtId({
                                                albumAuthor: song.metadata.albumArtist,
                                                year: song.metadata.year,
                                                albumName: song.metadata.album
                                            })
                                        });
                                    } else {
                                        const req = await fetch(outputAlbumArtSrc);
                                        albumArtToSend = await req.blob();
                                    }
                                }
                                const file = await GetAudioFile({
                                    songDb: databases.songDb,
                                    songId: song.trackId,
                                    metadataDb: databases.metadataDb
                                });
                                AudioManager.playAudio({
                                    file,
                                    metadata: song,
                                    albumArt: albumArtToSend
                                });
                                // Same logic seen in the "Track" component: we'll move the elements after the played song first in the queue
                                const newSongs = [...songs];
                                newSongs.unshift(...newSongs.splice(i));
                                AudioManager.audioContext.queue = newSongs.map(i => {return {...i, queueId: crypto.randomUUID()}});
                                AudioManager.audioContext.originalQueue = [...AudioManager.audioContext.queue];
                                AudioManager.audioContext.queuePosition = 0;
                                AudioManager.audioContext.repeat = "none";
                                AudioManager.audioContext.shuffle = false;
                                AudioManager.audioContext.playlistId = playlistId ?? null;
                                AudioManager.audioContext.playlistStartPosition = i;
                                AudioManager.audioContext.queueIdStart = AudioManager.audioContext.queue[0].queueId;
                            }}
                        >
                            <span>{song.metadata.title}</span>
                            <div style="height: 5px"></div>
                            <span
                                class="secondaryMetadata"
                                style="overflow-wrap: anywhere;"
                                >{contentType === "artist" ? song.metadata.album : (contentType === "albumArtist" || contentType === "playlist") ? `${song.metadata.album} – ${song.metadata.artist}` : song.metadata.artist}</span
                            >
                        </button>
                    </div>
                    <div>
                        <SongMoreOptions selectCallback={() => {
                            const id = (song as MetadataSourcePlaylist).playlistId ?? song.trackId;
                            SelectHelper.selectedItems.add(id);
                            const domElement = SelectableMusic.list.get(id);
                            if (domElement) (domElement as HTMLElement).style.backgroundColor = "var(--cardtransparent)";
                            selectCallback();
                        }} {playlistId} playlistItems={playlistContainer} {songs} position={i} {databases} editMetadataCallback={() => (showMetadataEditor = i)} showStatsCallback={async () => {
                            const req = await IndexedDatabase.get({
                                db: databases.songStatsDb,
                                query: song.trackId,
                                request: "songStats"
                            });
                            if (req?.data) {
                                songStats = req.data as songsStatsDB;
                                showStatsDialog = i;
                            }
                        }}></SongMoreOptions>
                    </div>
                    <div class="flex hcenter">
                        <span
                            >{ConvertSecondsInTimestamp(
                                song.metadata.duration,
                            )}</span
                        >
                    </div>
                </div>
            {/each}
            <div use:registerEmptySpace></div>
            {/if}
        </div>
    </div>
</div>

<style>
    .hoverBtn {
        position: relative;
    }
    .hoverBtn .hoveredBtn {
        opacity: 0;
    }
    .hoverBtn:hover .hoveredBtn {
        border: 1px solid var;
        opacity: 1;
    }
    .hoveredBtn {
        bottom: 15px;
        position: absolute;
        right: 15px;
        backdrop-filter: blur(16px) brightness(40%);
        pointer-events: none;
    }

</style>
