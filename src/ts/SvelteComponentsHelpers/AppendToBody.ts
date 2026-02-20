/**
 * Move a Node to the body. This is usually used to circumvent the limits of nested z-indexes.
 * @param node the Node to move
 */
export default function appendToBody(node: Element) {
        document.body.append(node);
        return {
            destroy: () => {
                node.remove();
                // @ts-ignore
                node = undefined;
            }
        }
    }
