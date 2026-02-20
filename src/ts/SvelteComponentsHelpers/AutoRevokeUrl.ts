/**
 * Automatically revoke the Object URL of an image when it's deleted from the DOM
 * @param node the image that will be removed
 */
export default function AutoRevokeUrl(node: HTMLImageElement) {
        return {
            destroy: () => {
                if (node.src) URL.revokeObjectURL(node.src);
                // @ts-ignore
                node = undefined;
            }
        }
    }
