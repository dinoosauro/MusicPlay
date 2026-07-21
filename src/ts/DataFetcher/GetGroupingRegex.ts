import Settings from "../Settings";

/**
 * Get the Regex that should be used to split multiple artists
 */
export default function GetGroupingRegex(isAlbumAuthor?: boolean) {
    if (Settings.grouping[`divide${isAlbumAuthor ? "Album" : ""}AuthorsBy` as "divideAlbumAuthorsBy"].length === 0) return new RegExp(/^(?!)/)
    return new RegExp(Settings.grouping[`divide${isAlbumAuthor ? "Album" : ""}AuthorsBy` as "divideAlbumAuthorsBy"].map(i => {
        for (const symbol of i.matchAll(/[^A-Za-z0-9]/g)) i.replaceAll(symbol[0], `\\${symbol[0]}`);
        return i;
    }).join("|"));
}