import type { playlistDB } from "../Database/DatabaseInterfaces";
import type { PlaylistContainer } from "../Player/PlayerInterfaces";

/**
 * Get all the playlists saved by the user
 * @param database the Playlist database
 * @returns a list with all the playlists
 */
export default function GetAllPlaylists(database: IDBDatabase) {
    return new Promise<PlaylistContainer[]>(async (callback, reject) => {
        const output: PlaylistContainer[] = [];
        const req = database.transaction("playlist").objectStore("playlist").openCursor();
        req.onsuccess = async () => {
            if (req?.result) {
                const data = req.result.value.data as playlistDB;
                output.push({
                    id: req.result.primaryKey.toString(),
                    data
                });
                req.result.continue();
            } else {
                callback(output.sort((a, b) => { // We need to make the pinned items (in chronological order) first
                    const isPinned = (a.data.isPinned && b.data.isPinned ? (a.data.isPinned - b.data.isPinned) : b.data.isPinned ? 1 : 0);
                    if (isPinned !== 0) return isPinned;
                    return a.data.name.localeCompare(b.data.name);
                }));
            }
        }
        req.onerror = (ex) => reject(ex);
    });
}