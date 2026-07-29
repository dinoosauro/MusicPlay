import type { ChartConfiguration, ChartDataset } from "chart.js"
import type { MetadataSource } from "../Player/PlayerInterfaces"
import Settings from "../Settings";
import { lang } from "./Language";
import type { songsStatsDB } from "../Database/DatabaseInterfaces";

/**
 * Create a chart from artists stats
 * @param stat the object used to fetch stats from the artist
 * @param type the division that should be applied for the data
 * @param getLabelNameFromAlbumMetadata if the name for each dataset should be fetched from the metadata of the track
 * @returns the chart object to use to get the chart
 */
export function getChartFromArtistStats(stat: { albums: { [key: string]: ArtistStats } }, type: "month" | "albumsPerMonth" | "songsPerMonth" | "year" | "albumsPlayedPerYear" | "songsPlayedPerYear" | "hour" | "albumsPerHour" | "songsPerHour", getLabelNameFromAlbumMetadata?: boolean) {
    switch (type) {
        case "hour": {
            return {
                type: "bar",
                data: {
                    labels: Array(24).fill(0).map((a, i) => i),
                    datasets: [{
                        data: (() => {
                            const hours: number[] = Array(24).fill(0);
                            for (const album in stat.albums) {
                                for (const song of stat.albums[album].songs) {
                                    for (let i = 0; i < song.data.msPlayedAtHour.length; i++) hours[i] += (song.data.msPlayedAtHour[i] ?? 0);
                                }
                            }
                            return hours;
                        })(),
                        backgroundColor: Settings.customChartColors
                    }]
                },
                options: chartOptions
            } as ChartConfiguration
        }
        case "albumsPerHour":
        case "songsPerHour": {
            return {
                type: "bar",
                data: {
                    labels: Array(24).fill(0).map((a, i) => i),
                    datasets: (() => {
                        const arr: ChartDataset[] = [];
                        let i = 0;
                        for (const album in stat.albums) {
                            let hours = Array(24).fill(0);
                            for (const song of stat.albums[album].songs) {
                                for (let i = 0; i < song.data.msPlayedAtHour.length; i++) hours[i] += (song.data.msPlayedAtHour[i] ?? 0);
                                if (type === "songsPerHour") { // Add this song in the output array
                                    updateArray(song.songMetadata.metadata.title);
                                    hours = Array(24).fill(0);
                                }
                            };
                            if (type === "albumsPerHour") updateArray(getLabelNameFromAlbumMetadata ? stat.albums[album].songs[0].songMetadata.metadata.title : album); // Update the output array by adding all the adta fetched from this album
                            function updateArray(label: string) {
                                arr.push({
                                    label,
                                    data: hours,
                                    backgroundColor: Settings.customChartColors[i % Settings.customChartColors.length]
                                });
                                i++;
                            }
                        }
                        return arr;
                    })()
                },
                options: chartOptions
            } as ChartConfiguration
        }
        case "albumsPerMonth":
        case "songsPerMonth": {
            return {
                type: "bar",
                data: (() => {
                    const labels: string[] = [];
                    let values: ChartDataset[] = [];
                    if (type === "songsPerMonth") { // Iterate over all the songs so that we can add it to the values list
                        let index = 0;
                        for (const album in stat.albums) {
                            for (const song of stat.albums[album].songs) {
                                const months = Array(12).fill(0) as number[];
                                for (let i = 0; i < song.data.msPlayedAtMonth.length; i++) months[i] += (song.data.msPlayedAtMonth[i] ?? 0); // By doing this, we'll not have empty values in the output array, that would cause Chart.JS to crash
                                values.push({
                                    label: song.songMetadata.metadata.title,
                                    data: months,
                                    backgroundColor: Settings.customChartColors[index % Settings.customChartColors.length]
                                });
                                index++;
                            }
                        }
                    } else values = Object.entries(stat.albums).map(([name, album], index) => {
                        const months = Array(12).fill(0) as number[];
                        for (const song of album.songs) {
                            for (let i = 0; i < song.data.msPlayedAtMonth.length; i++) months[i] += (song.data.msPlayedAtMonth[i] ?? 0);
                        }
                        return {
                            label: getLabelNameFromAlbumMetadata ? album.songs[0].songMetadata.metadata.title : name,
                            data: months,
                            backgroundColor: Settings.customChartColors[index % Settings.customChartColors.length]
                        }
                    });
                    /**
                     * List of all the months that shouldn't be added
                     */
                    let itemsToSplice: number[] = [];
                    for (let i = 0; i < 12; i++) {
                        if (!values.find(a => a.data[i] !== 0)) { // No entry has a play during this month
                            itemsToSplice.push(i);
                        } else { // Add the current month to the labels array, since it'll be used
                            const date = new Date();
                            date.setMonth(i);
                            labels.push(date.toLocaleDateString(undefined, { month: "long" }));
                        }
                    }
                    for (const value of values) {
                        value.data = value.data.filter((content, i) => itemsToSplice.indexOf(i) === -1);
                    }
                    return {
                        labels,
                        datasets: values
                    }
                })(),
                options: chartOptions
            } as ChartConfiguration
        }
        case "year": {
            return {
                type: "bar",
                data: (() => {
                    const years: { [key: string]: number } = {};
                    for (const album in stat.albums) {
                        for (const song of stat.albums[album].songs) {
                            for (const year in song.data.msPlayedAtYear) {
                                if (!years[year]) years[year] = 0;
                                years[year] += (song.data.msPlayedAtYear[year] ?? 0);
                            }
                        }
                    }
                    return {
                        labels: Object.keys(years),
                        datasets: [{
                            data: Object.values(years),
                            backgroundColor: Settings.customChartColors
                        }]
                    }
                })(),
                options: chartOptions
            } as ChartConfiguration
        }
        case "albumsPlayedPerYear":
        case "songsPlayedPerYear": {
            return {
                type: "bar",
                data: (() => {
                    let labels = new Set<number>();
                    let entries: {suggestedLabels: number[], label: string, data: number[]}[] = [];
                    if (type === "songsPlayedPerYear") {
                        for (const album in stat.albums) {
                            for (const song of stat.albums[album].songs) {
                                const years: { [key: string]: number } = {};
                                for (const year in song.data.msPlayedAtYear) {
                                    labels.add(+year);
                                    if (!years[year]) years[year] = 0;
                                    years[year] += (song.data.msPlayedAtYear[year] ?? 0);
                                }
                                entries.push({
                                    suggestedLabels: Object.keys(years).map(i => +i),
                                    label: song.songMetadata.metadata.title,
                                    data: Object.values(years)
                                })
                            }
                        }
                    } else entries = Object.entries(stat.albums).map(([name, stats]) => {
                        const years: { [key: string]: number } = {};
                        for (const song of stats.songs) {
                            for (const year in song.data.msPlayedAtYear) {
                                labels.add(+year);
                                if (!years[year]) years[year] = 0;
                                years[year] += (song.data.msPlayedAtYear[year] ?? 0);
                            }
                        }
                        return {
                            suggestedLabels: Object.keys(years).map(i => +i),
                            label: getLabelNameFromAlbumMetadata ? stats.songs[0].songMetadata.metadata.title : name,
                            data: Object.values(years)
                        }
                    });
                    const output: ChartDataset[] = [];
                    const sortedLabels = Array.from(labels).sort();
                    for (let i = 0; i < entries.length; i++) {
                        const entry = entries[i];
                        output.push({
                            label: entry.label,
                            data: sortedLabels.map(i => {
                                const index = entry.suggestedLabels.findIndex(a => a === i);
                                if (index === -1) return 0;
                                return entry.data[index];
                            }),
                            backgroundColor: Settings.customChartColors[i % Settings.customChartColors.length]
                        });
                    }
                    return {
                        labels: sortedLabels,
                        datasets: output
                    }
                })(),
                options: chartOptions
            } as ChartConfiguration
        }
    }
    return { // Per day of the month
        type: "bar",
        data: {
            labels: Array(30).fill(0).map((a, i) => i + 1),
            datasets: (() => {
                /**
                 * A nested array. Each entry has: `[the number that identifies the month, [the number that identifies the day of the month, ms played in that week]]`
                 */
                let outputArray: [number, number[]][] = [];
                for (const album in stat.albums) {
                    for (const song of stat.albums[album].songs) {
                        for (let i = 0; i < song.data.msPlayedAtDay.length; i++) { // The first iteration is for the twelve months
                            if (!outputArray[i]) outputArray[i] = [i, []];
                            if (!song.data.msPlayedAtDay[i]) continue;
                            for (let j = 0; j < song.data.msPlayedAtDay[i].length; j++) { // The second iteration is for the day of the month
                                if (!outputArray[i][1][j]) outputArray[i][1][j] = 0;
                                outputArray[i][1][j] += (song.data.msPlayedAtDay[i][j] ?? 0);
                            }
                        }
                    };
                }
                const filteredArray = outputArray.filter(([index, arr]) => arr.length !== 0 && arr.some(i => i !== 0)); // Remove empty entries by looking if there are some non-zero entries in the array
                return filteredArray.map((val, i) => {
                    const date = new Date();
                    date.setMonth(val[0]);
                    return {
                        label: date.toLocaleDateString(undefined, { month: "long" }),
                        data: val[1],
                        backgroundColor: Settings.customChartColors[i % Settings.customChartColors.length]
                    }
                })
            })()
        },
        options: chartOptions
    } as ChartConfiguration
}

/**
 * Get the chart with the data divided by month or week for artists and albums
 * @param source the object used to fetch stats from the artist
 * @param type the division that should be applied for the data
 * @returns the Chart object
 */
export function getWeekAndMonthChartForArtistsAndAlbums(source: {[key: string]: ArtistStats}, type: "week" | "month") {
    const entries = Object.entries(source);
    switch(type) {
        case "week": {
            return {
                type: "line",
                data: {
                    labels: weekDayLabels,
                    datasets: entries.map((entry, i) => {
                        let weekPlays: number[] | undefined;
                        if (!entry[1].weekPlays) {
                            weekPlays = Array(7).fill(0);;
                            for (const song of entry[1].songs) {
                                for (let i = 0; i < song.data.msPlayedAtWeekDay.length; i++) weekPlays[i] += (song.data.msPlayedAtWeekDay[i] ?? 0);
                            }
                        }
                        return {
                            label: entry[0],
                            data: weekPlays ?? entry[1].weekPlays,
                            backgroundColor: Settings.customChartColors[i % Settings.customChartColors.length]
                        }
                    })
                },
                options: chartOptions
            } as ChartConfiguration
        }
    }
    return {
        type: "bar",
        data: {
            labels: Array(30).fill(0).map((a, i) => i+1),
            datasets: entries.map((entry, i) => {
                const data: number[] = Array(30).fill(0);
                for (const song of entry[1].songs) {
                    for (const month of song.data.msPlayedAtDay) { // We don't care about the month, but only about the day
                        if (!month) continue;
                        for (let i = 0; i < month.length; i++) data[i] += (month[i] ?? 0);
                    }
                }
                return {
                    label: entry[0],
                    data: data,
                    backgroundColor: Settings.customChartColors[i % Settings.customChartColors.length]
                }
            })
        },
        options: chartOptions
    } as ChartConfiguration
}

/**
 * Get week and song chart for the songs in an album
 * @param stat the object used to fetch stats from the artist
 * @param type the division that should be applied for the data
 * @returns the requested chart
 */
export function getWeekAndSongDatasetForAlbumSongs(stat: ArtistStats, type: "weekday" | "song") {
    switch (type) {
        case "weekday": {
            return {
                type: "bar",
                data: {
                    labels: weekDayLabels,
                    datasets: stat.songs.map((i, index) => {return {
                        label: i.songMetadata.metadata.title,
                        data: i.data.msPlayedAtWeekDay,
                        backgroundColor: Settings.customChartColors[index % Settings.customChartColors.length]
                    }})
                },
                options: chartOptions
            } as ChartConfiguration
        }
    }
    return {
        type: "bar",
        data: {
            labels: stat.songs.map(i => i.songMetadata.metadata.title),
            datasets: [{
                data: stat.songs.map(i => i.playedMs),
                backgroundColor: Settings.customChartColors
            }]
        },
        options: chartOptions
    } as ChartConfiguration
}

/**
 * The labels of the days of the week, translated in the user's language
 */
export const weekDayLabels = [] as string[];
for (let i = 0; i < 7; i++) {
    const tempDate = new Date("December 1, 2025"); // It was Monday
    tempDate.setHours(24 * i);
    weekDayLabels.push(tempDate.toLocaleDateString(undefined, {weekday: "long"}));
}

/**
 * The options that should be added to all the charts
 */
export const chartOptions: ChartConfiguration["options"] = {
    scales: {
        y: {
            ticks: {
                callback: (value) => { // Replace the ms in the y axis with minutes/seconds
                    return getDisplayedTime(value as number, true);
                }
            }
        }
    },
    plugins: {
        tooltip: {
            callbacks: {
                label: (value) => { // If the dataset has its own label, also that label will be added when hovering the chart. In this way, the user can know, for example, which album the bar refers to
                    return `${value.dataset.label ? `${value.label} – ` : ""}${getDisplayedTime(value.raw as number)}`.trim();
                },
                title: (value) => {
                    return value[0].dataset.label ?? value[0].label;
                }
            }
        }
    },
    responsive: true,
    maintainAspectRatio: false
}

/**
 * Convert milliseconds in human-readable text
 * @param ms the milliseconds to convert
 * @param isMin if the text should be as small as possible (minutes replaced by `min`, seconds by `s`, and so on)
 * @returns the string with the formatted text
 */
export function getDisplayedTime(ms: number, isMin?: boolean) {
    ms = Math.floor(ms / 1000);
    const days = Math.floor(ms / 3600 / 24);
    ms -= days * 3600 * 24;
    const hours = Math.floor(ms / 3600);
    ms -= hours * 3600;
    const minutes = Math.floor(ms / 60);
    ms -= minutes * 60;
    if (isMin) return `${days === 0 ? "" : `${days}d${hours === 0 && minutes === 0 && ms === 0 ? "" : hours === 0 && minutes === 0 ? ` ${lang("and")} ` : ", "}`}${hours === 0 ? "" : `${hours}h${minutes === 0 && ms === 0 ? "" : minutes === 0 ? ` ${lang("and")} ` : ", "}`}${minutes === 0 ? "" : `${minutes}min${ms === 0 ? "" : ` ${lang("and")} `}`}${ms === 0 ? "" : `${ms}s`}`
    return `${days === 0 ? "" : `${days} ${lang(`day${days === 1 ? "" : "s"}`)}${hours === 0 && minutes === 0 ? ` ${lang("and")} ` : ", "}`}${hours === 0 ? "" : `${hours} ${lang(`hour${hours === 1 ? "" : "s"}`)}${minutes === 0 ? ` ${lang("and")} ` : ", "}`}${minutes === 0 ? "" : `${minutes} ${lang(`minute${minutes === 1 ? "" : "s"}`)} ${lang("and")} `}${ms} ${lang(`second${ms === 1 ? "" : "s"}`)}`;
}


export interface ArtistStats {
    songs: StatsDisplayItem[],
    totalMs: number,
    albums: { [key: string]: ArtistStats },
    sortedAlbums: [string, ArtistStats][],
    weekPlays?: number[]
    chart?: {
        perHour?: ChartConfiguration,
        albumsPlayedPerHour?: ChartConfiguration,
        songsPlayedPerHour?: ChartConfiguration,
        perDayOfWeek?: ChartConfiguration,
        perSong?: ChartConfiguration,
        perAlbum?: ChartConfiguration,
        perMonth?: ChartConfiguration,
        albumsPerMonth?: ChartConfiguration,
        songsPerMonth?: ChartConfiguration,
        perYear?: ChartConfiguration,
        albumsPlayedPerYear?: ChartConfiguration
        songsPlayedPerYear?: ChartConfiguration,
        perSongDayOfWeek?: ChartConfiguration
    }
}

export interface StatsDisplayItem {
    playedMs: number,
    data: {
        msPlayedAtHour: number[],
        msPlayedAtWeekDay: number[],
        /**
         * A nested array: divided first by the month the track was played and later by the day of that month the track was played
         */
        msPlayedAtDay: number[][],
        msPlayedAtMonth: number[],
        msPlayedAtYear: { [key: string]: number }
    }
    mostPlayedDay: string,
    mostPlayedMonth: string,
    mostPlayedYear: string,
    songMetadata: MetadataSource,
    source: songsStatsDB
}
