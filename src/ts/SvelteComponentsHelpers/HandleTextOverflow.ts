/**
 * Scroll all the text inside an element, especially if it normally would overflow
 * @param text the element that should be resized
 * @param reverse if the text should go back to its original position
 */
export async function HandleTextOverflow(text: HTMLElement, reverse?: boolean) {
    if (!text) return;
    await new Promise(res => setTimeout(res, 2500));
    if (text.scrollWidth > text.clientWidth) {
        let isFirst = true;
        while (reverse ? text.scrollLeft !== 0 : text.scrollLeft < text.scrollWidth - text.clientWidth) {
            if (!isFirst && text.scrollLeft === 0) break;
            text.scrollTo({left: text.scrollLeft + (reverse ? -1 : 1)});
            isFirst = false;
            await new Promise(res => setTimeout(res, 15));
        }
    }
}

/**
 * Scroll all the text inside multiple elements, especially if they normally would overflow
 * @param text the elements that should be resized
 * @param reverse if the text should go back to its original position
 */
export async function HandleMultipleTextOverflows(text: HTMLElement[], reverse?: boolean) {
    await Promise.all(text.map(i => HandleTextOverflow(i, reverse)));
    HandleMultipleTextOverflows(text, !reverse);
}