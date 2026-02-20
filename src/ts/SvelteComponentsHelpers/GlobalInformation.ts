/**
 * A Map that contains as a string an identifier (usually, in the form of `AArt-${id}`, `PlaylistImg-${id}` or `ArtistImg-${id}`), and as a value the image in the Artist/Album list viewer (the ones that show all the artist/album) that they're tied to.
 * 
 * This permits to handle animations between the Metadata Viewer and these sections of the application
 */
export const imageMap = new Map<string, HTMLImageElement>();

/**
 * Add an element to the `imageMap` object, so that animations between application sections can be done. To learn more, see the `imageMap` object description.
 * @param image the image element to add
 * @param id its ID
 */
export function addImageToMap(image: HTMLImageElement, id: string) {
    imageMap.set(id, image);
    return {
        update(id: string) {
            imageMap.set(id, image);
        },
        destroy() {
            imageMap.delete(id);
        }
    }
}

/**
 * Callbacks from the Settings dialog to other parts of the application
 */
export let settingsUpdate = {
    updateFloatingPlayerMiniValue: undefined as (() => void) | undefined
}