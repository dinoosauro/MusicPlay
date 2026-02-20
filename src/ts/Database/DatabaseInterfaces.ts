export interface contentDataDB {
    file: File | FileSystemFileHandle,
    name: string,
    directoryId?: string
}

export interface albumArtDB {
    img: Blob
}

export interface folderHandleDB {
    handle: FileSystemDirectoryHandle
}

export interface playlistDB {
    name: string,
    /**
     * IDs of all the tracks added to the playlist
     */
    contents: string[],
    isPinned?: number,
    orderType?: "album" | "artist" | "albumArtist" | "title",
    reversed?: boolean
}

export interface songsStatsDB {
    totalMs: number,
    totalPlay: number,
    activity: {
        date: number,
        duration: number
    }[]
}

export interface syncedLyricsObj {
    text: string,
    words: syncedLyricsObj[],
    start: number,
    artistNumber?: number,
    end?: number
}

export interface metadataDB {
    artist: string,
    albumSort?: string,
    artistSort?: string
    albumArtist: string,
    albumArtistSort?: string
    duration: number,
    track: number | null,
    totalTracks: number | null,
    disk: number | null,
    diskCount: number | null,
    album: string,
    genre: string,
    year: number | undefined,
    title: string,
    embeddedLyrics: string,
    syncedLyrics: syncedLyricsObj[],
    titleSort?: string,
    composer: string | undefined,
    composerSort: string | undefined,
    name: string,
    directoryId?: string,
    hasBothDirectoryIdAndFileHandle?: boolean
}

export interface DatabaseContainer {
    songDb: IDBDatabase
    albumArtDb: IDBDatabase
    metadataDb: IDBDatabase,
    artistImgDb: IDBDatabase,
    directoryHandleDb: IDBDatabase,
    playlistDb: IDBDatabase,
    playlistImgDb: IDBDatabase,
    songStatsDb: IDBDatabase
}
