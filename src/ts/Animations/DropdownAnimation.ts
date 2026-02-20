const obj = {
    /**
     * Start the dropdown open animation. This is currently used when opening the sleep timer or the song options, but not from the circular buttons in the "App" component
     * @param element the Element where the animation should be run
     * @param close if the animation should be the one triggered by the dropdown close event
     * @param scaling the origin of the scaling animation
     */
    triggerAnimation(element: HTMLElement, close = false, scaling: string) {
        element.style.transformOrigin = scaling;
        const objs = [{opacity: "1", scale: "1"}, {opacity: "0", scale: "0", borderRadius: "50%", border: "0px"}]
        return new Promise<void>(res => {
            element.animate(close ? objs : [objs[1], objs[0]], {easing: "ease-in-out", duration: 250}).addEventListener("finish", () => res());
            element.style.opacity = close ? "0" : "1";
        })

    }
}
export default obj;