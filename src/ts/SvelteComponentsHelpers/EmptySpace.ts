/**
 * The div that contains the floating player
 */
let floatingPlayerDiv: HTMLDivElement | undefined;

/**
 * All the divs that have been addeed to "counter" the space occupied by the floatingPlayerDiv, that woulddn't permit othewise to click the elements at the bottom of the page.
 */
let divsToUpdate: HTMLElement[] = [];

/**
 * The resize observer that'll resize all the empty divs so that they have the same height of the floating player
 */
const resizeObserver = new ResizeObserver(() => {
    for (const item of divsToUpdate) item.style.height = `${(floatingPlayerDiv?.getBoundingClientRect().height ?? -75) + 75}px`;
})

/**
 * Mark the passed div as:
 * - empty;
 * - added solely so that it has the same size as the floating player div
 * @param div the div element
 */
export function registerEmptySpace(div: HTMLElement) {
    divsToUpdate.push(div);
    div.style.height = `${(floatingPlayerDiv?.getBoundingClientRect().height ?? -75) + 75}px`;
    return {
        destroy() {
            const index = divsToUpdate.indexOf(div);
            if (index !== -1) divsToUpdate.splice(index, 1);
        }
    }
}
/**
 * Update the Element used for the floating player
 * @param div the container of the floating player
 * @param skip if the current container shouldn't be treated as a floating player (ex: if the pop-up component is called from the Picture-in-Picture mode)
 */
export function registerFloatingPlayerDiv(div: HTMLDivElement, skip?: boolean) {
    if (skip) return;
    floatingPlayerDiv = div;
    resizeObserver.disconnect();
    resizeObserver.observe(div);
    return {
        destroy() {
            if (div === floatingPlayerDiv) floatingPlayerDiv = undefined;
        }
    }
}
