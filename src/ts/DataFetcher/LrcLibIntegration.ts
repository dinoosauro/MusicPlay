import ParseLrcFiles from "./ParseLrcFiles";
import type { MetadataSource } from "../Player/PlayerInterfaces";

interface LrcLibProps {
    /**
     * The metadata used to get the corresponding lyrics
     */
    metadata: MetadataSource,
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
export default async function LrcLibIntegration({metadata}: LrcLibProps) {
    const request = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(`${metadata.metadata.title} ${metadata.metadata.albumArtist === "Unknown" ? metadata.metadata.artist === "Unknown" ? "" : metadata.metadata.artist : metadata.metadata.albumArtist} ${metadata.metadata.album === "Unknown" ? "" : metadata.metadata.album}`.trim())}`);
    const res = await request.json() as LrcLibResponse[];
    if (res.length === 0) return [];
    const validResponse = res.find(i => (i.duration - 3) < metadata.metadata.duration && (i.duration + 3) > metadata.metadata.duration) ?? res[0]; // Let's look for the duration field to be sure the track is the correct one
    return validResponse.syncedLyrics ? ParseLrcFiles(validResponse.syncedLyrics) : validResponse.plainLyrics.trim();
}