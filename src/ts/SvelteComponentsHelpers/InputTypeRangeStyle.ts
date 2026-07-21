/**
 * Implement the custom `input[type=range]` styling to the passed input[type=range] object.
 * 
 * This function creates a container div, automatically appended to the parent element of the slider, and adds all the custom events so that the user can have a decently-functioning scroller also on Safari.
 * @param range the input range element to update
 * @param inputInfo the event to run when the user changes the selection. Also an object can be passed to customize the input range
 */
export default function inputRangeStyle(range: HTMLInputElement, inputInfo?: ((e: Event) => void) | {
    inputEvent: (e: Event) => void,
    /**
     * If true, the events of the slider will be set so that the item can be scrolled vertically
     */
    isVertical?: boolean,
    /**
     * If true, the item will be rotated of 180 degrees, and the events will be updated so that the scroll will still feel natural.
     */
    isRotated?: boolean
}) {
    const inputEvent = typeof inputInfo === "function" ? inputInfo : inputInfo ? inputInfo.inputEvent : undefined;
    const isVertical = typeof inputInfo === "object" && inputInfo.isVertical;
    const isRotated = typeof inputInfo === "object" && inputInfo.isRotated;
    // Let's create the container class, so that we can add the different color at the left
    const container = document.createElement("div");
    container.classList.add("slider", isVertical ? "verticalSlider" : "horizontalSlider");
    if (isRotated) container.classList.add("rotatedSlider");
    range.parentElement?.insertBefore(container, range); // Let's add it in the same position of the input[type=range] so that we won't alteer the layout styling
    container.append(range);
    /**
     * Update the colors of the input[type=range] according to its value
     */
    function updateContainer() {
        container.style.setProperty("--currentsize", `${(+range.value * 100) / +range.max}%`);
    }
    range.addEventListener("input", (e) => {
        updateContainer();
        if (inputEvent) inputEvent(e);
    });
    range.addEventListener("change", () => {
        updateContainer();
    })
    let isMouseDown = false;
    // Safari has a really frustrating implementation of the default slider, since it forbids sliding if the user hasn't touched the slider pointer (that obviously is hidden in our styling). Therefore, we need to implement the scroll logic manually, by getting the X position of the user scroll and adapting the value according to it.
    for (const eventType of ["touchstart", "touchmove", "mousedown", "mousemove"]) { 
        range.addEventListener(eventType as "touchstart", (e: TouchEvent) => {
            if (range.disabled) return;
            if (eventType === "mousemove" && !isMouseDown) return; // Since the "mousemove" event runs even if the user hasn't pressed the left button of the mouse
            e.preventDefault();
            if (e.touches && e.touches.length !== 1) return;
            const rect = container.getBoundingClientRect();
            // @ts-ignore
            let percentage = (((e.touches ? e.touches[0] : e)[`client${isVertical ? "Y" : "X"}`] - rect[isVertical ? "top" : "left"]) * 100) / rect[isVertical ? "height" : "width"]; 
            if (isRotated) percentage = 100 - percentage;
            range.value = (percentage * +range.max / 100).toString();
            range.dispatchEvent(new Event("input"));
        })
    }
    range.addEventListener("mousedown", () => (isMouseDown = true));
    range.addEventListener("mouseup", () => (isMouseDown = false));
    range.addEventListener("mouseout", () => (isMouseDown = false));
    updateContainer();
    setTimeout(() => {
        updateContainer();
    }, 15);
}