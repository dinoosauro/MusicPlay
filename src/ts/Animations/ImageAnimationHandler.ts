import type { OpacityChange } from "./AnimationTypes";

interface AnimationProps {
    /**
     * The elment where the image will start
     */
    sourceImage: HTMLImageElement,
    /**
     * The element where the image will end
     */
    outputImage: HTMLImageElement,
    /**
     * A list of elements whose opacity should be changed
     */
    elements: OpacityChange[],
    /**
     * Avoid removing the `overflow: hidden` property after the transition has been done
     */
    keepBodyOverflowHidden?: boolean,
    /**
     * The z-index of the output image
     */
    imgZIndex?: string
}

interface CurrentAnimationData {
    sourceImage: HTMLImageElement,
    tempImage: HTMLImageElement,
    animation: Animation,
    opacityChange: OpacityChange[]
}

/**
 * The animation that is currently running
 */
let currentAnimation: CurrentAnimationData | null = null;

const obj = {
    /**
     * Start the image animation
     */
    imageAnimationHandler({ sourceImage, outputImage, elements, keepBodyOverflowHidden, imgZIndex }: AnimationProps) {
        return new Promise<void>((res) => {
            const sourcePosition = sourceImage.getBoundingClientRect();
            const destionationPosition = outputImage.getBoundingClientRect();
            for (const item of elements) { // Let's change the opacity of the elements whose opacity should be changed before the animation
                if (item.opacityChange === "start") item.element.style.opacity = item.output ?? "1";
            }
            document.body.style.overflow = "hidden";
            // Create a temp image that'll be moved from the source image to the destinatino one
            const img = Object.assign(document.createElement("img"), {
                src: sourceImage.getAttribute("data-nextsrc") || sourceImage.src,
            });
            for (const prop of ["left", "width", "height"]) img.style[prop as "left"] = `${sourcePosition[prop as "left"]}px`;
            img.style.top = `${window.innerHeight < sourcePosition.top ? window.innerHeight + 25 : sourcePosition.top + window.scrollY}px`;
            img.style.position = "absolute";
            img.style.borderRadius = "12px";
            img.style.transformOrigin = "left top";
            img.style.zIndex = imgZIndex ?? "4";
            document.body.append(img);
            const newScale = destionationPosition.width / sourcePosition.width;
            sourceImage.style.opacity = "0";
            setTimeout(() => {
                /**
                 * A really important note for the me of the future. 
                 * Transforms are applied from the right to the left. Therefore, in this case:
                 * - We first scale the item, so that it becomes smaller,
                 * - And then we move it using translate. We don't need to scale the translate properties since we put the transform-origin to top-left, so the left and the top position of the scaled item is the same as the source one.
                 */
                const outputScale = `translateX(${(destionationPosition.left - sourcePosition.left)}px) translateY(${((destionationPosition.top - (window.innerHeight < sourcePosition.top ? window.innerHeight + 25 : sourcePosition.top)))}px) scale(${newScale})`;
                const outputBorderRadius = 12 * sourcePosition.width / destionationPosition.width;
                const animation = img.animate(
                    [
                        { transform: "scale(1) translateX(0px) translateY(0px)", borderRadius: "12px" },
                        { transform: outputScale, borderRadius: `${outputBorderRadius}px` },
                    ],
                    { duration: 350, iterations: 1, easing: "ease-in-out" }
                );
                currentAnimation = {
                    sourceImage,
                    tempImage: img,
                    animation,
                    opacityChange: elements
                }
                animation.addEventListener("finish", (e) => {
                    setTimeout(() => {
                        currentAnimation = null;
                        for (const item of elements) { // Let's now update the opacity of all the elements whose opacity should be updated after the animation ended
                            if (item.opacityChange === "end") item.element.style.opacity = item.output ?? "1";
                        }
                        img.remove();
                        if (!keepBodyOverflowHidden) document.body.style.overflow = "";
                        res();
                    }, 15);
                })
                img.style.transform = outputScale;
                img.style.borderRadius = `${outputBorderRadius}px`;
            });
        })
    },
    /**
     * Abort the current image animation
     */
    stopAnimation: async () => {
        if (currentAnimation) {
            document.body.style.overflow = "hidden";
            currentAnimation.animation.pause();
            await new Promise(res => setTimeout(res, 1));
            // Let's get the position of the current image, and make another animation where the temp image will be the source image, and the start image will be the destination one. In this way, the temp image will go back from the elements
            const imageTempData = currentAnimation.tempImage.getBoundingClientRect();
            const tempImage = [currentAnimation.tempImage][0];
            for (const item of currentAnimation.opacityChange) { // Let's change the opacity of the elements whose opacity should be changed before the animation
                if (item.opacityChange === "start") item.element.style.opacity = `${1 - +(item.output ?? "1")}`;
            }
            for (const item of ["left", "width", "height"]) currentAnimation.tempImage.style[item as "width"] = `${imageTempData[item as "width"]}px`;
            currentAnimation.tempImage.style.top = `${imageTempData.top + window.scrollY}px`;
            tempImage.style.transform = "";
            await new Promise(res => setTimeout(res, 1));
            currentAnimation.animation.cancel();
            await obj.imageAnimationHandler({
                sourceImage: currentAnimation.tempImage,
                outputImage: currentAnimation.sourceImage,
                elements: []
            });
            tempImage.remove();
        }
    }
}

export default obj;