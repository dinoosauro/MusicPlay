import { addHomePageContent } from "../DataFetcher/HomePageContent";
import type { RecentlyPlayed } from "../Player/PlayerInterfaces";

interface Props extends RecentlyPlayed {
    /**
     * Function that'll be called after an element has been added or removed from the homepage
     * @param success if the element has been added or not
     */
    callback?: (success: boolean) => void,
    /**
     * Function called to check if the element is being dragged. If true, no event will be fired.
     * @returns if the element is being dragged and dropped
     */
    checkIfIsBeingMoved?: () => boolean
}

export default function AddLongPressEventForHomepage(node: HTMLElement, info: Props) {
    let timeout: number | undefined;
    function startPress() {
        const startScroll = window.scrollY;
        timeout = setTimeout(() => {
            if (Math.abs(startScroll - window.scrollY) > 20 || (info.checkIfIsBeingMoved && info.checkIfIsBeingMoved())) return; // Check that the user isn't just moving the page (especially important on mobile devices)
            const result = addHomePageContent(info);
            alert(`${result ? "Added to" : "Removed from"} home page.`);
            info.callback && info.callback(result);
        }, 600)
    }
    function endPress() {
        clearTimeout(timeout);
    }
    for (const item of ["mousedown", "touchstart"]) node.addEventListener(item as "mousedown", startPress);
    for (const item of ["mouseup", "mouseleave", "touchend", "touchcancel"]) node.addEventListener(item as "mouseup", endPress);
    
}