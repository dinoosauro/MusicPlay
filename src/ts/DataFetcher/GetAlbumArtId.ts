/**
 * Get the ID used to store the album art in the Album Art database
 * @returns the ID
 */
export default function GetAlbumArtId({albumAuthor, year, albumName}: AlbumArtIdProps) {
    return `${albumAuthor}-${year}-${albumName}`;
}

interface AlbumArtIdProps {
    albumAuthor: string,
    year: number | undefined,
    albumName: string,
}