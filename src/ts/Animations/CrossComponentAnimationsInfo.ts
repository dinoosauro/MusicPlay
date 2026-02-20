/**
 * Object used to handle going backwards/forwards the fullscreen mode
 */
export let fullscreenObject = {
    /**
     * Function called to open the fullscreen window
     */
    goToFullscreen: undefined as (() => void)| undefined,
    /**
     * Elements used for the fullscreen transition
     */
    fullscreenContent: {
        /**
         * Main fullscreen container
         */
        container: undefined as HTMLElement | undefined,
        /**
         * Fulscreen album art
         */
        image: undefined as HTMLImageElement | undefined
    },
    /**
     * Function tied to the lyrics part of the fullscreen mode
     */
    lyrics: {
        /**
         * This functon permits to open and close either the queue or the lyrics (the "right section", since they're displayed at the right of the metadata if there's enough space)
         * @param openRightDiv if the right div should be opened or not
         * @param openQueue if the queue should be opened instead of the lyrics. If not passed, lyrics will be opened.
         * @param addHistoryUrl if the script should add the "#lyrics" or the "#queue" url to the history session
         */
        openRightSectionOfFullscreen: undefined as ((openRightSection: boolean, openQueue?: boolean, addHistoryUrl?: boolean) => void) | undefined,
    }
}

/**
 * Object used to handle the transition from the main app and to the Album/Artist data viewer
 */
export let mediaPlayerObject = {
    container: undefined as HTMLElement | undefined,
    backButtonContainer: undefined as HTMLElement | undefined,
    image: undefined as HTMLImageElement | undefined,
    /**
     * This function permits to sort the elements in the playlist displayed by the Album Viewer.
     * @param id the criteria used to sort the playlist (ex: `sortAlbum`)
     * @param skipSave if true, the changes won't be saved in the IndexedDatabase. This value is used only when initializing the playlist, and should not be used elsewhere.
     */
    sortPlaylist: undefined as ((id: string, skipSave?: boolean) => void) | undefined
}