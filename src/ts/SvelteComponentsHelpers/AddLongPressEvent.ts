/**
 * Run an event after the user has pressed an element for more than 500ms
 * @param element the element where the long press event should be added
 * @param callback the event that should be triggered
 */
export default function AddLongPressEvent(element: HTMLElement, callback: () => void) {
    let timeout: number | undefined;
    for (const str of ["mousedown", "touchstart"]) element.addEventListener(str, () => {
        timeout = setTimeout(() => {
            timeout = undefined; 
            callback();
        }, 500)
    });
    for (const str of ["touchend", "mouseup"]) element.addEventListener(str, () => {
        clearTimeout(timeout);
        timeout = undefined;
    })
}