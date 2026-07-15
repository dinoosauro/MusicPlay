interface TriggerTransitionProps {
    /**
     * A list of all the elements where the transition should be applied to
     */
    albumArts: HTMLImageElement[],
    /**
     * The new source of the image, that'll replace the one already set in the image
     */
    newSource: string,
    /**
     * If true, the image used for the crossfade will be appended to `document.body` instead of being appended in the same Node of the image
     */
    appendToBody?: boolean,
    /**
     * Custom z-index for the temp image
     */
    zIndex?: number,
    /**
     * If both this and `appendToBody` are true, the transition image will be appended to the body of the Picture-in-Picture window instead of the main one.
     */
    usePiPAsOutputWindow?: boolean,
}


const obj = {
    /**
     * Run the transition
     */
    triggerTransition: async ({albumArts, newSource, appendToBody, zIndex, usePiPAsOutputWindow}: TriggerTransitionProps) => {
        /**
         * An array of all the promises, that'll be resolved after the first transition has been done
         */
        const promiseStore: (Promise<void>)[] = [];
        /**
         * List of all the image elements that needs to be removed after the transition has been done
         */
        let imagesToRemove: HTMLImageElement[] = [];
        /**
         * List of all the intervals that should be cleaned after the transition has ended
         */
        let intervalList: number[] = [];
        for (const element of albumArts) {
            element.setAttribute("data-nextsrc", newSource); // So that, if the user goes backwards from Fullscreen mode, the image source will be the one of the new media file.
            const img = element.cloneNode() as HTMLImageElement;
            img.style.zIndex = zIndex?.toString() ?? "11";
            img.style.position = "fixed";
            img.style.opacity = "0";
            imagesToRemove.push(img);
            /**
             * Update the fixed position of the new image
             */
            function updatePosition() {
                const originalRect = element.getBoundingClientRect();
                for (const type of ["top", "left"]) img.style[type as "left"] = `${originalRect[type as "left"]}px`;
            }
            (appendToBody ? (usePiPAsOutputWindow ? window.documentPictureInPicture?.window?.document.body : document.body) : element.parentElement)?.append(img);
            img.src = newSource;
            img.style.pointerEvents = "none";
            await new Promise<void>(res => img.onload = () => res());
            await new Promise(res => setTimeout(res, 1));
            promiseStore.push(new Promise<void>((res) => {
                img.animate([{opacity: "0"}, {opacity: "1"}], {duration: 800, easing: "ease-in-out"}).addEventListener("finish", () => res());
            }));
            promiseStore.push(new Promise<void>((res) => {
                element.animate([{opacity: "1"}, {opacity: "0"}], {duration: 800, easing: "ease-in-out"}).addEventListener("finish", () => res());
            }));
            intervalList.push(setInterval(() => { // So that, if the user resizes the window, the image will be moved
                updatePosition();
            }, 10))
            element.style.opacity = "0";
            img.style.opacity = "1";
        }
        await Promise.all(promiseStore);
        for (const interval of intervalList) clearInterval(interval);
        await Promise.all(albumArts.map((element, i) => new Promise<void>(res => { // Now, let's change the original image source. When the image has been loaded, resolve the promise
            function loadItem() {
                element.style.opacity = "1";
                imagesToRemove[i].classList.remove("imgBoxShadow");
                setTimeout(() => {
                    imagesToRemove[i].remove();
                    element.removeEventListener("load", loadItem);
                    res();
                }, 15)
            }
            element.addEventListener("load", loadItem);
            element.src = newSource;
        })))
    },
}
export default obj;