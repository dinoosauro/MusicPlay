import { mount, unmount } from "svelte";
import type { contentDataDB, metadataDB } from "../Database/DatabaseInterfaces";
import IndexedDatabase from "../Database/IndexedDatabase"
import PickDirectory from "../../lib/Dialogs/PickDirectory.svelte";

/**
 * Get an audio file saved in the database
 * @returns the File object of the audio
 */
export default async function GetAudioFile({songDb, songId, metadataDb, skipMissingFileHandle}: GetAudioProps) {
    const audio = await IndexedDatabase.get({
        db: songDb,
        request: "contentData",
        query: songId
    });
    if (!audio) throw new Error("Failed fetching audio from database");
    if ((audio.data as contentDataDB).file instanceof File) {
        return (audio.data as contentDataDB).file as File;
    }
    try { // We have no guarantee that the FileSystemFileHandle will give us a file, so we'll now try to get it.
        if (await ((audio.data as contentDataDB).file as FileSystemFileHandle).queryPermission({mode: "read"}) !== "granted") await ((audio.data as contentDataDB).file as FileSystemFileHandle).requestPermission({mode: "read"});
        return await ((audio?.data as contentDataDB).file as FileSystemFileHandle).getFile();
    } catch(ex: any) {
        if (ex.name === "NotFoundError" && !skipMissingFileHandle) { // The file has been removed, so we'll ask the user to pick it again
            let mounted: any;
            const fileHandle = await new Promise<FileSystemFileHandle | undefined>((res) => {
                mounted = mount(PickDirectory, {
                    target: document.body,
                    props: {
                        isFile: true,
                        handle: (audio.data as contentDataDB).file as FileSystemFileHandle,
                        closeFn: (handle) => res(handle as FileSystemFileHandle)
                    }
                })
            });
            unmount(mounted);
            if (fileHandle) { 
                await IndexedDatabase.set({ // Update the database where the songs are stored with the new handle
                    db: songDb,
                    request: "contentData",
                    object: {
                        id: songId,
                        data: {
                            ...audio.data,
                            file: fileHandle
                        } as contentDataDB
                    }
                });
                // We also have to update the metadata database, since we'll mark this file as picked individually (and no longer picked from a directory)
                const metadata = await IndexedDatabase.get({
                    db: metadataDb,
                    request: "musicMetadata",
                    query: songId
                });
                if (metadata) {
                    await IndexedDatabase.set({
                        db: metadataDb,
                        request: "musicMetadata",
                        object: {
                            id: songId,
                            data: {
                                ...metadata?.data,
                                hasBothDirectoryIdAndFileHandle: true
                            } as metadataDB
                        }
                    })
                }
                return await fileHandle.getFile();
            } else throw ex;
        } else throw ex;
    }
}

interface GetAudioProps {
    songDb: IDBDatabase,
    songId: string,
    metadataDb: IDBDatabase,
    /**
     * If true, an error will be thrown if the file handle can't be found. If false, or not passed, the application will ask the user to pick the file.
     */
    skipMissingFileHandle?: boolean
}