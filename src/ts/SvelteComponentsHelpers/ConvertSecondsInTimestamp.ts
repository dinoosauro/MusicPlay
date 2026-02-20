/**
 * Convert a number of seconds to a prettier timestamp
 * @param source the number of seconds
 * @returns the HH:MM:SS timestamp
 */
export default function ConvertSecondsInTimestamp(source: number) {
    const hours = Math.floor(source / 3600);
    source -= (hours * 3600);
    const minutes = Math.floor(source / 60);
    source -= (minutes * 60);
    const seconds = Math.floor(source);
    return `${hours === 0 ? "" : `${formatToStr(hours)}:`}${formatToStr(minutes)}:${formatToStr(seconds)}`;
}

/**
 * Make sure the number string is composed of two digits, by adding a "0" if there's only one.
 * @param number the number to look
 * @returns the formatted string
 */
function formatToStr(number: number) {
    return number > 9 ? number.toString() : `0${number}`;
}