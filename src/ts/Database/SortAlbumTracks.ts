import type { MetadataSource } from "../Player/PlayerInterfaces";

/**
 * Sort the tracks inside an album
 */
export default function SortAlbumTracks(a: MetadataSource, b: MetadataSource) {
    const diskDiff = (a.metadata.disk ?? 0) - (b.metadata.disk ?? 0)
    if (diskDiff !== 0) return diskDiff;
    return (a.metadata.track ?? -Infinity) - (b.metadata.track ?? -Infinity);
}