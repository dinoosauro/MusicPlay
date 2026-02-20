import type { DatabaseContainer } from "./DatabaseInterfaces";
import GetAlbumArtId from "../DataFetcher/GetAlbumArtId";
import IndexedDatabase from "./IndexedDatabase";
import LoadMetadata from "../DataFetcher/LoadMetadata";
import type { MetadataSource } from "../Player/PlayerInterfaces";

interface DeleteFileProps {
    /**
     * All the databases used by them applicatiion
     */
    database: DatabaseContainer,
    /**
     * Metadata of all the files that should be deleted
     */
    files: MetadataSource[],
    /**
     * **If sorted by album**, pass the `alreadyAddedMetadata` object to avoid fetching again all the metadata from the object.
     */
    alreadyAddedMetadata?: [string, MetadataSource[]][]
}

/**
 * Delete the passed files from the application storage
 */
export default async function DeleteFiles({ database, files, alreadyAddedMetadata }: DeleteFileProps) {
    /**
     * A list of all the albums that have been completely deleted
     */
    let checkAlbums = new Set<string>();
    /**
     * A list of all the authors that have been completely deleted
     */
    let checkAuthors = new Set<string>();
    for (const file of files) {
        await IndexedDatabase.remove({ db: database.metadataDb, query: file.trackId, request: "musicMetadata" });
        await IndexedDatabase.remove({ db: database.songDb, query: file.trackId, request: "contentData" });
        // We now add to the checkAlbums and the checkAutors Sets the property of this file, and later we'll remove it if there's at least another audio file with the same album/author
        checkAlbums.add(GetAlbumArtId({
            albumAuthor: file.metadata.albumArtist,
            year: file.metadata.year,
            albumName: file.metadata.album
        }));
        checkAuthors.add(file.metadata.albumArtist);
        checkAuthors.add(file.metadata.artist);
    }
    if (checkAlbums.size !== 0) { 
        const albumMetadata =  alreadyAddedMetadata ?? await LoadMetadata({ metadataDb: database.metadataDb }, "album");
        for (const [albumId, songs] of albumMetadata) { // Let's delete all the album and their authors from the Sets
            checkAlbums.delete(albumId);
            for (const song of songs) {
                checkAuthors.delete(song.metadata.albumArtist);
                checkAuthors.delete(song.metadata.artist);
            }
        }
    }
    for (const remainingElements of checkAlbums) {
        await IndexedDatabase.remove({ db: database.albumArtDb, request: "albumArt", query: remainingElements })
    }
    for (const remainingElements of checkAuthors) {
        await IndexedDatabase.remove({ db: database.artistImgDb, request: "artistImg", query: remainingElements })
    }

}