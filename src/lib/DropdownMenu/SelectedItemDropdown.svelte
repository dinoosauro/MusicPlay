<script lang="ts">
    import { onMount } from "svelte";
    import type { PopupScalingInfo } from "../../ts/Animations/AnimationTypes";
    import DropdownAnimation from "../../ts/Animations/DropdownAnimation";
    import DropdownMenuOpen from "./DropdownMenuOpen.svelte";
    import { lang } from "../../ts/SvelteComponentsHelpers/Language";
    import type {
        MetadataSource,
        PlaylistContainer,
    } from "../../ts/Player/PlayerInterfaces";
    import type { DatabaseContainer } from "../../ts/Database/DatabaseInterfaces";
    import DeleteFiles from "../../ts/Database/DeleteFiles";
    import SelectHelper from "../../ts/SvelteComponentsHelpers/SelectHelper";
    import AudioManager from "../../ts/Player/AudioManager";
    import GetAllPlaylists from "../../ts/DataFetcher/GetAllPlaylists";
    import IndexedDatabase from "../../ts/Database/IndexedDatabase";
    import CreateNewPlaylist from "../../ts/Database/CreateNewPlaylist";
    import { addToPlaylist } from "../../ts/Database/AddToPlaylist";
    import DownloadWithMetadata from "../../ts/Database/DownloadWithMetadata";
    import GetAudioFile from "../../ts/DataFetcher/GetAudioFile";
    const {
        animationInfo,
        loadedMetadata,
        databases,
        selectCallback,
        playlistPassed,
        pageShown,
    }: {
        /**
         * Information used to open/close the pop-up with an animation
         */
        animationInfo: PopupScalingInfo;
        /**
         * List of the metadata of all the songs loaded by the application, divided by a certain criteria (ex: album, etc.) that is specified in the string
         */
        loadedMetadata?: [string, MetadataSource[]][];
        /**
         * All the databases used by the application
         */
        databases?: DatabaseContainer;
        /**
         * Function to call if the user selects a song
         */
        selectCallback: () => void;
        /**
         * The list of all the playlist saved by the user. This needs to be passed only if the user is in the Playlist mode
         */
        playlistPassed: PlaylistContainer[] | undefined;
        /**
         * The page that is being shown (album view, playlist view etc.)
         */
        pageShown: string,
    } = $props();
    /**
     * All the playlists that have been loaded
     */
    let playlist = $state(playlistPassed);
    onMount(async () => {
        DropdownAnimation.triggerAnimation(
            // Start expand animation
            container,
            false,
            animationInfo.scaling,
        );
        if (!playlist && databases)
            GetAllPlaylists(databases.playlistDb).then(
                (item) => (playlist = item),
            );
    });
    let container: HTMLElement;
</script>

<div
    class="miniDialog"
    bind:this={container}
    style={`margin: 5px; overflow: auto; padding: 10px 5px; ${animationInfo.limits}`}
>
    <DropdownMenuOpen
        options={[
            {
                categoryInfo: {
                    text: lang("Add to queue"),
                    id: "addQueue",
                    icon: "list",
                },
                categoryItems: [],
            },
            {
                categoryInfo: {
                    text: lang("Add to playlist"),
                    id: "addPlaylist",
                    icon: "add",
                },
                categoryItems: [
                    {
                        text: lang("Create new playlist"),
                        id: "createNewPlaylist",
                        icon: "add",
                    },
                    ...(playlist ?? []).map((i) => {
                        return {
                            text: i.data.name,
                            id: `AddToPlaylist-${i.id}`,
                        };
                    }),
                ],
            },
            {
                categoryInfo: {
                    text: lang("Delete track"),
                    id: "delete",
                    icon: "delete",
                },
                categoryItems: [],
            },
            {
                categoryInfo: {
                    text: lang("Download tracks"),
                    id: "download",
                    icon: "save"
                },
                categoryItems: []
            }
        ]}
        callback={async (id) => {
            switch (id) {
                case "delete": {
                    if (!confirm(lang("Do you want to delete the selected items from the application? The files on your device won't be deleted."))) return;
                    const itemsToDelete: MetadataSource[] = [];
                    if (!loadedMetadata || !databases) return;
                    // First, we need to remove all these entries from the loadedMetadata array
                    for (let j = 0; j < loadedMetadata.length; j++) {
                        const metadataSource = loadedMetadata[j][1];
                        for (let i = 0; i < metadataSource.length; i++) {
                            if (SelectHelper.selectedItems.has(metadataSource[i].trackId)) {
                                itemsToDelete.push(...metadataSource.splice(i, 1));
                                i--;
                                if (metadataSource.length === 0) {
                                    loadedMetadata.splice(j, 1);
                                    j--;
                                }
                            }
                        }
                    }
                    await DeleteFiles({
                        database: databases,
                        files: itemsToDelete,
                        alreadyAddedMetadata: pageShown === "albumView" ? loadedMetadata : undefined,
                    });
                    SelectHelper.selectedItems.clear();
                    selectCallback();
                    break;
                }
                case "addQueue": {
                    /**
                     * An array with all the metadata information of all the songs that have been loaded
                     */
                    const metadataList = loadedMetadata?.map((i) => i[1]).flat();
                    for (const id of SelectHelper.selectedItems) {
                        // Find the metadata of the selected item and add it to the certainNextQueue
                        const metadataItem = metadataList?.find((i) => i.trackId === id);
                        metadataItem &&
                            AudioManager.audioContext.certainNextQueue.push({
                                ...metadataItem,
                                queueId: crypto.randomUUID(),
                            });
                    }
                    break;
                }
                case "createNewPlaylist": { // Create a new playlist
                    const newPlaylistName = prompt(lang("Pick a name for the new playlist."));
                    if (newPlaylistName === null) return;
                    /**
                     * A placeholder for the playlist object to store in the database
                     */
                    let playlist: PlaylistContainer = {
                        data: {
                        name: newPlaylistName,
                        contents: [] as string[]
                        },
                        id: crypto.randomUUID()
                     };
                    if (playlistPassed) { // We need to add the playlist to the array, so that it'll appear in the Playlists section too
                        const id = CreateNewPlaylist(playlistPassed, newPlaylistName);
                        const possbilePlaylist = playlistPassed.find(i => i.id === id);
                        if (possbilePlaylist) playlist = possbilePlaylist;
                    }
                    playlist.data.contents.push(...SelectHelper.selectedItems); 
                    await IndexedDatabase.set({
                        db: databases?.playlistDb as IDBDatabase,
                        request: "playlist",
                        object: JSON.parse(JSON.stringify(playlist)),
                    });
                    break;
                }
                case "download": {
                    if (!databases) return;
                    const outputObj: MetadataSource[] = [];
                    /**
                     * An array with all the metadata information of all the songs that have been loaded
                     */
                    const metadataList = loadedMetadata?.map((i) => i[1]).flat();
                    for (const id of SelectHelper.selectedItems) { // Let's get all the MetadataSource of the selected files
                        const metadataItem = metadataList?.find((i) => i.trackId === id);
                        metadataItem && outputObj.push(metadataItem);
                    }
                    if (confirm(`${lang("Do you want to merge all the edited metadata with the output file? This will")}${localStorage.getItem("MusicPlayer-CachedWebAssembly") === "a" ? "" : lang("require downloading some libraries (~ 16MB) and will")} ${lang("use more memory. If you don't want to do so, click \"No\" and the original file you've uploaded will be downloaded")}.`)) { // Use TagLib-Sharp in Blazor WebAssembly to update all the metadata
                        await DownloadWithMetadata({databases: databases as DatabaseContainer, songs: outputObj});
                        return;
                    }
                    // Download the original files. Since they're multiple files, let's create a zip file.
                    const zipjs = await import("@zip.js/zip.js");
                    const writer = new zipjs.ZipWriter(new zipjs.BlobWriter());
                    /**
                     * Array with all the names of the files added in the zip file
                     */
                    const outputNames: string[] = [];
                    for (const output of outputObj) {
                        const audio = await GetAudioFile({songDb: databases.songDb, songId: output.trackId, metadataDb: databases.metadataDb});
                        let [fileName, fileExtension] = [output.metadata.name.substring(0, output.metadata.name.lastIndexOf(".")), output.metadata.name.substring(output.metadata.name.lastIndexOf("."))];
                        let index = 1;
                        while(outputNames.indexOf(fileName + fileExtension) !== -1) { // Avoid adding files with the same name
                            fileName = `${output.metadata.name.substring(0, output.metadata.name.lastIndexOf("."))}-${index}`;
                            index++;
                        }
                        await writer.add(fileName + fileExtension, new zipjs.BlobReader(audio));
                    }
                    const a = Object.assign(document.createElement("a"), {
                        href: URL.createObjectURL(await writer.close()),
                        target: "_blank",
                        download: "SelectedFiles.zip"
                    });
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
                }
            }
            if (id.startsWith("AddToPlaylist")) { // Songs to add in the playlist. If this option is enabled, the application has loaded the playlists.
                const playlistId = id.substring(id.indexOf("-") + 1);
                const playlistItem = (playlist ?? []).find((i) => i.id === playlistId);
                if (!playlistItem || !loadedMetadata) return;
                const trackToAdd = loadedMetadata?.map(i => i[1]).flat().filter(i => SelectHelper.selectedItems.has(i.trackId));
                addToPlaylist({
                    playlistId,
                    playlistDb: databases?.playlistDb as IDBDatabase,
                    playlistItems: playlist ?? [],
                    trackToAdd
                })
                selectCallback();
            }
            await DropdownAnimation.triggerAnimation(
                container,
                true,
                animationInfo.scaling,
            );
            animationInfo.closeCallback();
        }}
    ></DropdownMenuOpen>
</div>
