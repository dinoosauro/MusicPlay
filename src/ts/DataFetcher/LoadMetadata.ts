import type { albumArtDB, DatabaseContainer, metadataDB } from "../Database/DatabaseInterfaces";
import GetAlbumArtId from "./GetAlbumArtId";
import type { MetadataSource, PossibleSortingOptions } from "../Player/PlayerInterfaces";
import SortAlbumTracks from "../Database/SortAlbumTracks";
import GetGroupingRegex from "./GetGroupingRegex";

/**
 * Load the metadata of all the tracks
 * @param param0 an object that contains the metadata database
 * @param divideBy the criteria used to divide each song in a category (ex: per album, per artist etc.)
 * @returns A list of [the ID of the album/artist etc, the list of metadata of the songs tied to that ID]. 
 */
export default function LoadMetadata({ metadataDb }: {metadataDb: IDBDatabase}, divideBy: PossibleSortingOptions) {
    return new Promise<([string, MetadataSource[]])[]>(async (callback, reject) => {
        const output: MetadataSource[] = [];
        const req = metadataDb.transaction("musicMetadata").objectStore("musicMetadata").openCursor();
        req.onsuccess = async () => {
            if (req?.result) {
                const metadata = req.result.value.data as metadataDB;
                output.push({
                    trackId: req.result.primaryKey.toString(),
                    metadata,
                });
                req.result.continue();
            } else { // Fetched all the metadata from the database. Now let's divide them by the `divideBy` property
                switch (divideBy) {
                    case "album": {
                        let item: {[key: string]: MetadataSource[]} = {};
                        for (const entry of output) {
                            const albumId = GetAlbumArtId({
                                albumAuthor: entry.metadata.albumArtist,
                                year: entry.metadata.year,
                                albumName: entry.metadata.album,
                            });
                            if (!item[albumId]) item[albumId] = [];
                            item[albumId].push(entry);
                        }
                        for (const entry in item) {
                            item[entry].sort((a, b) => SortAlbumTracks(a, b));
                        }
                        callback(Object.entries(item).sort((a, b) => (a[1][0].metadata.albumSort ?? a[1][0].metadata.album).localeCompare(b[1][0].metadata.albumSort ?? b[1][0].metadata.album)));
                        break;
                    }
                    case "authors":
                    case "albumauthors": {
                        let item: {[key: string]: MetadataSource[]} = {};
                        const key = divideBy === "authors" ? "artist" : "albumArtist" as "artist" | "albumArtist";
                        const regex = GetGroupingRegex(divideBy === "albumauthors");
                        for (const entry of output) {
                            const splittedItems = entry.metadata[key].split(regex); // Divide multiple artists using their separator
                            for (let key of splittedItems) {
                                key = key.trim();
                                if (!item[key]) item[key] = [];
                                item[key].push(entry);
                            }
                        }
                        callback(Object.entries(item).sort((a, b) => a[0].localeCompare(b[0])));
                        break;
                    }
                    default: { // Alphabetical sorting for the "Tracks" view
                        callback(Object.entries(output.sort((a, b) => a.metadata.title.localeCompare(b.metadata.title)).map(i => [i])));
                        break;
                    }
                }
            }
        }
        req.onerror = (ex) => reject(ex);
    })
}
