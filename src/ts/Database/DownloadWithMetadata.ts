import GetAlbumArtId from "../DataFetcher/GetAlbumArtId";
import GetAudioFile from "../DataFetcher/GetAudioFile";
import type { MetadataSource } from "../Player/PlayerInterfaces";
import Settings from "../Settings";
import type { albumArtDB, DatabaseContainer, metadataDB } from "./DatabaseInterfaces";
import IndexedDatabase from "./IndexedDatabase";
import UpdateMetadataOnOutputFile from "./UpdateMetadataOnOutputFile";

interface Props {
    /**
     * The container of all the databases used by the application
     */
    databases: DatabaseContainer,
    /**
     * All the songs to download
     */
    songs: MetadataSource[],
    /**
     * The ID of the current operation. If it's not passed, the songs will be downloaded from the Blazor WebAssembly application. If passed, the songs will be sent back to the Svelte component as an Uint8Array
     */
    sendBytesBack?: string,
    /**
     * If passed, an array that follows the same order as the `songs` one, that contains the Uint8Array of the track to which metadata should be added and the extension of the file
     */
    songsArr?: {
        bytes: Uint8Array<ArrayBufferLike>,
        extension: string
    }[]

}
/**
 * Download the selected songs by adding the edited metadata.
 */
export default async function DownloadWithMetadata({ databases, songs, sendBytesBack, songsArr }: Props) {
    return new Promise<Uint8Array<ArrayBuffer> | void>(async (res) => {
        if (!UpdateMetadataOnOutputFile.isiFrameReady) { // We need to load the iFrame, and wait for the ready message
            await new Promise<void>(res => {
                function waitForReadyMsg(e: MessageEvent) {
                    if (e.origin === new URL(UpdateMetadataOnOutputFile.iFrame.src).origin) {
                        if (e.data.ready) {
                            UpdateMetadataOnOutputFile.isiFrameReady = true;
                            localStorage.setItem("MusicPlayer-CachedWebAssembly", "a");
                            window.removeEventListener("message", waitForReadyMsg);
                            res();
                        } 
                    }
                }
                window.addEventListener("message", waitForReadyMsg);
                document.body.append(UpdateMetadataOnOutputFile.iFrame);
                UpdateMetadataOnOutputFile.iFrame.src = UpdateMetadataOnOutputFile.iFrameSrc
            })
        }
        if (sendBytesBack) {
            function checkCurrentBytesBack(e: MessageEvent) { // Wait the Uint8Array from the Blazor WebAssembly component
                if (e.origin === new URL(UpdateMetadataOnOutputFile.iFrame.src).origin) {
                    if (e.data.sendBytesBack === sendBytesBack) {
                        window.removeEventListener("message", checkCurrentBytesBack);
                        res(e.data.bytes);
                    }
                }
            }
            window.addEventListener("message", checkCurrentBytesBack);
        }
        /**
         * The object that'll be sent to the Blazor WebAssembly webpage.
         */
        const outputObj = {
            type: "changeMetadata",
            buffer: [] as Uint8Array[],
            metadata: [] as metadataDB[],
            albumArt: [] as (Uint8Array | false)[],
            sendBytesBack,
            clearMetadata: Settings.metadataConversion.clearMetadata,
            lyricsLanguage: Settings.metadataConversion.language
        };
        for (let i = 0; i < songs.length; i++) {
            const song = songs[i];
            const audio = songsArr ? songsArr[i].bytes : await GetAudioFile({ songDb: databases.songDb, songId: song.trackId, metadataDb: databases.metadataDb });
            const albumArt = await IndexedDatabase.get({ // We'll load the album art directly from the database, without using the normal `GetAlbumArt` function, so that we'll avoid adding the fallback album art to the output file
                db: databases.albumArtDb,
                request: "albumArt",
                query: GetAlbumArtId({
                    albumAuthor: song.metadata.albumArtist,
                    year: song.metadata.year,
                    albumName: song.metadata.album
                })
            });
            const metadata = JSON.parse(JSON.stringify(song.metadata)) as metadataDB;
            if (metadata.syncedLyrics.length !== 0 && (metadata.embeddedLyrics.trim() === "" || Settings.metadataConversion.addTimestampToEmbeddedLyrics)) metadata.embeddedLyrics = metadata.syncedLyrics.map(i => `${Settings.metadataConversion.addTimestampToEmbeddedLyrics ? `[${convertToLrcTimestamp(i.start)}]` : ""}${i.words.length !== 0 && Settings.metadataConversion.addTimestampToEmbeddedLyrics ? i.words.map(i => `<${convertToLrcTimestamp(i.start)}>${i.text}`).join(" ") : i.text}`).join("\n"); // Add at least the embedded lyrics in case the application has fetched synced lyrics
            if (songsArr) metadata.name = `${metadata.name.substring(0, metadata.name.lastIndexOf("."))}.${songsArr[i].extension}`;
            outputObj.buffer.push(audio instanceof Uint8Array ? audio : new Uint8Array(await audio.arrayBuffer()));
            outputObj.metadata.push(metadata);
            outputObj.albumArt.push(albumArt ? new Uint8Array(await(albumArt.data as albumArtDB).img.arrayBuffer()) : false)
        }
        UpdateMetadataOnOutputFile.iFrame.contentWindow?.postMessage(outputObj, new URL(UpdateMetadataOnOutputFile.iFrame.src).origin);
        !sendBytesBack && res(); // We don't need to wait for a response from the Blazor WebAssembly frame
    })
}

/**
 * Convert a time in milliseconds to the LRC standard
 * @param ms the milliseconds to convert
 * @returns the `MM:ss.cc` string
 */
function convertToLrcTimestamp(ms: number) {
    const minutes = Math.floor(ms / 60_000);
    ms -= minutes * 60_000;
    const seconds = Math.floor(ms / 1000);
    ms -= seconds * 1000;
    return `${checkStr(minutes)}:${checkStr(seconds)}.${checkStr(Math.floor(ms / 10))}`
}

/**
 * Add a `0` before the string if the source number is one-digit
 */
function checkStr(num: number) {
    if (num > 9) return num.toString();
    return `0${num}`;
}