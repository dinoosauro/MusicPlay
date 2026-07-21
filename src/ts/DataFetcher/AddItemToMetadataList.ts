import type { FilterType, MetadataSource, PossibleSortingOptions } from "../Player/PlayerInterfaces";

interface AddItemProps {
    /**
     * All the metadata that have been added to the database
     */
    allMetadataLoaded: [string, MetadataSource[]][],
    /**
     * The sorting type of the `allMetadataLoaded` property
     */
    contentType: PossibleSortingOptions,
    /**
     * If the `allMetadataLoaded` object is reversed
     */
    isReversed?: boolean,
    /**
     * The item that should be added in the list
     */
    itemToAdd: MetadataSource | string,
    /**
     * If passed, the key (so the first item in the `allMetadataLoaded` array) will be used to get the value to localeCompare
     */
    useKeyInMetadataLoaded?: boolean
}

/**
 * Get the position in the `allMetadataLoaded` array where to append the new element
 * @returns the number
 */
export default function GetNewItemInMetadataListPosition({allMetadataLoaded, contentType, isReversed, itemToAdd, useKeyInMetadataLoaded}: AddItemProps) {
    if (typeof isReversed === "undefined") { // Compare the first and the second property to get if the list is reversed
        if (allMetadataLoaded.length > 1) {
            let [firstMetadataToCompare, secondMetadataToCompare] = contentType === "album" ? [allMetadataLoaded[0][1][0].metadata.album, allMetadataLoaded[1][1][0].metadata.album] : [allMetadataLoaded[0][0], allMetadataLoaded[1][0]]
            isReversed = firstMetadataToCompare.localeCompare(secondMetadataToCompare) === 1;
        }
    }
    let i = 0;
    mainLoop: while (i < allMetadataLoaded.length) {
        if (allMetadataLoaded[i][1].length !== 0) {
            switch (contentType) {
                case "none":
                    if (allMetadataLoaded[i][1][0].metadata.title.localeCompare(typeof itemToAdd === "string" ? itemToAdd : itemToAdd.metadata.title) === (isReversed ? -1 : 1)) break mainLoop;
                    break;
                case "authors":
                    if ((useKeyInMetadataLoaded ? allMetadataLoaded[i][0] : allMetadataLoaded[i][1][0].metadata.artistSort ?? allMetadataLoaded[i][1][0].metadata.artist).localeCompare(typeof itemToAdd === "string" ? itemToAdd : itemToAdd.metadata.artistSort ?? itemToAdd.metadata.artist) === (isReversed ? -1 : 1)) break mainLoop;
                    break;
                case "albumauthors":
                    if ((useKeyInMetadataLoaded ? allMetadataLoaded[i][0] : allMetadataLoaded[i][1][0].metadata.albumArtistSort ?? allMetadataLoaded[i][1][0].metadata.albumArtist).localeCompare(typeof itemToAdd === "string" ? itemToAdd : itemToAdd.metadata.albumArtistSort ?? itemToAdd.metadata.albumArtist) === (isReversed ? -1 : 1)) break mainLoop;
                    break;
                default:
                    if ((allMetadataLoaded[i][1][0].metadata.albumSort ?? allMetadataLoaded[i][1][0].metadata.album).localeCompare(typeof itemToAdd === "string" ? itemToAdd : itemToAdd.metadata.albumSort ?? itemToAdd.metadata.album) === (isReversed ? -1 : 1)) break mainLoop;
                    break;
            }
        }
        i++;
    }
    return i;
}