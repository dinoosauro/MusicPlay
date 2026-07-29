<script lang="ts">
    import ArtistImageManager from "../../ts/DataFetcher/ArtistImageManager";
    import AutoRevokeUrl from "../../ts/SvelteComponentsHelpers/AutoRevokeUrl";
    import type { songsStatsDB } from "../../ts/Database/DatabaseInterfaces";
    import IconsManager from "../../ts/Icons/IconsManager";
    import type { MetadataSource } from "../../ts/Player/PlayerInterfaces";
    import Card from "../Card.svelte";
    import Dialog from "../Dialog.svelte";
    import { lang } from "../../ts/SvelteComponentsHelpers/Language";
    import Settings from "../../ts/Settings";
    import { chartOptions } from "../../ts/SvelteComponentsHelpers/GetChartFromArtistStats";
    import type { ChartConfiguration } from "chart.js";
    import ChartViewer from "../PlayerTabs/SingleItem/ChartViewer.svelte";
    import { onMount } from "svelte";
    import GetIntervalBetweenDates from "../../ts/SvelteComponentsHelpers/GetIntervalBetweenDates";
    import { getIfDateShouldBeSkipped, SkipDate } from "../../ts/SvelteComponentsHelpers/GetStatsDisplayItem";
    let {songMetadata, songStats, closeCallback, timeRange}: {
        /**
         * The metadata of the song whose stats should be shown
         */
        songMetadata: MetadataSource,
        /**
         * The database entry of the song stats of the track
         */
        songStats: songsStatsDB,
        /**
         * Function called to close the dialog
         */
        closeCallback: () => void,
        /**
         * The default time range the dialog should use when reading all the stats
         */
        timeRange?: "week" | "month" | "year" | "all" | number[]
    } = $props();

    /**
     * The interval of time where the stats have been fetched
     */
    let startTime = $state<"week" | "month" | "year" | "all" | number[]>(timeRange ?? "all");
    /**
     * If the user should be able to pick a custom number
     */
    let showDateRange = $state(Array.isArray(startTime));
    /**
     * The total milliseconds of playback in the current audio interval
     */
    let totalMs = $state(songStats.totalMs);

    let listenedHours = $derived(Math.floor(totalMs / 1000 / 3600));
    let listenedMinutes = $derived(Math.floor((totalMs - (listenedHours * 3600 * 1000)) / 1000 / 60));
    let listenedSeconds = $derived(Math.floor((totalMs - ((listenedMinutes * 60 * 1000) + (listenedHours * 3600 * 1000))) / 1000));
    /**
     * ID of the content that should be displayed in the chart
     */
    let chartOption = $state("days");
    /**
     * If even the columns that have a value of "0" should be displayed
     */
    let showEmptyItems = $state(true);
    /**
     * The Chart.Js object 
     */
    let chartContent: ChartConfiguration | undefined = $state();
    /**
     * The canvas used to render the chart
     */
    let canvas: HTMLCanvasElement;
    /**
     * Create the stats chart
     * @param chartOption ID of the content that should be displayed in the chart
     * @param showEmptyItems if even the columns that have a value of "0" should be displayed
     */
    async function createChart(chartOption: string, showEmptyItems: boolean) {
        let outputObj: {[key: string]: number} = {};
        // We now need to create all the possible keys for the user's choice. We need to do this so that, even if the `showEmptyItems` property is false, the list will always be ordered
        switch(chartOption) {
            case "months": {
                for (let i = 0; i <= 11; i++) {
                    const date = new Date();
                    date.setMonth(i);
                    const text = date.toLocaleDateString(undefined, {month: "long"});
                    if (!outputObj[text]) outputObj[text] = 0;
                }
                break;
            }
            case "days": {
                for (let i = 0; i <= 6; i++) {
                    const date = new Date("December 1, 2025"); // December 1, 2025 was Monday
                    date.setHours(24 * i);
                    const text = date.toLocaleDateString(undefined, {weekday: "long"});
                    if (!outputObj[text]) outputObj[text] = 0;
                }
                break;
            }
            case "daysMonth": 
            case "hours": {
                for (let i = chartOption === "hours" ? 0 : 1; i <= (chartOption === "hours" ? 23 : 31); i++) {
                    if (!outputObj[i.toString()]) outputObj[i.toString()] = 0;
                }
                break;
            }
        }
        let tempMs = 0;
        // Now let's iterate over all the song activity, and let's populate the previous object. We'll start from the last item, since it's the most recent one (and so, we'll be able to break the array when we'll find an item with a previous date)
        for (let i = (songStats.activity.length - 1); i >= 0; i--) {
            const date = new Date(songStats.activity[i].date);
            const whatShouldWeDo = getIfDateShouldBeSkipped(startTime, date, songStats.activity[i].date);
            if (whatShouldWeDo === SkipDate.BREAK) break;
            if (whatShouldWeDo === SkipDate.CONTINUE) continue;
            const key = chartOption === "hours" ? date.getHours().toString() : chartOption === "days" ? date.toLocaleDateString(undefined, {weekday: "long"}) : chartOption === "daysMonth" ? date.getDate().toString() : chartOption === "months" ? date.toLocaleDateString(undefined, {month: "long"}) : date.getFullYear().toString();
            if (typeof outputObj[key] === "undefined") {
                outputObj[key] = 0;
            }
            outputObj[key] += songStats.activity[i].duration;
            tempMs += songStats.activity[i].duration;
        }
        totalMs = tempMs;
        if (!showEmptyItems) { // Let's remove the empty items
            for (const key in outputObj) {
                if (outputObj[key] === 0) delete outputObj[key];
            }
        }
        chartContent = {
            type: "bar",
            data: {
                labels: Object.keys(outputObj),
                datasets: [{
                    data: Object.values(outputObj),
                    backgroundColor: Settings.customChartColors,
                    borderColor: getComputedStyle(document.body).getPropertyValue("--text")
                }]
            },
            options: chartOptions
        }
    }
    $effect( () => {
        createChart(chartOption, showEmptyItems);
    });

    let intervalSelect: HTMLSelectElement;
    onMount(() => { // Update the select value
        intervalSelect.value = Array.isArray(startTime) ? "custom" : startTime;
    })
</script>
<Dialog closeFn={closeCallback}>
    <div class="circularButtonContainer" style="position: fixed; right: calc(15vw + 15px + env(safe-area-inset-right))">
        <button
    class="circularButton emptyButton flex hcenter gap" style="width: fit-content; display: flex;"
    onclick={() => closeCallback()}
    title={lang("Close stats dialog")}
>
    <img
        src={IconsManager.getIconObjectUrl("dismiss")}
        class="icon"
        use:AutoRevokeUrl
        alt={lang("Close stats dialog")}
    />
</button>
    </div>
    <h3>{lang("Stats about")} <i>{songMetadata.metadata.title}</i></h3>
    <label>
        {lang("Show data about")}:
        <select bind:this={intervalSelect} style="width: fit-content; background-color: var(--secondcard)" onchange={(e) => {
        const value = (e.target as HTMLInputElement).value;
        if (value === "week" || value === "month" || value === "year" || value === "all") {
            startTime = value;
            showDateRange = false;
        } else {
            showDateRange = true;
            startTime = [];
            return;
        }
            createChart(chartOption, showEmptyItems);
        }}>
            <option value="all">{lang("all time")}</option>
            <option value="week">{lang("this week")}</option>
            <option value="month">{lang("this month")}</option>
            <option value="year">{lang("this year")}</option>
            <option value="custom">{lang("custom")}</option>
        </select>
        {#if showDateRange}
        {lang("from")}: <input defaultValue={Array.isArray(startTime) ? (() => {
            if (startTime.length !== 2) return;
            // Let's create a new date, and then extract the string in the `YYYY-MM-DDTHH:MM` format, that is the one required by the datetime-local input
            const date = new Date(startTime[0]);
            date.setTime(date.valueOf() - (60000 * date.getTimezoneOffset())); // Since the source of the date is another `datetime-local` input, we'll need to remove the automatic timezone change applied
            const str = date.toISOString();
            return str.substring(0, str.indexOf(":") + 3);
        })() : undefined} style="width: fit-content; background-color: var(--secondcard)" type="datetime-local" onchange={(e) => {
            if (!Array.isArray(startTime)) startTime = [];
            startTime[0] = new Date((e.target as HTMLInputElement).value).getTime();
            if (typeof startTime[1] !== "undefined") createChart(chartOption, showEmptyItems);
        }}>
        to: <input style="width: fit-content; background-color: var(--secondcard)" type="datetime-local" defaultValue={Array.isArray(startTime) ? (() => {
            if (startTime.length !== 2) return;
            // Let's create a new date, and then extract the string in the `YYYY-MM-DDTHH:MM` format, that is the one required by the datetime-local input
            const date = new Date(startTime[1]);
            date.setTime(date.valueOf() - (60000 * date.getTimezoneOffset())); // Since the source of the date is another `datetime-local` input, we'll need to remove the automatic timezone change applied
            const str = date.toISOString();
            return str.substring(0, str.indexOf(":") + 3);
        })() : undefined} onchange={(e) => {
            if (!Array.isArray(startTime)) startTime = [];
            startTime[1] = new Date((e.target as HTMLInputElement).value).getTime();
            if (typeof startTime[0] !== "undefined") createChart(chartOption, showEmptyItems);
        }}>
        {/if}
    </label>
    <p>{lang("You've listened to")} {songMetadata.metadata.title} {lang("aproximately")} <strong>{Math.round(totalMs / (songMetadata.metadata.duration * 1000))} {lang(`time${Math.round(Math.round(totalMs / (songMetadata.metadata.duration * 1000))) === 1 ? "" : "s"}`)}</strong>, {lang("for a total of")} <strong>{listenedHours} {lang(`hour${listenedHours === 1 ? "" : "s"}`)}, {listenedMinutes} {lang(`minute${listenedMinutes === 1 ? "" : "s"}`)} {lang("and")} {listenedSeconds} {lang(`second${listenedSeconds === 1 ? "" : "s"}`)}</strong></p>
    <Card secondCard={true}>
        <h4>{lang("When you've listened to")} {songMetadata.metadata.title}</h4>
        <label class="flex hcenter gap">
            {lang("Show the")}
            <select bind:value={chartOption}>
                <option value="hours">{lang("hours of the day")}</option>
                <option value="days">{lang("days of the week")}</option>
                <option value="daysMonth">{lang("days of the month")}</option>
                <option value="months">{lang("months of the year")}</option>
                <option value="years">{lang("years")}</option>
            </select>
        </label><br>
        <label class="flex hcenter gap">
            <input type="checkbox" bind:checked={showEmptyItems}>
            {lang("Show empty columns")}
        </label><br>
        {#if chartContent}
            <Card>
                <ChartViewer exportInfo={{
                    dateInterval: GetIntervalBetweenDates(startTime),
                    alternativeTitles: [{
                        description: lang("Default"),
                        title: `${lang("Listens of")} ${songMetadata.metadata.title}, ${lang("divided by")} ${chartOption === "daysMonth" ? lang("days of the month") : lang(chartOption.substring(0, chartOption.length - 1))}`
                    }, {
                        description: lang("Without the division"),
                        title:  `${lang("Listens of")} ${songMetadata.metadata.title}`
                    }]
                    }} inputSecondColor={true} canvasCallback={(c) => (canvas = c)} chartObject={chartContent}></ChartViewer>
            </Card><br>
        {/if}
        <div class="flex hcenter gap">
            <button class="btn" onclick={() => {
                canvas.toBlob((blob) => {
                    if (!blob) return;
                    const a = Object.assign(document.createElement("a"), {
                        href: URL.createObjectURL(blob),
                        target: "_blank",
                        download: `[PlaybackStats] ${songMetadata.metadata.title} - ${songMetadata.metadata.artist}.png`
                    });
                    a.click();
                })
            }}>{lang("Download chart")}</button>
            <button class="btn" onclick={() => {
                const a = Object.assign(document.createElement("a"), {
                    href: URL.createObjectURL(new Blob([JSON.stringify(songStats)], {type: "application/json"})),
                    target: "_blank",
                    download: `[PlaybackStats] ${songMetadata.metadata.title} - ${songMetadata.metadata.artist}.json`
                });
                a.click();
            }}>{lang("Export stats")}</button>
        </div>
    </Card>
</Dialog>