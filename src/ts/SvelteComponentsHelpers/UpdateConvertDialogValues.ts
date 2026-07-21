export default {
    /**
     * A list of the functions used to update the top dialogs that informs the user about the current conversion of a file
     */
    eventsToUpdate: [] as ((paragraphText?: string, progressValue?: number) => void)[]
}