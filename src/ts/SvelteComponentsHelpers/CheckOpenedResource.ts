import { imageMap } from "./GlobalInformation";

/**
 * Click the HTMLElement if the `openedResource` id in the URL matches the current resource.
 * @param node the HTMLElement that could be clicked
 * @param id a string with the ID. If the application should wait the album art fetching process, pass an object with the resource id (`id` key) and the value to which the HTMLImageElement is mapped in the `imageMap` array (`waitUntilImageMap`)
 */
export default function CheckOpenedResource(node: HTMLElement, id: string | {
    id: string,
    waitUntilImageMap?: string
}) {
    const params = new URLSearchParams(window.location.hash.substring(1));
    const realId = typeof id === "string" ? id : id.id;
    if (params.get("openedResource") === realId) {
        if (typeof id === "object" && id.waitUntilImageMap && !imageMap.has(id.waitUntilImageMap)) {
            setTimeout(() => CheckOpenedResource(node, id), 50);
            return;
        }
        params.delete("openedResource");
        window.history.replaceState(window.history.state, "", `./#${params.toString()}`);
        node.click();
    }
}