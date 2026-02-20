<script lang="ts">
    import type { PopupScalingInfo } from "../../ts/Animations/AnimationTypes";
    import AudioManager from "../../ts/Player/AudioManager";
    import type { DatabaseContainer } from "../../ts/Database/DatabaseInterfaces";
    import DeleteFiles from "../../ts/Database/DeleteFiles";
    import IndexedDatabase from "../../ts/Database/IndexedDatabase";
    import type { MetadataSource, MetadataSourcePlaylist, PlaylistContainer } from "../../ts/Player/PlayerInterfaces";
    import DropdownButtonShow from "./DropdownButtonShow.svelte";
    import ViewerItemDropdownOptions from "./ViewerItemDropdownOptions.svelte";
    import { lang } from "../../ts/SvelteComponentsHelpers/Language";
    import GetAudioFile from "../../ts/DataFetcher/GetAudioFile";
    let {songs, position, editMetadataCallback, databases, playlistItems, playlistId, showStatsCallback}: {songs: (MetadataSource | MetadataSourcePlaylist)[], position: number, editMetadataCallback: () => void, databases: DatabaseContainer, playlistItems?: PlaylistContainer[], playlistId?: string, showStatsCallback: () => void} = $props();
</script>

<DropdownButtonShow
    placeholderIcon="morevertical"
    iconAlt={lang("Options about this specific track")}
>
    {#snippet children(animationInfo: PopupScalingInfo)}
        <ViewerItemDropdownOptions
            playlistSrc={playlistItems}
            playlistDb={databases.playlistDb}
            trackId={songs[position].trackId}
            showPlaylistUpButton={playlistItems && position !== 0}
            showPlaylistDownButton={playlistItems && songs.length !== (position + 1)}
            {animationInfo}
            callback={async (item) => {
                if (item.startsWith("AddToPlaylist-")) { // Add song to playlist. In the `ViewerItemDropdownOptions.svelte` file we already updated the database, and now we need to update also the current playlist object.
                    const id = item.substring(item.indexOf("-") + 1);
                    const playlist = playlistItems?.find(i => i.id === id);
                    if (playlist) {
                        if (playlist.data.orderType) { // We're in the Playlists view, so the user can only add items that are already in the playlist. Let's just look the position of the same trackId (that we already knnow), and append the new item here
                            songs.splice(position, 0, {
                                ...songs[position],
                                playlistId: crypto.randomUUID()
                            });
                        } else songs[playlist.data.reversed ? "unshift" : "push"]({
                            ...songs[position],
                            playlistId: crypto.randomUUID()
                        })
                    }
                }
                switch (item) {
                    case "addQueue": // Add item to the queue
                        AudioManager.audioContext.certainNextQueue.push({
                            ...songs[position],
                            queueId: crypto.randomUUID()
                        });
                        break;
                    case "editMetadata": // Show the edit metadata dialog
                        editMetadataCallback();
                        break;
                    case "deleteTrack": { // Delete track from the browser's storage
                        const trackToDelete = songs.splice(position, 1);
                        for (const item of (playlistItems ?? [])) {
                            const index = item.data.contents.indexOf(trackToDelete[0].trackId);
                            if (index !== -1) item.data.contents.splice(index, 1);
                        }
                        await DeleteFiles({
                            database: databases,
                            files: trackToDelete,
                        });
                        break;
                    }
                    case "removeFromPlaylist": { // Remove the selected track from the playlist. Unlike the "Add item to playlist", we also need to update the database here.
                        const trackToDelete = songs[position];
                        const currentPlaylist = playlistItems?.findIndex(i => i.id === playlistId);
                        if (typeof currentPlaylist !== "undefined" && currentPlaylist !== -1 && playlistItems) {
                            const index = playlistItems[currentPlaylist].data.contents.indexOf(trackToDelete.trackId);
                            if (index !== -1) playlistItems[currentPlaylist].data.contents.splice(index, 1);
                            await IndexedDatabase.set({
                                db: databases.playlistDb,
                                request: "playlist",
                                object: JSON.parse(JSON.stringify(playlistItems[currentPlaylist]))
                            })
                        }
                        songs.splice(position, 1);
                        break;
                    }
                    case "viewStats": // Show the stats dialog
                        showStatsCallback();
                        break;
                    case "playlistMoveUp":
                    case "playlistMoveDown": { // Let's move the entry above/below in the playlist
                        if (!playlistItems) return;
                        const currentPlaylist = playlistItems.findIndex(i => i.id === playlistId);
                        if (currentPlaylist !== -1) {
                            playlistItems[currentPlaylist].data.contents.splice(item === "playlistMoveUp" ? position - 1 : position + 1, 0, ...playlistItems[currentPlaylist].data.contents.splice(position, 1));
                            songs.splice(item === "playlistMoveUp" ? position - 1 : position + 1, 0, ...songs.splice(position, 1));
                            await IndexedDatabase.set({
                                db: databases.playlistDb,
                                request: "playlist",
                                object: JSON.parse(JSON.stringify(playlistItems[currentPlaylist]))
                            })
                        }
                        break;
                    }
                    case "downloadSong": {
                        const audio = await GetAudioFile({songDb: databases.songDb, songId: songs[position].trackId, metadataDb: databases.metadataDb});
                        const a = Object.assign(document.createElement("a"), {
                            href: URL.createObjectURL(audio),
                            target: "_blank",
                            download: audio.name
                        });
                        a.click();
                        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
                        break;
                    }

                }
            }}
        ></ViewerItemDropdownOptions>
    {/snippet}
</DropdownButtonShow>
