import { lang } from "./Language";

/**
 * Get a string that represents the interval between two dates
 * @param startTime the interval of time where the stats have been fetched 
 * @returns a string with the formatted time interval
 */
export default function GetIntervalBetweenDates(startTime: "week" | "month" | "year" | "all" | number[]) {
    switch(startTime) {
        case "week": {
            const firstDate = new Date(); 
            firstDate.setHours(24 * -7);
            const secondDate = new Date();
            if (firstDate.getMonth() === secondDate.getMonth()) return `${firstDate.getDate()} – ${secondDate.getDate()} ${firstDate.toLocaleDateString(undefined, {month: "long", year: "numeric"})}`;
            return `${firstDate.toLocaleDateString(undefined, {day: "numeric", month: "long", year: firstDate.getFullYear() === secondDate.getFullYear() ? undefined : "numeric"})} – ${secondDate.toLocaleDateString(undefined, {day: "numeric", month: "long", year: "numeric"})}`;
        }
        case "month":
            return new Date().toLocaleDateString(undefined, {month: "long", year: "numeric"});
        case "year":
            return new Date().toLocaleDateString(undefined, {year: "numeric"});
        case "all":
            return lang("all time");
    }
    const firstDate = new Date(startTime[0]);
    const secondDate = new Date(startTime[1]);
    return `${firstDate.toLocaleString(undefined, {day: "2-digit", month: "long", year: firstDate.getFullYear() === secondDate.getFullYear() ? undefined : "numeric"})} – ${new Date(startTime[1]).toLocaleString(undefined, {day: "2-digit", month: "long", year: "numeric"})}`
}