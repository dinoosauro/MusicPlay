import CloudStorage from "./CloudStorage"
import Settings from "../Settings"
import type { albumArtDB, contentDataDB, folderHandleDB, GDriveIdContainer, metadataDB, playlistDB, songsStatsDB } from "./DatabaseInterfaces"

/**
 * The object stores used by the application
 */
type RequestType = "contentData" | "musicMetadata" | "albumArt" | "artistImg" | "folderHandle" | "playlist" | "playlistImg" | "songStats" | "gdrive" | "onedrive"

interface GetObj {
    db: IDBDatabase,
    /**
     * The object store for this transaction
     */
    request: RequestType,
    /**
     * The ID of the resource to get
     */
    query: string,
}
interface RemoveObj extends GetObj {
    skipDrive?: boolean
}
interface SetObj {
    db: IDBDatabase,
    /**
     * The ID of the object to set, along with its values in the "data" property
     */
    object: SetInnerObject,
    /**
     * The object store for this transaction
     */
    request: RequestType,
    skipDrive?: boolean
}
interface SetInnerObject {
    id: string,
    data: contentDataDB | metadataDB | albumArtDB | folderHandleDB | songsStatsDB | playlistDB | GDriveIdContainer
}

let gDriveDb: IDBDatabase;
let onedriveDb: IDBDatabase;

const obj = {
    /**
     * Get the Indexed DB Database
     * @returns The IDBDatabase
     */
    db: async (request: RequestType) => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
            let req = indexedDB.open(`MusicPlayerDB-${request}`, 1);
            req.onupgradeneeded = () => { // We need to create the new object store
                let db = req.result;
                let storage: IDBObjectStore = db.createObjectStore(request, { keyPath: "id" });
                storage.transaction.oncomplete = () => {
                    resolve(db);
                };
                storage.transaction.onerror = (ex) => reject(ex);
            }
            req.onsuccess = () => resolve(req.result);
            req.onblocked = (ex) => reject(ex);
            req.onerror = (ex) => reject(ex)
        });
        if (request === "gdrive") gDriveDb = db;
        if (request === "onedrive") onedriveDb = db;
        return db;
    },
    /**
     * Get an element from the IndexedDB
     * @returns The object associated with the query
     */
    get: ({ db, request, query }: GetObj) => { // Get a content from the database
        return new Promise<SetInnerObject | undefined>((resolve, reject) => {
            let transaction = db.transaction([request], "readonly");
            let objectStore = transaction.objectStore(request);
            let req = objectStore.get(query);
            req.onsuccess = () => {
                resolve(req.result);
            }
            req.onerror = (ex) => {
                reject(ex);
            }
        })
    },
    /**
     * Set content to the database
     * @returns A promise, resolved or rejected when the operation has ended
     */
    set: ({ db, request, object, skipDrive }: SetObj) => {
        return new Promise<void>((resolve, reject) => {
            let transaction = db.transaction([request], "readwrite");
            let objectStore = transaction.objectStore(request);
            let storage = objectStore.get(object.id ?? "Unknown"); // Check if the value already exists, so that it can be updated rather than added as a new entry
            storage.onsuccess = () => {
                let requestUpdate = storage.result === undefined ? objectStore.add(object) : objectStore.put(object);
                requestUpdate.onsuccess = async () => {
                    if ((Settings.cloudStorage.googleDrive.enabled || Settings.cloudStorage.onedrive.enabled) && !skipDrive) obj.cloudHelper.driveSetWrapper({object, request});
                    resolve();
                }
                requestUpdate.onerror = (ex) => {
                    reject(ex);
                }
            }
            storage.onerror = (ex) => {
                reject(ex);
            }
        })
    },
    /**
     * Remove an item from the Database
     * @returns A promise, resolved or rejected when the operation finished
     */
    remove: ({ db, request, query, skipDrive }: RemoveObj) => { // Remove an item from the Database
        return new Promise<void>((resolve, reject) => {
            let transaction = db.transaction([request], "readwrite");
            let objectStore = transaction.objectStore(request);
            let req = objectStore.delete(query);
            req.onsuccess = async () => {
                if (!skipDrive && (Settings.cloudStorage.googleDrive.enabled || Settings.cloudStorage.onedrive.enabled)) {
                    try {
                        await CloudStorage.deleteFromCloud({subfolder: request, id: query, db: Settings.cloudStorage.onedrive.enabled ? onedriveDb : gDriveDb})
                    } catch(ex) { // Failed cloud delete. Let's save the current request info so that we can delete it later.
                        const failedIds = new Set(JSON.parse(localStorage.getItem("MusicPlayer-FailedDelete") ?? "[]")) as Set<string>;
                        failedIds.add(`${request}____${query}`);
                        localStorage.setItem("MusicPlayer-FailedDelete", JSON.stringify(Array.from(failedIds)));
                        console.warn(ex);
                    }
                }
                resolve();
            }
            req.onerror = (ex) => reject(ex);
        })
    },
    /**
     * Functions that help with cloud sync
     */
    cloudHelper: {
        /**
         * Logic used to convert a `set` request to a cloud upload request.
         */
        driveSetWrapper: async ({ object, request }: { object: SetInnerObject, request: RequestType }) => {
            try {
                if (!CloudStorage.token) throw new Error("No token available");
                switch (request) {
                    case "musicMetadata": case "playlist": case "songStats":
                        await CloudStorage.uploadToDrive({
                            data: new Blob([JSON.stringify(object.data)]),
                            name: object.id,
                            subfolder: request,
                            gDriveDb: Settings.cloudStorage.onedrive.enabled ? onedriveDb : gDriveDb
                        })
                        break;
                    case "albumArt": case "artistImg": case "playlistImg":
                        await CloudStorage.uploadToDrive({
                            data: (object.data as albumArtDB).img,
                            name: object.id,
                            subfolder: request,
                            gDriveDb: Settings.cloudStorage.onedrive.enabled ? onedriveDb : gDriveDb
                        })
                        break;
                    case "contentData":
                        await CloudStorage.uploadToDrive({
                            data: ((object.data as contentDataDB).file instanceof File) ? ((object.data as contentDataDB).file as File) : await ((object.data as contentDataDB).file as FileSystemFileHandle).getFile(),
                            name: (object.data as contentDataDB).name,
                            subfolder: request,
                            gDriveDb: Settings.cloudStorage.onedrive.enabled ? onedriveDb : gDriveDb,
                            fileId: object.id
                        })
                        break;
                }
            } catch(ex) { // The file couldn't be uploaded. Let's save the request information so that we can later upload it.
                const failedIds = new Set(JSON.parse(localStorage.getItem("MusicPlayer-FailedUploads") ?? "[]")) as Set<string>;
                failedIds.add(`${request}____${object.id}`);
                localStorage.setItem("MusicPlayer-FailedUploads", JSON.stringify(Array.from(failedIds)));
                throw ex;
            }
        }
    }
}



export default obj;