import type { syncedLyricsObj } from "../Database/DatabaseInterfaces";

/**
 * Convert a TTML file so that it can be used by the application
 * @param ttml the TTML file content
 * @returns the synced lyrics object
 */
export default function ParseTTMLFile(ttml: string) {
    const dom = new DOMParser().parseFromString(ttml, "application/xml");
    /**
     * A list of all the singers IDs available in the TTML file
     */
    let allSingersId: string[] = [];
    let outputLyrics: syncedLyricsObj[] = [];
    for (const p of dom.querySelectorAll("div p")) {
        const availableWords = Array.from(p.querySelectorAll("span[begin]"));
        // Let's look for the singer ID, if available. We just care about its position, since we'll number it as "0"/"1"/"2" etc
        const singerId = p.getAttribute("ttm:agent");
        if (singerId !== null && allSingersId.indexOf(singerId) === -1) allSingersId.push(singerId);
        let singerPosition = allSingersId.indexOf(singerId as string);
        const words: syncedLyricsObj[] = availableWords.map(word => {return {
            text: word.textContent.trim(),
            start: parseSeconds(word.getAttribute("begin") as string),
            words: [],
            artistNumber: singerPosition === -1 ? undefined : singerPosition,
            end: word.getAttribute("end") !== null ? parseSeconds(word.getAttribute("end") as string) : undefined
        }});
        const getStart = p.getAttribute("begin") !== null ? parseSeconds(p.getAttribute("begin") as string) : words.length !== 0 ? words[0].start : null;
        if (getStart === null) continue;
        outputLyrics.push({
            text: words.length === 0 ? p.textContent.trim() : words.map(i => i.text).join(" ").trim(),
            words,
            start: getStart,
            artistNumber: singerPosition === -1 ? undefined : singerPosition,
            end: p.getAttribute("end") !== null ? parseSeconds(p.getAttribute("end") as string) : undefined
        });
    }
    return outputLyrics;
}

/**
* Convert the TTML begin/end string to milliseconds
* @param seconds the extracted begin/end string from the TTML file
*/
function parseSeconds(seconds: string) {
    if (seconds.endsWith("s")) {
        return +seconds.substring(0, seconds.length - 1) * 1000;
    }
    let possibleMinutes = seconds.split(":");
    let minutes = possibleMinutes.length === 1 ? 0 : +(possibleMinutes.shift() as string)
    let possibleMs = possibleMinutes[0].split(".");
    let ms = possibleMs.length === 1 ? 0 : +(possibleMs.pop() as string);
    return (minutes * 60 * 1000) + ((+possibleMs[0]) * 1000) + ms;
}