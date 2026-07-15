import ParseLrcFiles from "./ParseLrcFiles";
import type { MetadataSource } from "../Player/PlayerInterfaces";
import { mount, unmount } from "svelte";
import FetchingLrc from "../../lib/Dialogs/FetchingLrc.svelte";
import Settings from "../Settings";

interface LrcLibProps {
    /**
     * The metadata used to get the corresponding lyrics
     */
    metadata: MetadataSource,
    /**
     * If true, the "Fetching from LRCLib" alert will be shown in the Picture-in-Picture window instead of the main one
     */
    isFromPiP?: boolean
}

interface LrcLibResponse {
    id: string,
    trackName: string,
    artistName: string,
    albumName: string,
    duration: number,
    instrumental: boolean,
    plainLyrics: string,
    syncedLyrics: string
}

/**
 * Get the lyrics of the passed track from LRCLib
 * @returns an array with the synced lyrics, or a string if no synced lyrics are available. If a match couldn't be found, an empty array will be returned.
 */
export default async function LrcLibIntegration({metadata, isFromPiP}: LrcLibProps) {
    // Create a dialog that tells the user we're fetching a resource from LRCLib
    const div = document.createElement("div");
    const component = mount(FetchingLrc, {
        target: div,
        props: {name: metadata.metadata.title}
    });
    if (Settings.lyrics.informOfLrcLibUsage) (isFromPiP ? window.documentPictureInPicture?.window?.document.body : document.body)?.append(div);
    function closeDialog() {
        (div.firstChild as HTMLElement).style.opacity = "0";
        setTimeout(() => {
            unmount(component),
            div.remove();
        }, 220);
    }
    try {
        const request = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(`${metadata.metadata.title} ${metadata.metadata.albumArtist === "Unknown" ? metadata.metadata.artist === "Unknown" ? "" : metadata.metadata.artist : metadata.metadata.albumArtist} ${metadata.metadata.album === "Unknown" ? "" : metadata.metadata.album}`.trim())}`);
        const res = await request.json() as LrcLibResponse[];
        if (res.length === 0) {
            closeDialog();
            return [];
        }
        const validResponse = res.find(i => (i.duration - 3) < metadata.metadata.duration && (i.duration + 3) > metadata.metadata.duration) ?? res[0]; // Let's look for the duration field to be sure the track is the correct one
        closeDialog()
        return validResponse.syncedLyrics ? ParseLrcFiles(validResponse.syncedLyrics) : validResponse.plainLyrics.trim();
    } catch(ex) {
        console.warn(ex);
        closeDialog();
        return [];
    }
}