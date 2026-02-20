let animation: Animation | undefined;
let animationShow = false;

const obj = {
    /**
     * Hide the pop-up player by moving it outside the DOM
     * @param element the pop-up player container
     * @param show if the pop-up player should be shown
     */
    disappearElement: (element: HTMLDivElement, show = false) => {
        return new Promise<void>(async (res) => {
            const {source, destination} = getSourceDestionation(element);
            animationShow = show;
            animation = element.animate(show ? [destination, source] : [source, destination], { duration: 200, easing: "ease-in-out" });
            animation.addEventListener("finish", () => res());
            element.style.transform = show ? source.transform : destination.transform;
        })
    },
    /**
     * Cancel the popup player animation
     */
    stopAnimation: () => {
        animation?.cancel();
    }
}

/**
 * Get the start and the end of the pop-up player animation
 * @param element the pop-up player
 * @returns animation start and end
 */
function getSourceDestionation(element: HTMLDivElement) {
    return {
        source: { transform: "translateY(0px)" },
        destination: { transform: `translateY(${window.innerHeight - element.getBoundingClientRect().bottom + 25}px)` }
    }
}

export default obj;