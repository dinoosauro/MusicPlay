const obj = {
    /**
     * If true, the user can select some tracks by clicking on them.
     */
    isSelectModeEnabled: false,
    /**
     * A list of all the selected trackIds.
     */
    selectedItems: new Set<string>(),
    /**
     * If true, all the songs between the previous click and the next one should be deleted
     */
    isRangeSelectModeEnabled: false,
    /**
     * Information used while the user is in the "Tracks" view
     */
    multipleTrackSelectionInformation: {
        /**
         * The previously-clicked track ID in the "Tracks" view.
         */
        trackId: undefined as string | undefined
    },
    /**
     * If true, the items in the range select mode will be deselected instead of selected.
     */
    deselectItems: false
}

export default obj;