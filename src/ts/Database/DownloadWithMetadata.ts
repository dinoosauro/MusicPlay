import GetAlbumArtId from "../DataFetcher/GetAlbumArtId";
import GetAudioFile from "../DataFetcher/GetAudioFile";
import type { MetadataSource } from "../Player/PlayerInterfaces";
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
    
}
/**
 * Download the selected songs by adding the edited metadata.
 */
export default async function DownloadWithMetadata({databases, songs}: Props) {
    if (!UpdateMetadataOnOutputFile.isiFrameReady) { // We need to load the iFrame, and wait for the ready message
        await new Promise<void>(res => {
            function waitForReadyMsg(e: MessageEvent) {
                if (e.origin === new URL(UpdateMetadataOnOutputFile.iFrame.src).origin) {
                    if (e.data.ready) {
                        window.removeEventListener("message", waitForReadyMsg);
                        UpdateMetadataOnOutputFile.isiFrameReady = true;
                        localStorage.setItem("MusicPlayer-CachedWebAssembly", "a")
                        res();
                    }
                }
            }
            window.addEventListener("message", waitForReadyMsg);
            document.body.append(UpdateMetadataOnOutputFile.iFrame);
            UpdateMetadataOnOutputFile.iFrame.src = UpdateMetadataOnOutputFile.iFrameSrc
        })
    }
    /**
     * The object that'll be sent to the Blazor WebAssembly webpage.
     */
    const outputObj = {
        type: "changeMetadata",
        buffer: [] as Uint8Array[],
        metadata: [] as metadataDB[],
        albumArt: [] as (Uint8Array | false)[]
    };
    for (const song of songs) {
        const audio = await GetAudioFile({songDb: databases.songDb, songId: song.trackId, metadataDb: databases.metadataDb});
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
        if (metadata.syncedLyrics.length !== 0 && metadata.embeddedLyrics.trim() === "") metadata.embeddedLyrics = metadata.syncedLyrics.map(i => i.text).join("\n"); // Add at least the embedded lyrics in case the application has fetched synced lyrics
        outputObj.buffer.push(new Uint8Array(await audio.arrayBuffer()));
        outputObj.metadata.push(metadata);
        outputObj.albumArt.push(albumArt ? new Uint8Array(await(albumArt.data as albumArtDB).img.arrayBuffer()) : false)
    }
    UpdateMetadataOnOutputFile.iFrame.contentWindow?.postMessage(outputObj, new URL(UpdateMetadataOnOutputFile.iFrame.src).origin);

}