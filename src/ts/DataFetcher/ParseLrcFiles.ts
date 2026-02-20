import type { syncedLyricsObj } from "../Database/DatabaseInterfaces";


/**
 * Convert the passed LRC file so that it can be used by the application
 * @param text the LRC file content
 * @returns the syncedLyricsObject parsed from the LRC file
 */
export default function ParseLrcFiles(text: string) {
    const outputArr: syncedLyricsObj[] = [];
    const split = text.split("\n");
    /**
     * Regex used to check if the lyrics are available word-by-word
     */
    const wordsRegex = new RegExp(/\<\d+:\d{2}.\d{2}\>/g);
    for (let line of split) {
        line = line.trim();
        if (/\[\d+:\d{2}.\d{2}/.test(line.substring(0, line.indexOf("]")))) { // Check that the LRC syntax is valid
            const textContent = line.substring(line.indexOf("]") + 1).trim();
            let output: syncedLyricsObj = {
                words: [],
                text: textContent.split(wordsRegex).map(i => i.trim()).join(" "),
                start: convertTimestampToMilliseconds(line.substring(1, line.indexOf("]"))),
                artistNumber: textContent.toLowerCase().startsWith("v1:") ? 0 : textContent.toLowerCase().startsWith("v2:") ? 1 : textContent.toLowerCase().startsWith("v3:") ? 2 : undefined
            };
            // Let's now check if the lyrics are word-by-word
            const wordsTimestamp = Array.from(textContent.matchAll(wordsRegex));
            if (wordsTimestamp) {
                for (let i = 0; i < wordsTimestamp.length; i++) { // Let's populate the "word" field by adding each word, along with its start and end position
                    let interestingStr = textContent.substring(wordsTimestamp[i].index, (i + 1) !== wordsTimestamp.length ? wordsTimestamp[i + 1].index : undefined);
                    output.words.push({
                        start: convertTimestampToMilliseconds(interestingStr.substring(1, interestingStr.indexOf(">"))),
                        text: interestingStr.substring(interestingStr.indexOf(">") + 1).trim(),
                        words: []
                    })

                }
            }
            outputArr.push(output);
        }
    }
    return outputArr;
}

/**
 * Convert the MM:ss.mm LRC timestamp to milliseconds
 * @param timestamp the timestamp to convert
 * @returns the milliseconds tied to that timestamp
 */
function convertTimestampToMilliseconds(timestamp: string) {
    let minutes = timestamp.substring(0, timestamp.indexOf(":"));
    let seconds = timestamp.substring(timestamp.indexOf(":") + 1, timestamp.indexOf("."));
    let centsSeconds = timestamp.substring(timestamp.indexOf(".") + 1);
    return (+minutes * 60 * 1000) + (+seconds * 1000) + (+centsSeconds * 10);
}