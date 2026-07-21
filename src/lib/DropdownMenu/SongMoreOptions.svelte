<script lang="ts">
    import type { PopupScalingInfo } from "../../ts/Animations/AnimationTypes";
    import AudioManager from "../../ts/Player/AudioManager";
    import type { albumArtDB, DatabaseContainer, metadataDB } from "../../ts/Database/DatabaseInterfaces";
    import DeleteFiles from "../../ts/Database/DeleteFiles";
    import IndexedDatabase from "../../ts/Database/IndexedDatabase";
    import type { MetadataSource, MetadataSourcePlaylist, PlaylistContainer } from "../../ts/Player/PlayerInterfaces";
    import DropdownButtonShow from "./DropdownButtonShow.svelte";
    import ViewerItemDropdownOptions from "./ViewerItemDropdownOptions.svelte";
    import { lang } from "../../ts/SvelteComponentsHelpers/Language";
    import GetAudioFile from "../../ts/DataFetcher/GetAudioFile";
    import UpdateMetadataOnOutputFile from "../../ts/Database/UpdateMetadataOnOutputFile";
    import GetAlbumArtId from "../../ts/DataFetcher/GetAlbumArtId";
    import MovePlaylistItem from "../../ts/Database/MovePlaylistItem";
    import DownloadWithMetadata from "../../ts/Database/DownloadWithMetadata";
    let {songs, position, editMetadataCallback, databases, playlistItems, playlistId, showStatsCallback, selectCallback, enableDeleteModeCallback, showConvertDialogCallback}: {songs: (MetadataSource | MetadataSourcePlaylist)[], position: number, editMetadataCallback: () => void, databases: DatabaseContainer, playlistItems?: PlaylistContainer[], playlistId?: string, showStatsCallback: () => void, selectCallback: () => void, enableDeleteModeCallback?: () => void, showConvertDialogCallback: () => void} = $props();

    /**
     * Convert the milliseconds to either the LRC or TTML timestamp
     * @param ms the milliseconds to convert
     * @param ttmlMode if the output timestamp should be TTML ready
     */
    function convertMsToTimestamp(ms: number, ttmlMode?: boolean) {
        let minutes = Math.floor(ms / 1000 / 60);
        ms -= (minutes * 1000 * 60);
        let seconds = Math.floor(ms / 1000);
        ms -= (seconds * 1000);
        let cents = ttmlMode ? ms : Math.floor(ms / 10);
        return `${ttmlMode && minutes === 0 ? "" : minutes < 10 && !ttmlMode ? `0${minutes}:` : `${minutes}:`}${seconds < 10 && (!ttmlMode || minutes > 0) ? `0${seconds}` : seconds}.${(cents < 10 || (cents < 100 && ttmlMode)) ? `0${ttmlMode && cents < 10 ? "0" : ""}${cents}` : cents}`;
    }
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
            metadataInfo={songs[position]}
            hasSyncedLyrics={songs[position].metadata.syncedLyrics.length !== 0}
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
                    case "selectSong":
                        selectCallback();
                        break;
                    case "deleteTrack": { // Delete track from the browser's storage
                        if (!confirm(lang("Do you want to delete this track from the application? The file on your device won't be deleted."))) return;
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
                    case "convertSong":
                        showConvertDialogCallback();
                        break;
                    case "removeFromPlaylist": { // Remove the selected track from the playlist. Unlike the "Add item to playlist", we also need to update the database here.
                        const trackToDelete = songs[position];
                        const currentPlaylist = playlistItems?.findIndex(i => i.id === playlistId);
                        if (typeof currentPlaylist !== "undefined" && currentPlaylist !== -1 && playlistItems) {
                            const index = playlistItems[currentPlaylist].data.contents.indexOf(trackToDelete.trackId);
                            if (index !== -1) playlistItems[currentPlaylist].data.contents.splice(playlistItems[currentPlaylist].data.reversed ? playlistItems[currentPlaylist].data.contents.length - index - 1 : index, 1);
                            await IndexedDatabase.set({
                                db: databases.playlistDb,
                                request: "playlist",
                                object: JSON.parse(JSON.stringify(playlistItems[currentPlaylist]))
                            })
                        }
                        songs.splice(position, 1);
                        typeof enableDeleteModeCallback !== "undefined" && confirm(lang("Do you want to enable delete mode? All the items you'll click in this playlist will be removed from the playlist. You'll find a pop-up at the bottom of the webpage to exit from this mode.")) && enableDeleteModeCallback();
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
                            songs.splice(item === "playlistMoveUp" ? position - 1 : position + 1, 0, ...songs.splice(position, 1));
                            await MovePlaylistItem({
                                sourcePosition: position,
                                destinationPosition: item === "playlistMoveUp" ? position - 1 : position + 1,
                                playlist: playlistItems[currentPlaylist],
                                playlistDb: databases.playlistDb
                            })
                        }
                        break;
                    }
                    case "downloadSong": {
                        if (confirm(`${lang("Do you want to merge all the edited metadata with the output file? This will")}${localStorage.getItem("MusicPlayer-CachedWebAssembly") === "a" ? "" : lang("require downloading some libraries (~ 16MB) and will")} ${lang("use more memory. If you don't want to do so, click \"No\" and the original file you've uploaded will be downloaded")}.`)) {
                            await DownloadWithMetadata({databases, songs: [songs[position]]})
                            return;
                        }
                        const audio = await GetAudioFile({songDb: databases.songDb, songId: songs[position].trackId, metadataDb: databases.metadataDb});
                        // Standard download: download the file
                        const a = Object.assign(document.createElement("a"), {
                            href: URL.createObjectURL(audio),
                            target: "_blank",
                            download: audio.name
                        });
                        a.click();
                        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
                        break;
                    }
                    case "downloadLyricsLrc": { 
                        let str = ""; // Let's convert the syncedLyrics object to a LRC file
                        for (const line of songs[position].metadata.syncedLyrics) {
                            str += `\n[${convertMsToTimestamp(line.start)}] `;
                            if (line.words.length > 0) str += line.words.map(word => `<${convertMsToTimestamp(word.start)}>${word.text}`).join(" "); else str += line.text;
                        }
                        // And download the file
                        const outputName = songs[position].metadata.name.substring(songs[position].metadata.name.lastIndexOf("/") + 1);
                        const a = Object.assign(document.createElement("a"), {
                            href: URL.createObjectURL(new Blob([str.substring(1)])),
                            target: "_blank",
                            download: `${outputName.substring(0, outputName.lastIndexOf("."))}.lrc`
                        });
                        a.click();
                        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
                        break;
                    }
                    case "downloadLyricsTtml": {
                        // TTML syntax is more complex. Apple provides a great reference of the TTML specification: https://help.apple.com/itc/videoaudioassetguide/#/itcd7579a252
                        const lyricsObj = songs[position].metadata.syncedLyrics;
                        const tt = document.createElementNS("http://www.w3.org/ns/ttml", "tt");
                        for (const [key, val] of [["xmlns", "http://www.w3.org/ns/ttml"], ["xmlns:ttm", "http://www.w3.org/ns/ttml#metadata"], ["xml:lang", "en"], ["xmlns:itunes", "http://itunes.apple.com/lyric-ttml-extensions"]])  tt.setAttribute(key, val);
                        const head = document.createElementNS("http://www.w3.org/ns/ttml", "head");
                        // We need to add all the singers to the metadata object
                        const metadata = document.createElementNS("http://www.w3.org/ns/ttml", "metadata");
                        for (const author of new Set(songs[position].metadata.syncedLyrics.map(i => i.artistNumber))) {
                            if (typeof author === "undefined") continue;
                            const ttmAgent = document.createElementNS("http://www.w3.org/ns/ttml", "ttm:agent");
                            ttmAgent.setAttribute("type", "person");
                            ttmAgent.setAttribute("xml:id", `v${author + 1}`);
                            metadata.append(ttmAgent);
                        }
                        head.append(metadata);
                        tt.append(head);
                        const body = document.createElementNS("http://www.w3.org/ns/ttml", "body");
                        body.setAttribute("dur", convertMsToTimestamp(Math.floor(songs[position].metadata.duration * 1000), true));
                        tt.append(body);
                        // Let's create the div that'll contain all the lyrics
                        const div = document.createElementNS("http://www.w3.org/ns/ttml", "div");
                        div.setAttribute("begin", convertMsToTimestamp(lyricsObj[0].start, true));
                        div.setAttribute("end", convertMsToTimestamp(lyricsObj[lyricsObj.length - 1].end ?? Math.floor(songs[position].metadata.duration * 1000), true));
                        body.append(div);
                        for (let i = 0; i < lyricsObj.length; i++) {
                            const p = document.createElementNS("http://www.w3.org/ns/ttml", "p");
                            if (lyricsObj[i].words.length !== 0) { // Word-by-word lyrics. We need to create a span for each word.
                                for (let j = 0; j < lyricsObj[i].words.length; j++) {
                                    const span = document.createElementNS("http://www.w3.org/ns/ttml", "span");
                                    span.setAttribute("begin", convertMsToTimestamp(lyricsObj[i].words[j].start, true));
                                    span.setAttribute("end", convertMsToTimestamp(lyricsObj[i].words[j].end ?? (j !== lyricsObj[i].words.length - 1 ? lyricsObj[i].words[j + 1].start : i !== lyricsObj.length - 1 ? lyricsObj[i + 1].start : Math.floor(songs[position].metadata.duration * 1000)), true));
                                    span.textContent = lyricsObj[i].words[j].text;
                                    p.append(span);
                                    if (j !== lyricsObj[i].words.length - 1) { // This is not part of the specification. It's just a lame way to add a space between the two spans in the output TTML file (since this node will be replaced)
                                        const tempSpace = document.createElementNS("http://www.w3.org/ns/ttml", "AddSpaceHere");
                                        p.append(tempSpace);
                                    }
                                }
                            } else p.textContent = lyricsObj[i].text;
                            p.setAttribute("begin", convertMsToTimestamp(lyricsObj[i].start, true));
                            p.setAttribute("end", convertMsToTimestamp(lyricsObj[i].end ?? (i !== lyricsObj.length - 1 ? lyricsObj[i + 1].start : Math.floor(songs[position].metadata.duration * 1000)), true));
                            if (typeof lyricsObj[i].artistNumber !== "undefined") p.setAttribute("ttm:agent", `v${(lyricsObj[i].artistNumber as number) + 1}`);
                            div.append(p);
                        }
                        // And now le'ts download the file
                        const outputName = songs[position].metadata.name.substring(songs[position].metadata.name.lastIndexOf("/") + 1);
                        const a = Object.assign(document.createElement("a"), {
                            href: URL.createObjectURL(new Blob([tt.outerHTML.replaceAll("<AddSpaceHere></AddSpaceHere>", " ")])),
                            target: "_blank",
                            download: `${outputName.substring(0, outputName.lastIndexOf("."))}.ttml`
                        });
                        a.click();
                        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
                        break;
                    }
                }
            }}
        ></ViewerItemDropdownOptions>
    {/snippet}
</DropdownButtonShow>

