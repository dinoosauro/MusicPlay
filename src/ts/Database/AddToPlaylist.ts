import AudioManager from "../Player/AudioManager";
import type { MetadataSource, PlaylistContainer } from "../Player/PlayerInterfaces";
import { lang } from "../SvelteComponentsHelpers/Language";
import IndexedDatabase from "./IndexedDatabase";

interface Props {
    /**
     * ID of the playlist where the tracks will be added
     */
    playlistId: string,
    /**
     * All the playlists that have been created by the user
     */
    playlistItems: PlaylistContainer[],
    /**
     * An array of all the tracks to add in the playlist, or the single track to add.
     */
    trackToAdd: MetadataSource | MetadataSource[],
    /**
     * Database where the playlists are stored
     */
    playlistDb: IDBDatabase
}
/**
 * Add the current track to the playlist *database*. 
 * This function does not update the `playlistSrc` object, and therefore that's done in the `SongMoreOptions.svelte` file.
 * @param playlistId the ID of the playlist where the new song should be added
 * @returns true if the song has been added to the playlist in the database, false otherwise.
 */
export async function addToPlaylist({ playlistId, playlistItems, trackToAdd, playlistDb }: Props) {
    const playlist = playlistItems.find((i) => i.id === playlistId);
    if (playlist) {
        if (!Array.isArray(trackToAdd)) {
            if (playlist.data.contents.indexOf(trackToAdd.trackId) !== -1 && !confirm(lang("This song has already been added to the playlist. Do you want to add it again?"))) return false;
            trackToAdd = [trackToAdd];
        } else {
            if (trackToAdd.some(i => playlist.data.contents.indexOf(i.trackId) !== -1) && !confirm(lang("Some of the songs have already been added to the playlist. Do you want to add them again? If you cancel this operation, only the new songs will be added to the playlist."))) {
                for (let i = 0; i < trackToAdd.length; i++) {
                    if (playlist.data.contents.indexOf(trackToAdd[i].trackId) !== -1) { // The playlist already contains a song with the same id, let's remove this entry.
                        trackToAdd.splice(i, 1);
                        i--;
                    }
                }
            }
        }
        playlist.data.contents.push(...trackToAdd.map(i => i.trackId));
        await IndexedDatabase.set({
            db: playlistDb,
            request: "playlist",
            object: JSON.parse(JSON.stringify(playlist)),
        });
        if (playlistId === AudioManager.audioContext.playlistId) { // The user is playing a song from this playlist. We need to add the new items.
            const position = AudioManager.audioContext.queue.length - AudioManager.audioContext.playlistStartPosition;
            const obj = trackToAdd.map(i => {return {...i, queueId: crypto.randomUUID()}});
            AudioManager.audioContext.queue.splice(position, 0, ...obj);
            AudioManager.audioContext.originalQueue.splice(position, 0, ...obj);
            if (position < AudioManager.audioContext.queuePosition) AudioManager.audioContext.queuePosition += trackToAdd.length;
        }
        return true;
    }
    return false;
}
