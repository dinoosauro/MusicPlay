import AudioManager from "../Player/AudioManager";
import type { MetadataSourceQueue, PlaylistContainer } from "../Player/PlayerInterfaces";
import IndexedDatabase from "./IndexedDatabase";

interface Props {
    /**
     * Current position of the element that should be moved in the playlist
     */
    sourcePosition: number,
    /**
     * Where the element should be moved in the playlist
     */
    destinationPosition: number,
    /**
     * The current playlist object
     */
    playlist: PlaylistContainer,
    /**
     * The database where the playlist will be saved
     */
    playlistDb: IDBDatabase
}

/**
 * Move an item in a playlist
 */
export default async function MovePlaylistItem({ sourcePosition, destinationPosition, playlist, playlistDb }: Props) {
    if (playlist.id === AudioManager.audioContext.playlistId) { // Since the user is listening to the playlist we're moving the songs to, we need to generate again the queue with the moved items.
        // We need to consider that the user might have added multiple times the same song in a playlist. Therefore, the easiest approach is to make again the entire queue object.
        // Let's get the original order of the playlist. We'll use `originalQueue` since that's the array that the user cannot edit by moving the songs in the Queue view
        const queueData = [...AudioManager.audioContext.originalQueue];
        queueData.unshift(...AudioManager.audioContext.originalQueue.splice(AudioManager.audioContext.playlistStartPosition * -1));
        /**
         * An object that ties the track ID (`str`) with the queue ID used in the queue array (`id`).
         */
        const currentItem = playlist.data.contents.map((a, i) => { 
            return {str: a, id: queueData[i].queueId}
        });
        currentItem.splice(destinationPosition, 0, ...currentItem.splice(sourcePosition, 1)); // Move the track 
        const startId = currentItem.findIndex(i => i.id === AudioManager.audioContext.queueIdStart); // Let's find the position of the first track in the `originalQueue` object.
        currentItem.unshift(...currentItem.splice(startId)); 
        // Now we can build again the array, by matching the queueId
        const outputData: MetadataSourceQueue[] = [];
        for (const {id} of currentItem) {
            const data = queueData.find(i => id === i.queueId);
            data && outputData.push(data);
        }
        AudioManager.audioContext.queue = outputData;
        AudioManager.audioContext.originalQueue = [...AudioManager.audioContext.queue];
        AudioManager.audioContext.playlistStartPosition = startId;
    }
    // Let's now move the ID in the playlist data array, and save the edit in the IDBStorage.
    playlist.data.contents.splice(destinationPosition, 0, ...playlist.data.contents.splice(sourcePosition, 1));
    await IndexedDatabase.set({
        db: playlistDb,
        request: "playlist",
        object: JSON.parse(JSON.stringify(playlist))
    });

}