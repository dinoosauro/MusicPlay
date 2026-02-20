<script lang="ts">
    import { onMount } from "svelte";
    import DropdownAnimation from "../../ts/Animations/DropdownAnimation";
    import DropdownMenuOpen from "./DropdownMenuOpen.svelte";
    import GetAllPlaylists from "../../ts/DataFetcher/GetAllPlaylists";
    import type { PlaylistContainer } from "../../ts/Player/PlayerInterfaces";
    import Dialog from "../Dialog.svelte";
    import IndexedDatabase from "../../ts/Database/IndexedDatabase";
    import type { playlistDB } from "../../ts/Database/DatabaseInterfaces";
    import { lang } from "../../ts/SvelteComponentsHelpers/Language";
    import type { PopupScalingInfo } from "../../ts/Animations/AnimationTypes";

    const {
        animationInfo,
        callback,
        playlistDb,
        trackId,
        playlistSrc,
        showPlaylistUpButton,
        showPlaylistDownButton,
    }: {
        animationInfo: PopupScalingInfo;
        callback: (item: string) => void;
        playlistDb: IDBDatabase;
        trackId: string;
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
        showPlaylistDownButton?: boolean
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
    /**
     * Add the current track to the playlist *database*. 
     * This function does not update the `playlistSrc` object, and therefore that's done in the `SongMoreOptions.svelte` file.
     * @param playlistId the ID of the playlist where the new song should be added
     * @returns true if the song has been added to the playlist in the database, false otherwise.
     */
    async function addToPlaylist(playlistId: string) {
        const playlist = playlistItems.find((i) => i.id === playlistId);
        if (playlist) {
            if (playlist.data.contents.indexOf(trackId) === -1 || confirm(lang("This song has already been added to the playlist. Do you want to add it again?"))) {
                playlist.data.contents.push(trackId);
                await IndexedDatabase.set({
                    db: playlistDb,
                    request: "playlist",
                    object: JSON.parse(JSON.stringify(playlist)),
                });
                return true;
            }
        }
        return false;
    }
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
                    const newPlaylistId = crypto.randomUUID();
                    // Let's first add the new playlist in the object, by looking at the position
                    let index = 0;
                    const isListInReverse = playlistItems.length > 1 && playlistItems[0].data.name.localeCompare(playlistItems[1].data.name) === 1;
                    while (index < playlistItems.length) {
                        if (playlistItems[index].data.isPinned) { // The new playlist must always be after pinned items
                            index++;
                            continue;
                        }
                        if (playlistItems[index].data.name.localeCompare(playlistName) !== (isListInReverse ? 1 : -1)) break;
                        index++;
                    }
                    playlistItems.splice(index, 0, {
                        id: newPlaylistId,
                        data: {
                            name: playlistName,
                            contents: []
                        }
                    });
                    sendCallback = await addToPlaylist(newPlaylistId);
                    break;
                }
                case "AddToPlaylist": {
                    sendCallback = await addToPlaylist(item.substring(item.indexOf("-") + 1));
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

