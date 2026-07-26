interface Props {
    /**
     * The text that should be written to the canvas
     */
    text: string,
    /**
     * The context of the canvas where the text should be written
     */
    ctx: CanvasRenderingContext2D,
    /**
     * Start position of the `x` axis
     */
    startX?: number,
    /**
     * End position of the `x` axis
     */
    endX?: number,
    /**
     * Start position of the `y` axis
     */
    startY?: number,
    /**
     * Space that should be added between two lines of the passed text
     */
    marginBetweenLines?: number,
    /**
     * Maxmimum number of lines. Extra lines won't be added, and `...` will be added to the last line of text.
     */
    maxLines?: number
}

/**
 * Write some text to a canvas
 * @returns the Y position immediately after the text has been written
 */
export default function WriteTextToCanvas({text, ctx, startX = 0, endX = ctx.canvas.width, startY = 0, marginBetweenLines = 20, maxLines}: Props) {
    /**
     * List of the text that should be written. Each entry is its own line.
     */
    let outputStrs = [];
    /**
     * Part of the text that still has to be added in the `outputStrs` array.
     */
    let stringToAdd = text;
    while (stringToAdd !== "") {
        let firstWord = stringToAdd.indexOf(" ") === -1 ? stringToAdd : stringToAdd.substring(0, stringToAdd.indexOf(" ")).trim();
        if (ctx.measureText(firstWord).width > (endX - startX)) { // This means that the word is too long for adding it to the chart. We'll need to break it in multiple lines
            let word = "";
            while (firstWord !== "") {
                let isFromBreak = false;
                while(ctx.measureText(word).width < (endX - startX)) {
                    word += stringToAdd[0] ?? "";
                    stringToAdd = stringToAdd.substring(1);
                    firstWord = firstWord.substring(1);
                    if (stringToAdd === "" || stringToAdd[0] === " ") {
                        isFromBreak = true;
                        break;
                    }
                }
                if (!isFromBreak) { // We need to remove the last character from the string, since it's the one that made the text overflow.
                    firstWord = `${word[word.length - 1]}${firstWord}`;
                    stringToAdd = `${word[word.length - 1]}${stringToAdd}`;
                    word = word.substring(0, word.length - 1);
                }
                outputStrs.push(word);
                word = "";
            }
        } else { // Word can be contained in the line
            stringToAdd = stringToAdd.indexOf(" ") === -1 ? "" : stringToAdd.substring(stringToAdd.indexOf(" ") + 1);
            let isFromBreak = false;
            while(ctx.measureText(firstWord).width < (endX - startX)) {
                let isLastItem = stringToAdd.indexOf(" ") === -1;
                firstWord += ` ${isLastItem ? stringToAdd : stringToAdd.substring(0, stringToAdd.indexOf(" "))}`;
                stringToAdd = isLastItem ? "" : stringToAdd.substring(stringToAdd.indexOf(" ") + 1).trim();
                if (stringToAdd === "") {
                    isFromBreak = true;
                    break;
                }
            }
            if (!isFromBreak || ctx.measureText(firstWord).width > (endX - startX)) { // We need to remove the last word from the string, since it's the one that made the text overflow.
                stringToAdd = `${firstWord.substring(firstWord.lastIndexOf(" ") + 1)} ${stringToAdd}`;
                firstWord = firstWord.substring(0, firstWord.lastIndexOf(" "));
            } 
            outputStrs.push(firstWord);
        }
    }
    if (typeof maxLines !== "undefined" && outputStrs.length > maxLines) { // Let's remove the extra lines
        outputStrs = outputStrs.splice(0, maxLines);
        if (ctx.measureText(`${outputStrs[outputStrs.length - 1]}...`).width < (endX - startX)) { // Check if we can add the three dots without overflowing
            outputStrs[outputStrs.length - 1] += "...";
        } else {
            outputStrs[outputStrs.length - 1] = `${outputStrs[outputStrs.length - 1].substring(0, outputStrs[outputStrs.length - 1].length - 3)}...`;
        }
    }

    for (const item of outputStrs) { // Now, let's write the text to the canvas. We'll center it.
        const getHeight = ctx.measureText(item);
        const width = (startX + endX - getHeight.width) / 2;
        ctx.fillText(item, width, startY, endX - startX);
        startY += getHeight.hangingBaseline + marginBetweenLines;
    }

    return startY;
}