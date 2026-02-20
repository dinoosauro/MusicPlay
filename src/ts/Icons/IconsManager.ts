import IconsSource from "./IconsSource";

const icons = IconsSource;

const obj = {
    /**
     * Get the URL for an icon
     * @param icon the icon to fetch
     * @param cssClass the class used to color the icon
     * @returns the source URL of the icon
     */
    getIconObjectUrl: (icon: keyof typeof icons, cssClass?: string) => {
        return URL.createObjectURL(new Blob([icons[icon].replaceAll(`#212121`, getComputedStyle(document.body).getPropertyValue(cssClass ?? "--text"))], {type: "image/svg+xml"}));
    },
    /**
     * Update the icon on an image
     * @param icon the name of the new icon
     * @param ref the image where it should be updated
     */
    updateIcon: (icon: keyof typeof icons, ref: HTMLImageElement) => {
        if (ref.src) URL.revokeObjectURL(ref.src);
        ref.src = obj.getIconObjectUrl(icon);
    },
}
export default obj;