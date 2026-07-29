import type { MetadataSource, MetadataSourcePlaylist, PlaylistContainer } from "../Player/PlayerInterfaces";

/**
 * Get the metadata of all the songs in a single playlist
 * @param list the list to read
 * @param metadata the metadata object where the tracks metadata can be fetched
 */
export default function getMetadataOfPlaylist(list: PlaylistContainer, metadata: [string, MetadataSource[]][]) {
    const result: MetadataSourcePlaylist[] = [];
    const flatMetadata = metadata?.flatMap(i => i[1]);
    if (!flatMetadata) return;
    for (const item of list.data.contents) {
        const file = flatMetadata.find(i => i.trackId === item);
        if (file) result.push({
            ...file,
            playlistId: crypto.randomUUID() // Let's add a random playlist ID so that the album viewer can uniquely identify the songs, even if they have the same track ID
        });
    }
    return result;
}  