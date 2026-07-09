import type { PlaylistContainer } from "../Player/PlayerInterfaces";

/**
 * Create a new playlist by adding it to the playlist array and saving it in the database
 * @param playlistItems all the playlists loaded by the application
 * @param playlistName the name of the new playlist
 * @returns the ID of the new playlist
 */
export default function CreateNewPlaylist(playlistItems: PlaylistContainer[], playlistName: string) {
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
    return newPlaylistId;
}