/**
 * List of all the HTMLElements that can be selected (so, tracks).
 */
const list = new Map();
/**
 * Add an HTMLElement to the list of the items that can be selected
 * @param node the HTMLElement to add
 * @param info a string that identifies the passed HTMLElement. It's usually the trackId.
 */
function addToList(node: Element, info?: string) {
        list.set(info ?? `Auto-${crypto.randomUUID()}`, node);
        return {
            destroy: () => {
                list.delete(node);
                // @ts-ignore
                node = undefined;
            }
        }
    }

export default {
    addToList,
    /**
     * Change the backgorund color of all the selected items.
     */
    clearAllSelected: () => {
        for (const [_, item] of list) (item as HTMLElement).style.backgroundColor = "";
    },
    list
}