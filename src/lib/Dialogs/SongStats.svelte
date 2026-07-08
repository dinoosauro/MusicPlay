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
    let {songMetadata, songStats, closeCallback}: {
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
        closeCallback: () => void
    } = $props();

    let listenedHours = $derived(Math.floor(songStats.totalMs / 1000 / 3600));
    let listenedMinutes = $derived(Math.floor((songStats.totalMs - (listenedHours * 3600 * 1000)) / 1000 / 60));
    let listenedSeconds = $derived(Math.floor((songStats.totalMs - ((listenedMinutes * 60 * 1000) + (listenedHours * 3600 * 1000))) / 1000));
    /**
     * ID of the content that should be displayed in the chart
     */
    let chartOption = $state("days");
    /**
     * Change the chart type
     */
    let chartType = $state("bar");
    /**
     * If even the columns that have a value of "0" should be displayed
     */
    let showEmptyItems = $state(true);
    /**
     * The canvas used to render the chart
     */
    let canvas: HTMLCanvasElement;
    /**
     * Create the stats chart
     * @param chartOption ID of the content that should be displayed in the chart
     * @param chartType the type of the output chart
     * @param showEmptyItems if even the columns that have a value of "0" should be displayed
     */
    async function createChart(chartOption: string, chartType: string, showEmptyItems: boolean) {
        const Chart = await import("chart.js");
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
        // Now let's iterate over all the song activity, and let's populate the previous object
        for (const listening of songStats.activity) {
            const date = new Date(listening.date);
            const key = chartOption === "hours" ? date.getHours().toString() : chartOption === "days" ? date.toLocaleDateString(undefined, {weekday: "long"}) : chartOption === "daysMonth" ? date.getDate().toString() : chartOption === "months" ? date.toLocaleDateString(undefined, {month: "long"}) : date.getFullYear();
            if (!outputObj[key]) outputObj[key] = 0;
            outputObj[key] += listening.duration;
        }
        if (!showEmptyItems) { // Let's remove the empty items
            for (const key in outputObj) {
                if (outputObj[key] === 0) delete outputObj[key];
            }
        }
        let [xAxis, yAxis] = [Object.keys(outputObj), Object.values(outputObj)];
        Chart.Chart.getChart(canvas)?.destroy();
        Chart.Chart.register(Chart.BarController, Chart.BarElement, Chart.CategoryScale, Chart.LinearScale, Chart.Tooltip, Chart.Legend, Chart.PolarAreaController, Chart.DoughnutController, Chart.PieController, Chart.LineController, Chart.ArcElement, Chart.LineElement, Chart.RadialLinearScale, Chart.PointElement);
        Chart.defaults.color = getComputedStyle(document.body).getPropertyValue("--text")
        new Chart.Chart(canvas, {
            type: chartType as "bar",
            data: {
                labels: xAxis,
                datasets: [{
                    label: songMetadata.metadata.title,
                    data: yAxis.map(i => Math.round(i / 1000)),
                    backgroundColor: Settings.customArtColors,
                    borderColor: getComputedStyle(document.body).getPropertyValue("--text")
                }]
            }
        })
    }
    $effect( () => {
        createChart(chartOption, chartType, showEmptyItems);
    });
</script>
<Dialog closeFn={closeCallback}>
    <div class="circularButtonContainer" style="position: fixed; right: calc(15vw + 15px)">
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
    <p>{lang("You've listened to")} {songMetadata.metadata.title} {lang("aproximately")} <strong>{Math.round(songStats.totalPlay)} {lang(`time${Math.round(songStats.totalPlay) === 1 ? "" : "s"}`)}</strong>, {lang("for a total of")} <strong>{listenedHours} {lang(`hour${listenedHours === 1 ? "" : "s"}`)}, {listenedMinutes} {lang(`minute${listenedMinutes === 1 ? "" : "s"}`)} {lang("and")} {listenedSeconds} {lang(`second${listenedSeconds === 1 ? "" : "s"}`)}</strong></p>
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
            {lang("Chart type")}: <select bind:value={chartType}>
                <option value="bar">{lang("Bar")}</option>
                <option value="doughnut">{lang("Doughnut")}</option>
                <option value="line">{lang("Line")}</option>
                <option value="polarArea">{lang("Polar area")}</option>
            </select>
        </label>
        <br>
        <label class="flex hcenter gap">
            <input type="checkbox" bind:checked={showEmptyItems}>
            {lang("Show empty columns")}
        </label><br>
        <canvas bind:this={canvas} style="width: 100%; max-height: 50vh; background-color: var(--card); border-radius: 12px; padding: 15px;"></canvas><br>
        <i>{lang("Data unit: seconds")}</i><br><br>
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