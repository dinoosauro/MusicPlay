import type { albumArtDB } from "../Database/DatabaseInterfaces";
import IndexedDatabase from "../Database/IndexedDatabase"
import Settings from "../Settings";

interface ArtistImageProps {
    author: string,
    artistImageDb: IDBDatabase,
    isPlaylist?: boolean,
    /**
     * The query to do to get the artist image. If not passed, the same value as the `artist` property is used
     */
    customQuery?: string
}

interface CreateSvgProps {
    str: string,
    textSize?: string,
    textFont?: string,
    backgroundColor: string,
    textColor?: string
}


const obj = {
    /**
     * Create a SVG image with the text passed
     * @returns the SVG element
     */
    createSvg: ({ str, textSize, backgroundColor, textColor, textFont }: CreateSvgProps) => {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        for (const prop of [["width", "400"], ["height", "400"], ["viewBox", "0 0 400 400"], ["xmlns", "http://www.w3.org/2000/svg"]]) svg.setAttribute(prop[0], prop[1]);
        const background = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        for (const prop of [["width", "400"], ["height", "400"], ["fill", backgroundColor]]) background.setAttribute(prop[0], prop[1]);
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        for (const prop of [["x", "50%"], ["y", "50%"], ["dominant-baseline", "middle"], ["text-anchor", "middle"], ["fill", textColor ?? "white"], ["font-size", textSize ?? "200"], ["font-family", textFont ?? "Arial, sans-serif"], ["alignment-baseline", "central"]]) text.setAttribute(prop[0], prop[1]);
        text.textContent = str;
        // Append elements to SVG
        svg.appendChild(background);
        svg.appendChild(text);
        return svg;
    },
    /**
     * Get the artist image from the passed database. If not available, a custom image is returned.
     * @returns the Blob with the artist image
     */
    fetchImage: async ({ author, artistImageDb, isPlaylist, customQuery }: ArtistImageProps) => {
        const possibleImage = artistImageDb ? await IndexedDatabase.get({
            db: artistImageDb,
            request: isPlaylist ? "playlistImg" : "artistImg",
            query: customQuery ?? author
        }) : undefined;
        if (possibleImage) return (possibleImage.data as albumArtDB).img;
        const svg = obj.createSvg({
            str: author.split(" ").map(i => i[0]).slice(0, 2).join(""), // Keep the first two letters of the words
            backgroundColor: Settings.customArtColors[Math.floor(Math.random() * Settings.customArtColors.length)]
        })
        return new Blob([svg.outerHTML], { type: "image/svg+xml" });
    },
}

export default obj;