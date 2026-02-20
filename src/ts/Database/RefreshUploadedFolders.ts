import type { contentDataDB, DatabaseContainer, folderHandleDB, metadataDB } from "./DatabaseInterfaces";
import DeleteFiles from "./DeleteFiles";
import GetAlbumArtId from "../DataFetcher/GetAlbumArtId";
import IndexedDatabase from "./IndexedDatabase";
import LoadMetadata from "../DataFetcher/LoadMetadata";
import type { MetadataSource, PossibleSortingOptions } from "../Player/PlayerInterfaces";
import { ReadFilesInDir, SaveSongFileInDatabase } from "./UploadSongs";
import { mount, unmount } from "svelte";
import PickDirectory from "../../lib/Dialogs/PickDirectory.svelte";
import GetAudioFile from "../DataFetcher/GetAudioFile";

interface FileDirStore {
    /**
     * Identifier of the FileSystemDirectoryHandle used to get this file
     */
    id: string,
    /**
     * The FileSystemFileHandle of the file
     */
    handle: FileSystemFileHandle,
    /**
     * Relative path of the file
     */
    name: string
}

interface RefreshUploadedFoldersProps {
    /**
     * All the databases that are used by the applicatoin
     */
    database: DatabaseContainer,
    /**
     * The metadata of all the songs uploaded to the application
     */
    alreadyAddedMetadata: [string, MetadataSource[]][],
    /**
     * The sorting crieria used for the `alreadyAddedMetadata` object
     */
    sortingType: PossibleSortingOptions
}

/**
 * Get the new files in a folder, and delete the ones that can't be found
 */
export default function RefreshUploadedFolders({ database, alreadyAddedMetadata, sortingType }: RefreshUploadedFoldersProps) {
    return new Promise<void>(async (callback, reject) => {
        /**
         * Map with the ID of the FileSystemDirectoryHandle as a key, and the FileSystemDirectoryHandle itself as a value.
         */
        const output = new Map<string, FileSystemDirectoryHandle>([]);
        const req = database.directoryHandleDb.transaction("folderHandle").objectStore("folderHandle").openCursor();
        req.onsuccess = async () => {
            if (req?.result) {
                const metadata = req.result.value.data as folderHandleDB;
                output.set(req.result.primaryKey.toString(), metadata.handle);
                req.result.continue();
            } else { // All the handles have been fetched
                /**
                 * A list of all the files available in all the uploaded folders
                 */
                const availableFiles: FileDirStore[] = [];
                /**
                 * A list of all the FileSystemDirectoryHandle that are no longer usable, since the source directory couldn't be found
                 */
                let resetFileHandle: string[] = [];
                for (const [id, handle] of output) {
                    try {
                        if ((await handle.queryPermission({ mode: "read" })) !== "granted") await handle.requestPermission({ mode: "read" });
                        availableFiles.push(...(await ReadFilesInDir(handle)).map(i => {
                            return {
                                ...i,
                                id: id
                            }
                        }));
                    } catch (ex: any) {
                        if (ex.name === "NotFoundError") { // We need to ask the user to pick again the folder. Therefore, we'll create a new dialog where they can pick the same folder.
                            let mounted: any;
                            const newHandle = await new Promise<FileSystemDirectoryHandle | undefined>((res) => {
                                 mounted = mount(PickDirectory, {
                                    target: document.body,
                                    props: {
                                        closeFn: (handle) => res(handle as FileSystemDirectoryHandle),
                                        handle
                                    }
                                });
                            });
                            unmount(mounted);
                            if (newHandle) { // The user has picked a folder. We need to save it in the database (by replacing the previous handle with this one) and then we'll get all the files
                                await IndexedDatabase.set({
                                db: database.directoryHandleDb,
                                request: "folderHandle",
                                object: {
                                    id,
                                    data: {
                                        handle: newHandle
                                    }
                                }
                                });
                                availableFiles.push(...(await ReadFilesInDir(newHandle)).map(i => {
                                    return {
                                        ...i,
                                        id: id
                                    }
                                }));
                                resetFileHandle.push(id);
                            }
                        } else throw ex;
                    }
                }
                /**
                 * A list of all the files that should be deleted, since they can't be found in the folder
                 */
                let filesToDelete: MetadataSource[] = [];
                for (let j = 0; j < alreadyAddedMetadata.length; j++) {
                    const [_, items] = alreadyAddedMetadata[j];
                    for (let i = 0; i < items.length; i++) {
                        const item = items[i];
                        let index = availableFiles.findIndex(i => i.name === item.metadata.name && i.id === item.metadata.directoryId); // Check both for file name and for directory id
                        if (index !== -1) {
                            const file = availableFiles.splice(index, 1)[0]; // Let's remove the file from the array, so that the remaining files will be the ones that'll be added as new files
                            if (resetFileHandle.indexOf(item.metadata.directoryId as string) !== -1) { // We need to update the file handle, since the previous one is invalid
                                await IndexedDatabase.set({
                                    db: database.songDb,
                                    request: "contentData",
                                    object: {
                                        id: item.trackId,
                                        data: {
                                            file: file.handle,
                                            name: file.name,
                                            directoryId: item.metadata.directoryId
                                        } as contentDataDB
                                    }
                                });
                            }
                        } else if (item.metadata.directoryId) { // Run this logic only if the file has been picked using the File System API, since otherwise we still have the source file
                            if (item.metadata.hasBothDirectoryIdAndFileHandle) { // We'll now try getting the file, since the user might have selected a custom file handle for this file. If we can't, we'll remove it from the list.
                                try {
                                    await GetAudioFile({songDb: database.songDb, songId: item.trackId, metadataDb: database.metadataDb, skipMissingFileHandle: true});
                                } catch(ex: any) {
                                    if (ex.name === "NotFoundError") {
                                        const fileToDelete = items.splice(i, 1);
                                        filesToDelete.push(fileToDelete[0]);
                                        i--;
                                    }
                                }
                            } else {
                                const fileToDelete = items.splice(i, 1);
                                filesToDelete.push(fileToDelete[0]);
                                i--;
                            }
                        }
                    }
                    if (items.length === 0) alreadyAddedMetadata.splice(j, 1);
                }
                await DeleteFiles({ database, files: filesToDelete, alreadyAddedMetadata: sortingType === "album" ? alreadyAddedMetadata : undefined })
                /**
                 * An object that contains the relative path (without the extension) as a key, and all the files as a value.
                 * We'll sort the files in this way so that we can also find .lrc/.ttml files
                 */
                let fileNames: { [name: string]: FileDirStore[] } = {};
                for (const file of availableFiles) {
                    const name = `${file.id}-${file.name.substring(0, file.name.lastIndexOf("."))}`;
                    if (typeof fileNames[name] === "undefined") fileNames[name] = [];
                    fileNames[name].push(file);
                }
                for (const key in fileNames) { // Now, let's process all the audio files.
                    for (const remainingFile of fileNames[key]) {
                        const getFile = await remainingFile.handle.getFile();
                        if (!getFile.type.startsWith("audio")) continue;
                        await SaveSongFileInDatabase(database, {
                            file: getFile,
                            fileHandle: remainingFile.handle,
                            fileName: remainingFile.name,
                            directoryId: remainingFile.id,
                            lyricsFile: await fileNames[key].find(i => i.name.endsWith("lrc") || i.name.endsWith("txt") || i.name.endsWith("ttml") || i.name.endsWith("xml"))?.handle.getFile()
                        }, {
                            data: alreadyAddedMetadata,
                            type: sortingType
                        });
                    }
                }
                callback();
            }
        }
        req.onerror = (ex) => reject(ex);
    });
}