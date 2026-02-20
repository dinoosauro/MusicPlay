import type { MetadataSource } from "../Player/PlayerInterfaces";
import type { playlistDB } from "./DatabaseInterfaces";

interface ImportPlaylistProps {
    /**
     * All the songs the application has fetched
     */
    songs: [string, MetadataSource[]][],
    /**
     * Read text of the M3U file
     */
    m3uText: string
}

/**
 * Read the M3U playlist file and get all the songs ID of the tracks in that file
 * @returns an array, with the songDB ID of all the matched tracks
 */
export default function ReadM3UPlaylist({songs, m3uText}: ImportPlaylistProps) {
    let songArr = songs.flatMap(i => i[1]);
    let outputSongsId: string[] = [];
    for (const str of m3uText.split("\n").map(i => i.trim())) {
        if (str.startsWith("#")) continue;
        const path = str.substring(Math.max(str.lastIndexOf("/"), str.lastIndexOf("\\")) + 1);
        let songId = songArr.find(i => i.metadata.name === path)?.trackId;
        if (songId) outputSongsId.push(songId);
    }
    return outputSongsId;
}