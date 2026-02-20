export interface OpacityChange {
    /**
     * The element whose opacity will be changed
     */
    element: HTMLElement;
    /**
     * If the opacity should be changed before or after the transition
     */
    opacityChange: "start" | "end";
    /**
     * The value that should be set as opacity. It defaults to `1`
     */
    output?: string
}

export interface PopupScalingInfo {
    /**
     * Function called to close the dropdown menu
     */
    closeCallback: () => void;
    /**
     * The origin of the scaling used for the dropdown open/close animation
     */
    scaling: string;
    /**
     * Maximum width and height
     */
    limits: string
}