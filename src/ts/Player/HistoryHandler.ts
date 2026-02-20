import type { MetadataSource } from "./PlayerInterfaces";

const obj = {
    /**
     * Function called to go back to the previous page of the application.
     */
    goBack: () => {
        obj.prevState = history.state;
        history.back();
    },
    /**
     * The State of the page that was previously opened by the application
     */
    prevState: "",
    /**
     * The Image Album Art ID that was used from the previous part by the application (if used)
     */
    prevImageId: "",
    /**
     * Information about the context that caused the webpage to go back
     */
    backContext: {
        /**
         * If true, the last item of an audio category (ex: album, artist) has been either deleted or moved
         */
        delete: undefined as boolean | undefined,
        /**
         * Function that can be called to remove a playlist. This is usually later called from the `popstate` event handler if the `delete` property is set to true.
         */
        deletePlaylist: undefined as ((id: string) => void) | undefined
    },
    /**
     * Function to close the currently open dialog
     */
    closeCommand: undefined as (() => void) | undefined
}
export default obj;