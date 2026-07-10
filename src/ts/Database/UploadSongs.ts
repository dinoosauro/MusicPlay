import type { IAudioMetadata, ILyricsTag, IPicture } from "music-metadata";
import IndexedDatabase from "./IndexedDatabase";
import GetAlbumArtId from "../DataFetcher/GetAlbumArtId";
import type { DatabaseContainer, folderHandleDB, metadataDB, syncedLyricsObj } from "./DatabaseInterfaces";
import ParseLrcFiles from "../DataFetcher/ParseLrcFiles";
import type { MetadataSource, PossibleSortingOptions } from "../Player/PlayerInterfaces";
import SortAlbumTracks from "./SortAlbumTracks";
import GetNewItemInMetadataListPosition from "../DataFetcher/AddItemToMetadataList";

interface FileExplorer {
    name: string,
    handle: FileSystemFileHandle;
}

declare global {
    interface Window {
        showOpenFilePicker: ({ id, multiple, startIn, types }: {
            id?: string,
            multiple?: boolean,
            startIn?: string,
            types?: {
                description: string,
                accept: any
            }[]
        }) => Promise<FileSystemFileHandle[]>,
        showDirectoryPicker: ({ id, mode, startIn }: {
            id?: string,
            mode?: "read" | "readwrite",
            startIn?: string
        }) => Promise<FileSystemDirectoryHandle>,
        musicPlayerVersion: string
    }
    interface FileSystemHandle {
        requestPermission: ({ mode }: { mode: "read" | "write" | "readwrite" }) => Promise<string>
        queryPermission: ({ mode }: { mode: "read" | "write" | "readwrite" }) => Promise<string>
    }
    interface FileSystemDirectoryHandle {
        values: () => FileSystemDirectoryHandleAsyncIterator<FileSystemHandle>
    }
}

/**
 * Properties to save the current element in the database
 */
interface SaveSongFileInDatabaseProps {
    file: File,
    fileName: string,
    fileHandle?: FileSystemFileHandle,
    lyricsFile?: File,
    directoryId?: string,
}

/**
 * Add the newly-uploaded items to an existing list
 */
interface MetadataAddProps {
    /**
     * The type used to sort the `data` object
     */
    type: PossibleSortingOptions,
    /**
     * The object with all the stored metadata
     */
    data: [string, MetadataSource[]][]
}

/**
 * Save the passed songs in the database, by also reading their metadata
 */
export async function SaveSongFileInDatabase({ songDb, metadataDb, albumArtDb }: DatabaseContainer, { file, fileName, fileHandle, lyricsFile, directoryId }: SaveSongFileInDatabaseProps, metadataToUpdate?: MetadataAddProps) {
    navigator.storage && navigator.storage.persist && navigator.storage.persist();
    const metadata = await import("music-metadata");
    const id = crypto.randomUUID();
    const readMetadata = await metadata.parseBlob(file);
    await saveSong({ id, db: songDb, file: fileHandle || file, directoryId, fileName });
    const savedMetadata = await updateMetadata({
        metadataDb,
        albumArtDb,
        id,
        metadata: readMetadata,
        lyrics: lyricsFile?.name.endsWith("lrc") ? ParseLrcFiles(await lyricsFile.text()) : await lyricsFile?.text(),
        fileName,
        directoryId
    });
    if (metadataToUpdate) AddMetadataToList({
        type: metadataToUpdate.type,
        metadataList: metadataToUpdate.data,
        metadataToAdd: savedMetadata
    })
    if (directoryId) localStorage.setItem("MusicPlayer-FSApiUsed", "1");
    localStorage.setItem("MusicPlayer-ItemsAdded", "1");
}

interface UploadSongsProps {
    /**
     * All the available databases
     */
    database: DatabaseContainer,
    /**
     * If a folder should be picked instead of multiple files
     */
    pickFolder?: boolean,
    /**
    * Add the newly-uploaded items to an existing list
    */
    metadataToUpdate?: MetadataAddProps
}

/**
 * Ask the user to pick some files, and save them as songs
 */
export async function UploadSongs({ database, pickFolder, metadataToUpdate }: UploadSongsProps) {
    function createInput() {
        const input = Object.assign(document.createElement("input"), {
            type: "file",
            multiple: true,
            webkitdirectory: pickFolder,
            directory: pickFolder,
            style: "z-index: 30; top: 50px; position: absolute;", // Fallback for iOS Safari, where the click event doesn't work
            onchange: async () => {
                input.remove();
                if (input.files) {
                    /**
                     * An object that has as a key the file name (without the extension), and as a value all the files with the same path.
                     * This is used so that we can find the .lrc/.ttml files tied to the audio file.
                     */
                    let fileList: { [key: string]: File[] } = {};
                    for (const file of input.files) {
                        const name = file.name.substring(0, file.name.lastIndexOf("."));
                        if (typeof fileList[name] === "undefined") fileList[name] = [];
                        fileList[name].push(file);
                    }
                    for (const fileName in fileList) {
                        for (const file of fileList[fileName]) {
                            if (file.type.startsWith("audio")) await SaveSongFileInDatabase(database, {
                                file: file,
                                fileName: file.webkitRelativePath || file.name,
                                lyricsFile: fileList[fileName].find(i => i.name.endsWith("lrc") || i.name.endsWith("txt") || i.name.endsWith("ttml") || i.name.endsWith("xml"))
                            }, metadataToUpdate);
                        }
                    }
                }
            }
        });
        document.body.append(input);
        input.click();
    }
    // We'll try using the File System API if possible
    if (typeof window.showOpenFilePicker !== "undefined") {
        /**
         * A list of all the fetched files
         */
        let filePicker: FileExplorer[] = [];
        let directoryId: string | undefined = undefined;
        try {
            if (pickFolder) {
                let folderPicker = await window.showDirectoryPicker({
                    id: "MusicPlayer-MusicPicker",
                    startIn: "music",
                    mode: "read"
                });
                filePicker = await ReadFilesInDir(folderPicker);
                directoryId = crypto.randomUUID();
                await IndexedDatabase.set({
                    db: database.directoryHandleDb,
                    request: "folderHandle",
                    object: {
                        id: directoryId,
                        data: {
                            handle: folderPicker
                        }
                    }
                })

            } else {
                filePicker = (await window.showOpenFilePicker({
                    id: "MusicPlayer-MusicPicker",
                    multiple: true,
                    startIn: "music",
                    types: [{
                        description: "Music files",
                        accept: {
                            "audio/*": [".mp3", ".aac", ".m4a", ".ogg", ".opus", ".wav", ".flac", ".alac", ".wma", ".mkv"],
                            "text/plain": [".lrc", ".ttml", ".txt"],
                            "application/xml": [".ttml"]
                        }
                    }]
                })).map(i => {
                    return {
                        name: i.name,
                        handle: i
                    }
                });
            }
        } catch (ex) {
            console.warn(ex);
            createInput();
            return;
        }
        // Same as in the "createInput" function
        let fileLoaded: { [key: string]: FileSystemFileHandle[] } = {};
        for (const file of filePicker) {
            const name = file.name.substring(0, file.name.lastIndexOf("."));
            if (!fileLoaded[name]) fileLoaded[name] = [];
            fileLoaded[name].push(file.handle);
            await file.handle.requestPermission({ mode: "read" }); // Important: always ask for permission
        }
        for (const item in fileLoaded) {
            const fileList: File[] = [];
            for (const file of fileLoaded[item]) fileList.push(await file.getFile());
            for (let i = 0; i < fileList.length; i++) {
                if (!fileList[i].type.startsWith("audio")) continue;
                await SaveSongFileInDatabase(database, {
                    file: fileList[i],
                    fileName: `${item}${fileList[i].name.substring(fileList[i].name.lastIndexOf("."))}`,
                    fileHandle: fileLoaded[item][i],
                    lyricsFile: await fileLoaded[item].find(i => i.name.endsWith("lrc") || i.name.endsWith("txt") || i.name.endsWith("ttml") || i.name.endsWith("xml"))?.getFile(),
                    directoryId
                }, metadataToUpdate)
            }
        }

    } else createInput();
}

/**
 * Get all the files in a directory
 * @param source the DirectoryHandle used to read the files in this directory
 * @param path the path that should be prepended before each file
 * @returns the files in the folder, and in the subfolders
 */
export async function ReadFilesInDir(source: FileSystemDirectoryHandle, path = "") {
    let output: FileExplorer[] = [];
    for await (const item of source.values()) {
        output.push(...(item.kind === "directory" ? await ReadFilesInDir(item as FileSystemDirectoryHandle, `${item.name}/`) : [{
            name: `${path}${item.name}`,
            handle: item as FileSystemFileHandle
        }]));
    }
    return output;
}

/**
 * Create the metadata object and store the album art of the song
 */
async function updateMetadata({ metadata, id, metadataDb, albumArtDb, fileName, lyrics, directoryId }: UpdateMetadataProps) {
    const artist = (metadata.common.artists ?? ["Unknown"]).join(", ");
    const albumArtist = (metadata.common.albumartists ?? ["Unknown"]).join(", ");
    const title = metadata.common.title ?? fileName;
    const album = metadata.common.album ?? "Unknown";
    const composer = metadata.common.composer?.join(", ");
    const metadataObj: metadataDB = {
        artist,
        album,
        albumArtist,
        albumSort: metadata.common.albumsort,
        duration: metadata.format.duration ?? -1,
        track: metadata.common.track.no,
        totalTracks: metadata.common.track.of,
        disk: metadata.common.disk.no,
        diskCount: metadata.common.disk.of,
        genre: (metadata.common.genre ?? ["Unknown"])[0],
        year: metadata.common.year,
        title,
        embeddedLyrics: typeof lyrics === "string" ? lyrics : (metadata.common.lyrics?.length ?? 0) !== 0 ? (metadata.common.lyrics as ILyricsTag[])[0].text ?? "" : "",
        syncedLyrics: typeof lyrics === "object" ? lyrics : [],
        artistSort: metadata.common.artistsort,
        albumArtistSort: metadata.common.albumartistsort,
        titleSort: metadata.common.titlesort,
        composer,
        composerSort: metadata.common.composersort ?? composer,
        name: fileName,
        directoryId
    }
    await IndexedDatabase.set({
        db: metadataDb,
        request: "musicMetadata",
        object: {
            id,
            data: metadataObj
        }
    });
    if ((metadata.common.picture?.length ?? 0) !== 0) {
        await IndexedDatabase.set({
            db: albumArtDb,
            request: "albumArt",
            object: {
                id: GetAlbumArtId({
                    albumAuthor: albumArtist,
                    year: metadata.common.year,
                    albumName: album
                }),
                data: {
                    // @ts-ignore
                    img: new Blob([(metadata.common.picture as IPicture[])[0].data])
                }
            }
        })
    }
    return {
        trackId: id,
        metadata: metadataObj
    } as MetadataSource;
}

interface MetadataToListProps {
    /**
     * All the fetched metadata
     */
    metadataList: [string, MetadataSource[]][],
    /**
     * The type used to sort the `metadataList` object
     */
    type: PossibleSortingOptions,
    /**
     * The metadata that should be added to the list
     */
    metadataToAdd: MetadataSource
}

/**
 * Add the new metadata to the list of all the already-fetched metadata
 */
export function AddMetadataToList({ metadataList, type, metadataToAdd }: MetadataToListProps) {
    const query = type === "album" ? GetAlbumArtId({
        albumAuthor: metadataToAdd.metadata.albumArtist,
        year: metadataToAdd.metadata.year,
        albumName: metadataToAdd.metadata.album
    }) : metadataToAdd.metadata[type === "albumauthors" ? "albumArtist" : type === "none" ? "title" : "artist"];
    const index = type === "none" ? -1 : metadataList.findIndex(i => i[0] === query);
    if (index === -1) { // Let's create a new entry
        metadataList.splice(GetNewItemInMetadataListPosition({ allMetadataLoaded: metadataList, contentType: type, itemToAdd: metadataToAdd }), 0, [type === "none" ? metadataList.length.toString() : query, [metadataToAdd]]);
    } else { // Found entry with the same ID. Let's add it there
        let i = 0;
        while (i < metadataList[index][1].length) {
            if (SortAlbumTracks(metadataList[index][1][i], metadataToAdd) > 0) break;
            i++;
        }
        metadataList[index][1].splice(i, 0, metadataToAdd);
    }

}

/**
 * Save song in database
 */
async function saveSong({ id, file, db, fileName, directoryId }: SaveSongProps) {
    await IndexedDatabase.set({
        db,
        request: "contentData",
        object: {
            data: {
                file,
                name: fileName,
                directoryId
            },
            id
        }
    });
}

interface UpdateMetadataProps {
    metadata: IAudioMetadata,
    id: string,
    metadataDb: IDBDatabase,
    albumArtDb: IDBDatabase,
    fileName: string,
    lyrics?: string | syncedLyricsObj[],
    directoryId?: string
}

interface SaveSongProps {
    id: string,
    file: File | FileSystemFileHandle,
    fileName: string
    directoryId?: string,
    db: IDBDatabase
}