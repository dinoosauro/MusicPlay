<script lang="ts">
    import { onMount } from "svelte";
    import DropdownAnimation from "../../ts/Animations/DropdownAnimation";
    import DropdownMenuOpen from "./DropdownMenuOpen.svelte";
    import GetAllPlaylists from "../../ts/DataFetcher/GetAllPlaylists";
    import type { MetadataSource, PlaylistContainer } from "../../ts/Player/PlayerInterfaces";
    import Dialog from "../Dialog.svelte";
    import IndexedDatabase from "../../ts/Database/IndexedDatabase";
    import type { playlistDB } from "../../ts/Database/DatabaseInterfaces";
    import { lang } from "../../ts/SvelteComponentsHelpers/Language";
    import type { PopupScalingInfo } from "../../ts/Animations/AnimationTypes";
    import CreateNewPlaylist from "../../ts/Database/CreateNewPlaylist";
    import { addToPlaylist } from "../../ts/Database/AddToPlaylist";

    const {
        animationInfo,
        callback,
        playlistDb,
        trackId,
        playlistSrc,
        showPlaylistUpButton,
        showPlaylistDownButton,
        hasSyncedLyrics,
        metadataInfo
    }: {
        animationInfo: PopupScalingInfo;
        callback: (item: string) => void;
        playlistDb: IDBDatabase;
        trackId: string;
        hasSyncedLyrics: boolean
        /**
         * List of all the loaded playlists objects
         */
        playlistSrc?: PlaylistContainer[];
        /**
         * Show the button to move an entry above in a playlist
         */
        showPlaylistUpButton?: boolean,
        /**
         * Show the button to move an entry below in a playlist
         */
        showPlaylistDownButton?: boolean,
        /**
         * Metadata information about the currently-selected track.
         */
        metadataInfo: MetadataSource
    } = $props();
    /**
     * Main container of the song options dropdown
     */
    let container: HTMLElement;
    /**
     * A list of all the playlists the user has created.
     * If no playlists are passed, the application will fetch them immediately after the component has been mounted.
     */
    let playlistItems = $state<PlaylistContainer[]>(playlistSrc ?? []);
    onMount(async () => {
        DropdownAnimation.triggerAnimation( // Start expand animation
            container,
            false,
            animationInfo.scaling,
        );
        if (playlistItems.length === 0) {
            playlistItems = await GetAllPlaylists(playlistDb);
        }
    });

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
                    ...playlistItems.map((i) => {
                        return {
                            text: i.data.name,
                            id: `AddToPlaylist-${i.id}`,
                        };
                    }),
                ],
            },
            ...(playlistSrc ? [{
                categoryInfo: {
                    text: lang("Remove from playlist"),
                    id: "removeFromPlaylist",
                    icon: "dismiss" as "dismiss"
                },
                categoryItems: []
            }] : []),
            ...(showPlaylistUpButton ? [{
                categoryInfo: {
                    text: lang("Move up"),
                    id: "playlistMoveUp",
                    icon: "arrowtop" as "arrowtop"
                },
                categoryItems: []
            }] : []),
            ...(showPlaylistDownButton ? [{
                categoryInfo: {
                    text: lang("Move down"),
                    id: "playlistMoveDown",
                    icon: "arrowdown" as "arrowdown"
                },
                categoryItems: []
            }] : []),
            {
                categoryInfo: {
                    text: lang("Delete track"),
                    id: "deleteTrack",
                    icon: "delete",
                },
                categoryItems: [],
            },
            {
                categoryInfo: {
                    text: lang("Select song"),
                    id: "selectSong",
                    icon: "selectall"
                },
                categoryItems: []
            },
            {
                categoryInfo: {
                    text: lang("Edit metadata"),
                    id: "editMetadata",
                    icon: "edit",
                },
                categoryItems: [],
            },
            {
                categoryInfo: {
                    text: lang("Download song"),
                    id: "downloadSong",
                    icon: "save"
                },
                categoryItems: []
            },
            {
                categoryInfo: {
                    text: lang("Convert song"),
                    id: "convertSong",
                    icon: "arrowsync"
                },
                categoryItems: []
            },
            ...(hasSyncedLyrics ? [
                {
                    categoryInfo: {
                        text: lang("Export synced lyrics"),
                        id: "downloadLyrics",
                        icon: "mic" as "mic"
                    },
                    categoryItems: [{
                        text: lang("LRC file"),
                        id: "downloadLyricsLrc"
                    }, {
                        text: lang("TTML file"),
                        id: "downloadLyricsTtml"
                    }]
                }
            ] : []),
            {
                categoryInfo: {
                    text: lang("View stats"),
                    id: "viewStats",
                    icon: "databarvertical"
                },
                categoryItems: []
            }
        ]}
        callback={async (item) => {
            /**
             * If the callback should be sent to the main `SongMoreOptions.svelte` component. 
             * This is set to false usually if either the action can be done entirely in this component, or when the user aborted the request.
             */
            let sendCallback = true;
            switch (
                item.substring(
                    0,
                    item.indexOf("-") === -1 ? item.length : item.indexOf("-"),
                )
            ) {
                case "createNewPlaylist": {
                    const playlistName = prompt(lang("Pick a name for the new playlist."));
                    if (playlistName === null) return;
                    const newPlaylistId = CreateNewPlaylist(playlistItems, playlistName);
                    sendCallback = await addToPlaylist({
                        playlistId: newPlaylistId,
                        playlistDb,
                        playlistItems,
                        trackToAdd: metadataInfo
                    });
                    break;
                }
                case "AddToPlaylist": {
                    sendCallback = await addToPlaylist({
                        playlistId: item.substring(item.indexOf("-") + 1),
                        playlistDb,
                        playlistItems,
                        trackToAdd: metadataInfo
                    })
                    break;
                }
            }
            await DropdownAnimation.triggerAnimation(
                container,
                true,
                animationInfo.scaling,
            );
            animationInfo.closeCallback();
            callback(sendCallback ? item : "");
        }}
    ></DropdownMenuOpen>
</div>

