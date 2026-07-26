import type { songsStatsDB } from "../Database/DatabaseInterfaces";
import type { MetadataSource } from "../Player/PlayerInterfaces";
import type { StatsDisplayItem } from "./GetChartFromArtistStats";

interface Props {
    /**
     * Information fetched from the song stats database
     */
    entry: { id: string, data: songsStatsDB },
    /**
     * The interval of time where the stats have been fetched
     */
    startTime: string | number[],
    /**
     * Metadata of the current audio track
     */
    songMetadata: MetadataSource
}


export function GetStatsDisplayItem({ entry, startTime, songMetadata }: Props) {
    let object: StatsDisplayItem = {
        playedMs: 0,
        mostPlayedDay: "Monday",
        mostPlayedMonth: "January",
        mostPlayedYear: "2026",
        data: {
            msPlayedAtWeekDay: [],
            msPlayedAtDay: [],
            msPlayedAtMonth: [],
            msPlayedAtYear: {},
            msPlayedAtHour: []
        },
        songMetadata,
        source: entry.data
    };
    for (let i = (entry.data.activity.length - 1); i >= 0; i--) {
        const date = new Date(entry.data.activity[i].date);
        const whatShouldWeDo = getIfDateShouldBeSkipped(startTime, date, entry.data.activity[i].date);
        if (whatShouldWeDo === SkipDate.BREAK) break;
        if (whatShouldWeDo === SkipDate.CONTINUE) continue;
        object.playedMs += entry.data.activity[i].duration;
        const [dayOfWeek, dayOfMonth, monthOfYear, year, hour] = [date.getDay(), date.getDate(), date.getMonth(), date.getFullYear().toString(), date.getHours()];
        if (typeof object.data.msPlayedAtWeekDay[dayOfWeek === 0 ? 6 : dayOfWeek - 1] === "undefined") object.data.msPlayedAtWeekDay[dayOfWeek === 0 ? 6 : dayOfWeek - 1] = 0;
        object.data.msPlayedAtWeekDay[dayOfWeek === 0 ? 6 : dayOfWeek - 1] += entry.data.activity[i].duration;
        // For the `msPlayedAtDay` array, we'll divide them by month
        if (typeof object.data.msPlayedAtDay[monthOfYear] === "undefined") object.data.msPlayedAtDay[monthOfYear] = [];
        if (typeof object.data.msPlayedAtDay[monthOfYear][dayOfMonth] === "undefined") object.data.msPlayedAtDay[monthOfYear][dayOfMonth] = 0;
        object.data.msPlayedAtDay[monthOfYear][dayOfMonth] += entry.data.activity[i].duration;
        if (typeof object.data.msPlayedAtMonth[monthOfYear] === "undefined") object.data.msPlayedAtMonth[monthOfYear] = 0;
        object.data.msPlayedAtMonth[monthOfYear] += entry.data.activity[i].duration;
        if (typeof object.data.msPlayedAtYear[year] === "undefined") object.data.msPlayedAtYear[year] = 0;
        object.data.msPlayedAtYear[year] += entry.data.activity[i].duration;
        if (typeof object.data.msPlayedAtHour[hour] === "undefined") object.data.msPlayedAtHour[hour] = 0;
        object.data.msPlayedAtHour[hour] += entry.data.activity[i].duration;
    }
    let maxWeekDay = 0;
    for (let weekDay = 0; weekDay < object.data.msPlayedAtWeekDay.length; weekDay++) {
        if ((object.data.msPlayedAtWeekDay[weekDay] ?? 0) > object.data.msPlayedAtWeekDay[maxWeekDay]) maxWeekDay = weekDay;
    }
    const tempDate = new Date("December 1, 2025"); // December 1, 2025 was Monday
    tempDate.setHours(24 * (maxWeekDay || 7));
    object.mostPlayedDay = tempDate.toLocaleDateString(undefined, { weekday: "long" });
    let maxMonth = 0;
    for (let month = 0; month < object.data.msPlayedAtMonth.length; month++) {
        if ((object.data.msPlayedAtMonth[month] ?? 0) > (object.data.msPlayedAtMonth[maxMonth] ?? 0)) maxMonth = month;
    }
    tempDate.setMonth(maxMonth);
    object.mostPlayedMonth = tempDate.toLocaleDateString(undefined, { month: "long" });
    let year = "2026";
    for (const key in object.data.msPlayedAtYear) {
        if (object.data.msPlayedAtYear[key] > (object.data.msPlayedAtYear[year] ?? 0)) year = key;
    }
    object.mostPlayedYear = year;
    return object;
}

export enum SkipDate {
    /**
     * The `continue` keyword should be called: the current item should be skipped
     */
    CONTINUE = 0,
    /**
     * The `break` keyword should be called
     */
    BREAK = 1,
    /**
     * No keyword should be called
     */
    NOTHING = -1
}

/**
 * Check if a date should be skipped, since outside the interval, or not
 * @param startTime the interval of time where the stats have been fetched
 * @param date the Date object for the time to check
 * @param dateNum the value of the Date object to check
 * @returns if the date should be skipped or not
 */
export function getIfDateShouldBeSkipped(startTime: string | number[], date: Date, dateNum = date.valueOf()): SkipDate {
    const today = new Date();
    const [currentYear, currentMonth] = [today.getFullYear(), today.getMonth()]
    if (Array.isArray(startTime)) {
        if (startTime[0] > dateNum || startTime[1] < dateNum) return SkipDate.BREAK;
    } else {
        if (startTime === "week") {
            const compareDate = new Date();
            compareDate.setHours(24 * -7);
            if (compareDate > date || date > new Date()) return SkipDate.BREAK;
        } else {
            if (startTime !== "all" && date.getFullYear() !== currentYear) return SkipDate.BREAK;
            if (startTime !== "all" && startTime !== "year" && date.getMonth() !== currentMonth) return SkipDate.BREAK;
        }
    }
    return SkipDate.NOTHING
}