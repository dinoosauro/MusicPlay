import type { DatabaseContainer, GDriveIdContainer, metadataDB, songsStatsDB } from "./DatabaseInterfaces";
import IndexedDatabase from "./IndexedDatabase";
import Settings from "../Settings";
import ShowAlert from "../SvelteComponentsHelpers/ShowAlert";

/**
 * Function to call when the showDriveLoginRequest dialog is replaced
 */
let previousRej: (() => void) | undefined = undefined;
const obj = {
    /**
     * Token used to log in to the selected cloud storage
    */
    token: null as string | null,
    /**
     * A list of all the functions to call when the `startDriveIntegration` function manags to get an access token.
    */
    promiseWhenFetched: [] as ((value: boolean | PromiseLike<boolean>) => void)[],
    /**
     * Function to call when the "Log in to sync with Drive" dialog should be shown. A link might be sent if the issue was related to browser restrictions to pop-ups
     */
    showDriveLoginRequest: undefined as ((link?: string) => void) | undefined,
    /**
     * List of all the functions to call when the cloud storage sync process starts and ends.
     */
    uploadInfoCallback: [] as ((ongoing: boolean) => void)[],
    /**
     * Function to call to upload a file to the selected cloud storage
     */
    uploadToDrive,
    /**
     * If the application has completed the sync with the cloud storage that is done when the website is opened
     */
    hasDriveSyncBeenDone: false,
    /**
     * Function to call when an element should be deleted
     */
    deleteFromCloud,
    /**
     * Get a new token for cloud services
     * @param databases the container of all the databases
     * @param useOneDrive force OneDrive login
     */
    startDriveIntegration: async (databases?: DatabaseContainer, useOneDrive?: boolean) => {
        const getToken = client(useOneDrive);
        getToken.catch(() => { // Notify that an error occurred
            const entries = [...obj.promiseWhenFetched];
            obj.promiseWhenFetched = [];
            for (const entry of entries) entry(false);
        })
        await getToken;
        const entries = [...obj.promiseWhenFetched];
        obj.promiseWhenFetched = [];
        for (const entry of entries) entry(true);
        if (!obj.hasDriveSyncBeenDone && databases) { // The first sync with all of the uploaded content on Drive should be done
            obj.hasDriveSyncBeenDone = true;
            syncWithDrive(databases);
        } else if (databases) uploadMissingFiles(databases); // Otherwise, just upload the elements that couldn't be uploaded.
    }
}

/**
 * Get a new token for the cloud service that the user has set up.
 * @param useOneDrive if the OneDrive connection should be forced. If not passed, OneDrive will be used only if enabled in the settings
 */
async function client(useOneDrive?: boolean) {
    return new Promise<void>(async (res, rej) => {
        if (Settings.cloudStorage.onedrive.enabled || useOneDrive) {
            if (Settings.cloudStorage.onedrive.refreshToken) { // Login already done, we just need to refresh the token
                const req = await fetch(`https://login.microsoftonline.com/common/oauth2/v2.0/token`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded"
                    },
                    body: new URLSearchParams({
                        client_id: "e90bdf05-85b5-4676-936d-3cf737d4cd67",
                        scope: "offline_access Files.ReadWrite.AppFolder",
                        refresh_token: Settings.cloudStorage.onedrive.refreshToken,
                        grant_type: "refresh_token"
                    })
                });
                if (req.ok) {
                    const outRes = await req.json();
                    Settings.cloudStorage.onedrive.enabled = true;
                    Settings.cloudStorage.onedrive.refreshToken = outRes.refresh_token;
                    obj.token = outRes.access_token;
                    res();
                } else {
                    obj.showDriveLoginRequest && obj.showDriveLoginRequest();
                    rej();
                }
                return;
            }
            // No login done. The following code will handle the login folow used to get the token from Microsoft's servers
            const buffer = crypto.getRandomValues(new Uint8Array(32));
            function getBase64Str(buffer: Uint8Array) {
                let str = "";
                for (let i = 0; i < buffer.byteLength; i++) str += String.fromCharCode(buffer[i]);
                return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
            }
            const codeVerifier = getBase64Str(buffer);
            const sha = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier));
            const codeChallenge = getBase64Str(new Uint8Array(sha));
            const url = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=e90bdf05-85b5-4676-936d-3cf737d4cd67&response_type=code&redirect_uri=${encodeURIComponent(`${window.location.href.substring(0, window.location.href.lastIndexOf("/"))}/oauth.html`)}&response_mode=query&scope=offline_access%20Files.ReadWrite.AppFolder&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256`;
            const win = window.open(url);
            if (!win) {
                if (previousRej) previousRej();
                obj.showDriveLoginRequest && obj.showDriveLoginRequest(url);
                // We won't reject the promise immediately, since the user might solve this by showing the dialog.
                previousRej = rej;
            }
            /**
             * If the code has been received from the pop-up window
             */
            let success = false;
            window.onmessage = async (e) => {
                if (e.origin !== window.location.origin) return;
                if (e.data.code) {
                    previousRej = undefined;
                    success = true;
                    const req = await fetch(`https://login.microsoftonline.com/common/oauth2/v2.0/token`, {
                        headers: {
                            "Content-Type": "application/x-www-form-urlencoded"
                        },
                        method: "POST",
                        body: new URLSearchParams({
                            client_id: "e90bdf05-85b5-4676-936d-3cf737d4cd67",
                            scope: "offline_access Files.ReadWrite.AppFolder",
                            code: e.data.code,
                            redirect_uri: `${window.location.href.substring(0, window.location.href.lastIndexOf("/"))}/oauth.html`,
                            grant_type: "authorization_code",
                            code_verifier: codeVerifier
                        }).toString()
                    });
                    if (!req.ok) {
                        obj.showDriveLoginRequest && obj.showDriveLoginRequest();
                        rej();
                    } else {
                        const outRes = await req.json();
                        const folderReq = await fetch(`https://graph.microsoft.com/v1.0/me/drive/special/approot`, { // Let's get the ID of the folder created for MusicPlay
                            headers: {
                                Authorization: `Bearer ${outRes.access_token}`
                            }
                        });
                        if (folderReq.ok) {
                            const folderJson = await folderReq.json();
                            Settings.cloudStorage.onedrive.enabled = true;
                            Settings.cloudStorage.onedrive.refreshToken = outRes.refresh_token;
                            Settings.cloudStorage.onedrive.folderId = folderJson.id;
                            obj.token = outRes.access_token;
                            res();
                        } else {
                            obj.showDriveLoginRequest && obj.showDriveLoginRequest();
                            rej();
                        }
                    }
                }
                if (win) win.onclose = () => {
                    if (!success) rej();
                }
            }
            return;
        }
        if (Settings.cloudStorage.googleDrive.customOpts.useRefreshToken && Settings.cloudStorage.googleDrive.customOpts.refreshToken) { // Refresh token fetched: the user has set up advanced mode, so we can create a new refresh token
            const tokenReq = await fetch(`https://oauth2.googleapis.com/token?client_id=${encodeURIComponent(Settings.cloudStorage.googleDrive.customOpts.clientId)}&client_secret=${encodeURIComponent(Settings.cloudStorage.googleDrive.customOpts.clientSecret)}&grant_type=refresh_token&refresh_token=${encodeURIComponent(Settings.cloudStorage.googleDrive.customOpts.refreshToken)}`, { method: "POST" });
            if (tokenReq.ok) {
                const tokenRes = await tokenReq.json();
                obj.token = tokenRes.access_token;
                res();
            } else {
                Settings.cloudStorage.googleDrive.customOpts.refreshToken = "";
                obj.showDriveLoginRequest && obj.showDriveLoginRequest();
                rej();
            }
            return;
        }
        // Authentication necessary: let's open a window 
        const url = Settings.cloudStorage.googleDrive.customOpts.useRefreshToken
            ? `https://accounts.google.com/o/oauth2/v2/auth?scope=${encodeURIComponent("https://www.googleapis.com/auth/drive.appdata")}&include_granted_scopes=true&access_type=offline&prompt=consent&redirect_uri=${encodeURIComponent(`${window.location.href.substring(0, window.location.href.lastIndexOf("/"))}/oauth.html`)}&response_type=code&client_id=${encodeURIComponent(Settings.cloudStorage.googleDrive.customOpts.clientId)}`
            : `https://accounts.google.com/o/oauth2/v2/auth?scope=${encodeURIComponent("https://www.googleapis.com/auth/drive.appdata")}&include_granted_scopes=true&redirect_uri=${encodeURIComponent(`${window.location.href.substring(0, window.location.href.lastIndexOf("/"))}/oauth.html`)}&response_type=token&client_id=${encodeURIComponent("466333744495-171vqtdksvutb85bc0slifo4vo6inblr.apps.googleusercontent.com")}`;
        const win = window.open(url, "_blank", `width=600,height=400`);
        if (!win) {
            // Same logic as the one used for OneDrive login
            if (previousRej) previousRej();
            obj.showDriveLoginRequest && obj.showDriveLoginRequest(url);
            previousRej = rej;
        }
        let success = false;
        window.onmessage = async (e) => {
            if (e.origin !== window.location.origin) return;
            if (e.data.gtoken) { // Easy mode: we directly get the access token
                previousRej = undefined;
                success = true;
                obj.token = e.data.gtoken;
                Settings.cloudStorage.googleDrive.enabled = true;
                res();
            } else if (e.data.code) { // Advanced mode: let's get the token
                const tokenReq = await fetch(`https://oauth2.googleapis.com/token?client_id=${encodeURIComponent(Settings.cloudStorage.googleDrive.customOpts.clientId)}&client_secret=${encodeURIComponent(Settings.cloudStorage.googleDrive.customOpts.clientSecret)}&code=${encodeURIComponent(e.data.code)}&grant_type=authorization_code&redirect_uri=${encodeURIComponent(`${window.location.href.substring(0, window.location.href.lastIndexOf("/"))}/oauth.html`)}`, { method: "POST" });
                if (tokenReq.ok) {
                    const tokenJson = await tokenReq.json();
                    Settings.cloudStorage.googleDrive.customOpts.refreshToken = tokenJson.refresh_token;
                    obj.token = tokenJson.access_token;
                    Settings.cloudStorage.googleDrive.enabled = true;
                    res();
                } else {
                    obj.showDriveLoginRequest && obj.showDriveLoginRequest();
                    rej();
                }
            }
        }
        if (win) win.onclose = () => {
            if (!success) rej();
        }
    })
}

/**
 * Fetch requests that are able to automatically generate a new access token if the previous one expired. Note that the access token must always be passed in the headers section
 * @param url the URL that should be fetched
 * @param init fetch request options
 * @param status **Not edit this field**. Used by the function to try again server requests
 * @returns a new Response, with the result from that server
 */
async function intelliFetch(url: RequestInfo | URL, init?: RequestInit, status = 0) {
    const req = await fetch(url, init);
    if (req.status === 401) { // Access token expired
        const result = await new Promise<boolean>(res => {
            obj.promiseWhenFetched.push(res);
            obj.startDriveIntegration();
        });
        if (!result || status > 2) {
            obj.showDriveLoginRequest && obj.showDriveLoginRequest();
            return req;
        }
        return await intelliFetch(url, {
            ...init,
            headers: {
                ...init?.headers,
                Authorization: `Bearer ${obj.token}`
            }
        }, 1);
    }
    return req;
}

/**
 * Try again uploading the files that couldn't be uploaded
 * @param databases the database list
 */
async function uploadMissingFiles(databases: DatabaseContainer) {
    const filesToUpload = JSON.parse(localStorage.getItem("MusicPlayer-FailedUploads") ?? "[]") as string[];
    for (const file of filesToUpload) {
        let [fileType, id] = [file.substring(0, file.indexOf("____")), file.substring(file.indexOf("____") + 4)];
        try {
            const singleFile = await IndexedDatabase.get({
                db: fileType === "playlist" ? databases.playlistDb : fileType === "songStats" ? databases.songStatsDb : fileType === "musicMetadata" ? databases.metadataDb : fileType === "albumArt" ? databases.albumArtDb : fileType === "artistImg" ? databases.artistImgDb : fileType === "playlistImg" ? databases.playlistImgDb : databases.songDb,
                request: fileType as "songStats",
                query: id
            });
            if (singleFile) {
                await IndexedDatabase.cloudHelper.driveSetWrapper({ object: singleFile, request: fileType as "songStats" });
                deleteFromFailedUploads(file);
            }
        } catch (ex) { }
    }
}

/**
 * Initial sync with OneDrive. Downloads all the file changes, and syncs the edits that have been made when the user was offline.
 * @param databases the database container
 */
async function syncWithOneDrive(databases: DatabaseContainer) {
    const startFetchDate = Date.now();
    await handleMissingCloudDelete(databases);
    const folders = await intelliFetch(`https://graph.microsoft.com/v1.0/me/drive/items/${Settings.cloudStorage.onedrive.folderId}/children?$orderby=lastModifiedDateTime desc`, {
        headers: {
            Authorization: `Bearer ${obj.token}`
        }
    });
    if (!folders.ok) return;
    const foldersJson = await folders.json();
    for (const folder of foldersJson.value) {
        let nextLink: string | undefined = `https://graph.microsoft.com/v1.0/me/drive/items/${folder.id}/children?$orderby=lastModifiedDateTime desc`;
        while (nextLink) {
            const fileReq = await intelliFetch(nextLink, {
                headers: {
                    Authorization: `Bearer ${obj.token}`
                }
            });
            if (!fileReq.ok) return;
            const fileRes = await fileReq.json();
            nextLink = fileRes["@odata.nextLink"];
            for (const file of fileRes.value) {
                if (new Date(file.lastModifiedDateTime).valueOf() < Settings.cloudStorage.onedrive.lastSync) {
                    nextLink = undefined;
                    break;
                }
                const content = await IndexedDatabase.get({ db: databases.onedriveContainer, request: "onedrive", query: `${folder.name}____${folder.name === "contentData" ? file.name.substring(1, file.name.indexOf("]")) : file.name}` });
                if ((content?.data as GDriveIdContainer)?.lastEditId === (file.cTag)) continue; // The last version of the file is already stored on the device
                const download = await fetch(file["@microsoft.graph.downloadUrl"]);
                if (download.ok) {
                    await updateIndexedDatabase({ fileType: folder.name, name: file.name, databases, fileId: folder.name === "contentData" ? file.name.substring(1, file.name.indexOf("]")) : undefined, req: download });
                    await IndexedDatabase.set({ db: databases.onedriveContainer, request: "onedrive", skipDrive: true, object: { id: folder.name === "contentData" ? `contentData____${file.name.substring(1, file.name.indexOf("]"))}` : `${folder.name}____${file.name}`, data: { lastEditId: file.cTag, driveId: file.id } } });
                }
            }
        }
    }
    await uploadMissingFiles(databases);
    if (!Settings.cloudStorage.onedrive.allUploaded) await finishUploadingFiles(databases); // This means that the first sync has been interrupted while the client was uploading the user's library. Some songs might still need to be uploaded.
    Settings.cloudStorage.onedrive.lastSync = startFetchDate;
    Settings.cloudStorage.onedrive.allUploaded = true;
}

interface UpdateIDBProps {
    fileType: string,
    name: string,
    databases: DatabaseContainer,
    /**
     * Used when `fileType` is `contentData`. It identifies the ID of the track, since audio files are saved with their name on Google Drive and not with their ID.
     */
    fileId?: string,
    req: Response
}

/**
 * Update the indexed database by replacing the original data with the one downloaded from the cloud storage
 */
async function updateIndexedDatabase({ fileType, name, databases, fileId, req }: UpdateIDBProps) {
    const fileName = `${fileType}___${name}`;
    switch (fileType) {
        case "musicMetadata": case "playlist": case "songStats": {
            if (fileType === "songStats") { // We'll merge the listening activity before saving the new file
                const currentSongStats = await IndexedDatabase.get({ db: databases.songStatsDb, request: "songStats", query: name });
                const metadata = await IndexedDatabase.get({ db: databases.metadataDb, request: "musicMetadata", query: name });
                if (currentSongStats && metadata) {
                    const json = await req.json();
                    for (const item of (json as songsStatsDB).activity) {
                        if (!(currentSongStats.data as songsStatsDB).activity.find(i => item.date === i.date && item.duration === i.duration)) (currentSongStats.data as songsStatsDB).activity.push(item);
                    }
                    (currentSongStats.data as songsStatsDB).activity.sort((a, b) => a.date - b.date); // Sort all the activities since the "Stats" section exits from the loops the first time a listen has been done before the selected time interval
                    (currentSongStats.data as songsStatsDB).totalMs = (currentSongStats.data as songsStatsDB).activity.reduce((a, s) => a + s.duration, 0);
                    (currentSongStats.data as songsStatsDB).totalPlay = (currentSongStats.data as songsStatsDB).totalMs / 1000 / (metadata.data as metadataDB).duration;
                    req = new Response(JSON.stringify(currentSongStats.data));
                }
            }
            await IndexedDatabase.set({ db: fileType === "playlist" ? databases.playlistDb : fileType === "songStats" ? databases.songStatsDb : databases.metadataDb, request: fileType, skipDrive: true, object: { id: name, data: await req.json() } });
            deleteFromFailedUploads(fileName);
            break;
        }
        case "albumArt": case "artistImg": case "playlistImg": {
            await IndexedDatabase.set({ db: fileType === "albumArt" ? databases.albumArtDb : fileType === "artistImg" ? databases.artistImgDb : databases.playlistImgDb, request: fileType, skipDrive: true, object: { id: name, data: { img: await req.blob() } } });
            deleteFromFailedUploads(fileName);
            break;
        }
        case "contentData": {
            await IndexedDatabase.set({ db: databases.songDb, request: fileType, skipDrive: true, object: { id: fileId || name, data: { name: name.substring(name.indexOf("]") + 2), file: new File([await req.blob()], name.substring(name.indexOf("]") + 2)) } } })
            deleteFromFailedUploads(`${fileType}____${fileId}`);
            break;
        }
    }

}

/**
 * Downloads all the file changes, and syncs the edits that have been made when the user was offline.
 * @param databases the database container
 */
async function syncWithDrive(databases: DatabaseContainer) {
    for (const fn of obj.uploadInfoCallback) fn(true); // Tell the user that drive sync is ongoing
    if (Settings.cloudStorage.onedrive.enabled) {
        await syncWithOneDrive(databases);
        for (const fn of obj.uploadInfoCallback) fn(false); // Hide the "drive sync in progress" dialog
        return;
    }
    await syncWithGoogleDrive(databases);
    for (const fn of obj.uploadInfoCallback) fn(false); // Hide the "drive sync in progress" dialog
}

/**
 * Initial sync with Google Drive. Downloads all the file changes, and syncs the edits that have been made when the user was offline.
 * @param databases the database list
 */
async function syncWithGoogleDrive(databases: DatabaseContainer) {
    const params = new URLSearchParams([["orderBy", "modifiedTime desc"], ["spaces", "appDataFolder"], ["fields", "files(id, name, mimeType, appProperties, createdTime, modifiedTime)"], ["pageSize", "1000"]]);
    /**
     * the next pageToken parameter so that all the files can be fetched.
     * - If `null`, the first request hasn't been fired yet;
     * - If `false`, all the files have been fetched
     */
    let pageToken = null;
    await handleMissingCloudDelete(databases);
    const startFetchDate = Date.now();
    while (pageToken !== false) {
        const files = await intelliFetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
            headers: {
                Authorization: `Bearer ${obj.token}`,
            }
        });
        if (!files.ok) return;
        const res = await files.json();
        pageToken = res.nextPageToken || false;
        if (pageToken) params.set("pageToken", pageToken);
        for (const file of res.files) {
            try {
                if (new Date(file.modifiedTime).valueOf() < Settings.cloudStorage.googleDrive.lastSync) {
                    pageToken = false;
                    break;
                }
                const content = await IndexedDatabase.get({ db: databases.googleDriveContainer, request: "gdrive", query: file.name.startsWith("contentData") ? `contentData____${file.appProperties.fileId}` : file.name });
                if ((content?.data as GDriveIdContainer)?.lastEditId === file.appProperties.operationId) continue;
            } catch (ex) {
                console.warn(ex);
            }
            const req = await intelliFetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
                headers: {
                    Authorization: `Bearer ${obj.token}`
                }
            });
            if (req.ok) {
                const fileType = file.name.substring(0, file.name.indexOf("_"));
                await updateIndexedDatabase({
                    fileType: fileType,
                    name: file.name.substring(file.name.indexOf("____") + 4),
                    databases,
                    fileId: file.appProperties.fileId,
                    req
                });
                await IndexedDatabase.set({ db: databases.googleDriveContainer, request: "gdrive", skipDrive: true, object: { id: file.name, data: { lastEditId: file.appProperties.operationId, driveId: file.id } } })
            }
        }
    }
    await uploadMissingFiles(databases);
    if (!Settings.cloudStorage.googleDrive.allUploaded) await finishUploadingFiles(databases);
    Settings.cloudStorage.googleDrive.lastSync = startFetchDate;
    Settings.cloudStorage.googleDrive.allUploaded = true;

}

/**
 * Upload all the database entries to the cloud service
 * @param databases database container
 */
async function finishUploadingFiles(databases: DatabaseContainer) {
    for (const key of Object.keys(databases) as (keyof DatabaseContainer)[]) { // Iterate over all databases
        if (key === "directoryHandleDb" || key === "googleDriveContainer" || key === "onedriveContainer") continue;
        const database = databases[key as keyof DatabaseContainer]
        const requestKey = key === "songDb" ? "contentData" : key === "metadataDb" ? "musicMetadata" : key === "albumArtDb" ? "albumArt" : key === "artistImgDb" ? "artistImg" : key === "playlistDb" ? "playlist" : key === "playlistImgDb" ? "playlistImg" : "songStats";
        const dbReq = database.transaction([requestKey], "readonly").objectStore(requestKey).openKeyCursor();
        /**
         * List with all the keys inside the `database`, so that we can fetch one item at a time and not use a lot of memory.
         */
        const allKeys: string[] = [];
        await new Promise<void>(res => {
            dbReq.onsuccess = (e) => {
                if (!dbReq.result) res(); else {
                    allKeys.push(dbReq.result.primaryKey.toString());
                    dbReq.result?.continue();
                }
            }
        });
        for (const key of allKeys) {
            let value: any = requestKey === "contentData" ? await IndexedDatabase.get({ db: database, request: requestKey, query: key }) : undefined;
            const uploadStatus = await IndexedDatabase.get({ db: Settings.cloudStorage.onedrive.enabled ? databases.onedriveContainer : databases.googleDriveContainer, query: `${requestKey}____${key}`, request: Settings.cloudStorage.onedrive.enabled ? "onedrive" : "gdrive" }); // If the entry exists, the file has already been uploaded.
            if (!uploadStatus) {
                try {
                    if (!value) value = await IndexedDatabase.get({ db: database, request: requestKey, query: key });
                    if (value) await IndexedDatabase.cloudHelper.driveSetWrapper({ object: value, request: requestKey });
                } catch (ex) {
                    console.warn(ex);
                }
            }
        }
    }
}


interface UploadProps {
    data: Blob,
    name: string,
    subfolder: string,
    gDriveDb: IDBDatabase,
    fileId?: string
}

/**
 * Upload a file to OneDrive
 */
async function uploadToOneDrive({ data, name, subfolder, gDriveDb, fileId }: UploadProps) {
    if (!Settings.cloudStorage.onedrive.folders[subfolder]) { // We need to get the ID of the folder. Let's check if a folder with the same name exists
        const folderList = await intelliFetch(`https://graph.microsoft.com/v1.0/me/drive/items/${Settings.cloudStorage.onedrive.folderId}/children?$orderby=lastModifiedDateTime desc`, {
            headers: {
                Authorization: `Bearer ${obj.token}`
            }
        });
        if (folderList.ok) {
            for (const folder of (await folderList.json()).value) { // Let's save all the folder IDs 
                Settings.cloudStorage.onedrive.folders[folder.name] = folder.id;
            }
        } else throw new Error("Failed folder fetching");
        if (!Settings.cloudStorage.onedrive.folders[subfolder]) { // We still haven't fetched the ID of this folder. So, we need to create a new folder.
            const req = await intelliFetch(`https://graph.microsoft.com/v1.0/me/drive/items/${Settings.cloudStorage.onedrive.folderId}/children`, {
                headers: {
                    Authorization: `Bearer ${obj.token}`,
                    "Content-Type": "application/json",
                },
                method: "POST",
                body: JSON.stringify({
                    name: subfolder,
                    folder: {},
                    "@microsoft.graph.conflictBehavior": "rename"
                })
            });
            if (req.ok) {
                const json = await req.json();
                Settings.cloudStorage.onedrive.folders[subfolder] = json.id;
            } else throw new Error("Failed folder creation");
        }
    }
    const req = await intelliFetch(`https://graph.microsoft.com/v1.0/me/drive/items/${Settings.cloudStorage.onedrive.folders[subfolder]}:/${fileId ? `[${fileId}] ` : ""}${name.replaceAll("/", "")}:/createUploadSession`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${obj.token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            item: {
                "@microsoft.graph.conflictBehavior": "replace",
                "fileSystemInfo": {
                    lastModifiedDateTime: new Date().toISOString()
                },
                name: `${fileId ? `[${fileId}] ` : ""}${name.replaceAll("/", "")}`
            },
            deferCommit: true
        })
    });
    if (req.ok) {
        const json = await req.json();
        let position = json.nextExpectedRanges;
        if (position[0] === "0-" && data.size > 60_000_000) position[0] = `0-4915200`; // OneDrive API supports a maximum of 60 MB of uploads per request. If the file is bigger, we'll need to split it in multiple parts (we'll do aproximately 5 MB per request)
        while (position[0]) {
            const [start, end] = [position[0].substring(0, position[0].indexOf("-")), position[0].substring(position[0].indexOf("-") + 1)];
            const realEnd = Math.min(end.trim() === "" ? Infinity : +end, data.size - 1);
            const uploadReq = await intelliFetch(json.uploadUrl, {
                method: "PUT",
                headers: {
                    "Content-Range": `bytes ${start}-${realEnd}/${data.size}`,
                },
                body: data.slice(+start, realEnd + 1)
            });
            if (uploadReq.ok) {
                const id = await uploadReq.json();
                if (id.nextExpectedRanges) {
                    position = id.nextExpectedRanges;
                } else {
                    position = [];
                }
            } else throw new Error();
        }
        const finalReq = await intelliFetch(json.uploadUrl, { // The empty request tells OneDrive that we finished uploading the file, and so it should be finalized.
            method: "POST",
            headers: {
                "Content-Length": "0"
            }
        });
        if (finalReq.ok) {
            const finalItem = await finalReq.json();
            await IndexedDatabase.set({ db: gDriveDb, request: "onedrive", object: { id: `${subfolder}____${name}`, data: { lastEditId: finalItem.cTag, driveId: finalItem.id } } });
            deleteFromFailedUploads(`${subfolder}____${fileId ?? name}`);
        } else throw new Error();
    } else throw new Error()
}

/**
 * Upload a file to the selected cloud storage
 * @param data information about the data to upload
 */
async function uploadToDrive(data: UploadProps) {
    if (Settings.cloudStorage.onedrive.enabled) {
        await uploadToOneDrive(data);
        return;
    }
    await uploadToGoogleDrive(data);
}

/**
 * Upload a file to Google Drive
 */
async function uploadToGoogleDrive({ data, name, subfolder, gDriveDb, fileId }: UploadProps) {
    const operationId = crypto.randomUUID();
    const uploadedFileInfo = await IndexedDatabase.get({ db: gDriveDb, request: "gdrive", query: `${subfolder}____${fileId || name}` });
    /**
     * If `0`, we still need to do the first request, and so we'll try sending a PATCH request to replace the content of the existing file (if the file has already been uploaded).
     * If `1`, the first fetch request failed, and so we'll upload a new file to Google Drive.
     */
    let isSecondLoopTry = 0;
    while (isSecondLoopTry < 2) {
        const req = await intelliFetch(
            `https://www.googleapis.com/upload/drive/v3/files${uploadedFileInfo && isSecondLoopTry === 0 ? `/${(uploadedFileInfo.data as GDriveIdContainer).driveId}` : ""}?uploadType=resumable`, {
            method: uploadedFileInfo && isSecondLoopTry === 0 ? "PATCH" : "POST",
            headers: {
                Authorization: `Bearer ${obj.token}`,
                "Content-Type": "application/json; charset=UTF-8",
                "X-Upload-Content-Type": data.type || "application/json",
                "X-Upload-Content-Length": data.size.toString()
            },
            body: JSON.stringify({ name: `${subfolder}____${name}`, mimeType: data.type || "application/json", parents: uploadedFileInfo && isSecondLoopTry === 0 ? undefined : ["appDataFolder"], appProperties: { operationId, fileId }, modifiedTime: new Date().toISOString() })
        });
        if (req.status === 404 && isSecondLoopTry === 0) {
            isSecondLoopTry++;
        } else {
            const location = req.headers.get("Location"); // Address to use to upload the file
            if (location) {
                const req = await intelliFetch(location, {
                    method: "PUT",
                    headers: {
                        "Content-Type": data.type || "application/json",
                        Authorization: `Bearer ${obj.token}`,
                    },
                    body: data
                });
                if (req.ok) {
                    const json = await req.json();
                    await IndexedDatabase.set({ db: gDriveDb, request: "gdrive", object: { id: `${subfolder}____${fileId ?? name}`, data: { lastEditId: operationId, driveId: json.id } } });
                    deleteFromFailedUploads(`${subfolder}____${fileId ?? name}`);
                    isSecondLoopTry = 2;
                } else if (req.status === 404 && isSecondLoopTry === 0) {
                    isSecondLoopTry++;
                } else {
                    throw new Error();
                }
            } else throw new Error();
        }
    }
}

interface DeleteProps {
    subfolder: string,
    id: string,
    db: IDBDatabase
}

/**
 * Delete a file from the cloud storage
 */
async function deleteFromCloud({ subfolder, id, db }: DeleteProps) {
    const entry = await IndexedDatabase.get({ db, request: Settings.cloudStorage.onedrive.enabled ? "onedrive" : "gdrive", query: `${subfolder}____${id}` });
    if (!entry) throw new Error("Failed item deletion: the passed item hasn't been uploaded to the cloud storage");
    const req = await intelliFetch(`${Settings.cloudStorage.onedrive.enabled ? "https://graph.microsoft.com/v1.0/me/drive/items" : "https://www.googleapis.com/drive/v2/files"}/${(entry.data as GDriveIdContainer).driveId}`, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${obj.token}`
        }
    });
    if (req.ok) {
        await IndexedDatabase.remove({ db, request: Settings.cloudStorage.onedrive.enabled ? "onedrive" : "gdrive", query: `${subfolder}____${id}`, skipDrive: true });
        deleteFromFailedUploads(`${subfolder}____${id}`, true);
    } else throw new Error("Failed cloud storage deletion");
}

/**
 * Delete the files that have been deleted locally, but haven't been deleted from the cloud storage
 * @param databases the database container
 */
async function handleMissingCloudDelete(databases: DatabaseContainer) {
    for (const file of new Set(JSON.parse(localStorage.getItem(`MusicPlayer-FailedDelete}`) ?? "[]")) as Set<string>) {
        const [type, id] = [file.substring(0, file.indexOf("____")), file.substring(file.indexOf("____") + 4)];
        await deleteFromCloud({ subfolder: type, id, db: Settings.cloudStorage.onedrive.enabled ? databases.onedriveContainer : databases.googleDriveContainer });
    }
}

/**
 * Delete an entry from the "Files that should be deleted from the cloud storage" array or the "Files that should be uploaded to the cloud storage" array
 * @param name the entry that should be deleted
 * @param isFailedId if the deletion should be done from the "Failed file delete" array instead of the "Failed file uploads"
 */
function deleteFromFailedUploads(name: string, isFailedId?: boolean) {
    const failedIds = new Set(JSON.parse(localStorage.getItem(`MusicPlayer-Failed${isFailedId ? "Delete" : "Uploads"}`) ?? "[]")) as Set<string>;
    failedIds.delete(name);
    localStorage.setItem(`MusicPlayer-Failed${isFailedId ? "Delete" : "Uploads"}`, JSON.stringify(Array.from(failedIds)));
}

export default obj;