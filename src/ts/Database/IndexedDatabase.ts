import type { albumArtDB, contentDataDB, folderHandleDB, metadataDB, playlistDB, songsStatsDB } from "./DatabaseInterfaces"

/**
 * The object stores used by the application
 */
type RequestType = "contentData" | "musicMetadata" | "albumArt" | "artistImg" | "folderHandle" | "playlist" | "playlistImg" | "songStats"

interface GetObj {
    db: IDBDatabase,
    /**
     * The object store for this transaction
     */
    request: RequestType,
    /**
     * The ID of the resource to get
     */
    query: string
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
}
interface SetInnerObject {
    id: string,
    data: contentDataDB | metadataDB | albumArtDB | folderHandleDB | songsStatsDB | playlistDB
}

export default {
    /**
     * Get the Indexed DB Database
     * @returns The IDBDatabase
     */
    db: (request: RequestType) => {
        return new Promise<IDBDatabase>((resolve, reject) => {
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
        })
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
    set: ({ db, request, object }: SetObj) => {
        return new Promise<void>((resolve, reject) => {
            let transaction = db.transaction([request], "readwrite");
            let objectStore = transaction.objectStore(request);
            let storage = objectStore.get(object.id ?? "Unknown"); // Check if the value already exists, so that it can be updated rather than added as a new entry
            storage.onsuccess = () => {
                let requestUpdate = storage.result === undefined ? objectStore.add(object) : objectStore.put(object);
                requestUpdate.onsuccess = () => {
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
    remove: ({ db, request, query }: GetObj) => { // Remove an item from the Database
        return new Promise<void>((resolve, reject) => {
            let transaction = db.transaction([request], "readwrite");
            let objectStore = transaction.objectStore(request);
            let req = objectStore.delete(query);
            req.onsuccess = () => resolve();
            req.onerror = (ex) => reject(ex);
        })
    }
}