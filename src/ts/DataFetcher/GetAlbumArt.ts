import ArtistImageManager from "./ArtistImageManager";
import type { albumArtDB } from "../Database/DatabaseInterfaces";
import IconsSource from "../Icons/IconsSource";
import IndexedDatabase from "../Database/IndexedDatabase";
import Settings from "../Settings";

/**
 * A Map that stores all the colors used to create a custom album art text, to avoid changing colors to the same album during the application's running cycle.
 */
const albumArtTextColor = new Map<string, string>([]);

/**
 * Get the album art of the passed album
 * @returns the Blob with the album art
 */
export default async function GetAlbumArt({db, id, name}: {db: IDBDatabase, id: string, name?: string}) {
    const albumReq = await IndexedDatabase.get({
        db,
        request: "albumArt",
        query: id,
    });
    if (albumReq?.data) return (albumReq.data as albumArtDB).img; 
    if (typeof name !== "undefined") { // Let's create an album art with the first two letters of the album name
        const backgroundColor = albumArtTextColor.get(name) ?? Settings.customArtColors[Math.floor(Math.random() * Settings.customArtColors.length)];
        albumArtTextColor.set(name, backgroundColor);
        const svgCreation = ArtistImageManager.createSvg({
            str: name.split(" ").map(i => i[0]).slice(0, 2).join(""),
            backgroundColor
        });
        return new Blob([svgCreation.outerHTML], {type: "image/svg+xml"});
    }
    return new Blob([IconsSource.cd.replace("#212121", getComputedStyle(document.body).getPropertyValue("--text"))], {type: "image/svg+xml"});
}