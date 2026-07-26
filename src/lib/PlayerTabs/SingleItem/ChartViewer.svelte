
<script lang="ts">
    import type { ChartConfiguration, ChartDataset } from "chart.js";
    import { lang } from "../../../ts/SvelteComponentsHelpers/Language";
    import Settings from "../../../ts/Settings";
    import { onMount } from "svelte";
    import ExportChart from "../../../ts/ImageCreator/ExportChart";
    import AutoRevokeUrl from "../../../ts/SvelteComponentsHelpers/AutoRevokeUrl";
    import IconsManager from "../../../ts/Icons/IconsManager";
    import Dialog from "../../Dialog.svelte";
    import Card from "../../Card.svelte";
    import ExportCanvasButtons from "../../Dialogs/ExportCanvasButtons.svelte";

    let canvas: HTMLCanvasElement;
    let {chartObject, inputSecondColor, canvasCallback, exportInfo}: {
        /**
         * The object used to render the chart
        */
        chartObject: ChartConfiguration, 
        /**
         * If the input to change the chart type should be brighter
        */
        inputSecondColor?: boolean, 
        /**
         * Callback called immediately after the ChartViewer has been mounted. It returns the canvas used to draw the chart
         * @param canvas the Canvas where the chart has been drawn
         */
        canvasCallback?: (canvas: HTMLCanvasElement) => void, 
        /**
         * Information used to export the chart
         */
        exportInfo: {
            /**
             * The title that'll be added on top of the chart
             */
            title: string,
            /**
             * A string that indicates the interval to which the chart refers to
             */
            dateInterval: string
    }} = $props();
    let chartType = $state("bar");
    /**
     * A non-proxy version of the Chart object, so that Chart.js won't throw an exception while reading it
    */
    let parsedObj: ChartConfiguration = $state.snapshot(chartObject) as ChartConfiguration;
    $effect(() => {
        function main(chartObject: ChartConfiguration, chartType: string) {
            import("chart.js").then(({Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend, PolarAreaController, DoughnutController, PieController, LineController, ArcElement, LineElement, RadialLinearScale, PointElement}) => {
                Chart.getChart(canvas)?.destroy();
                Chart.defaults.color = getComputedStyle(document.body).getPropertyValue("--text");
                Chart.defaults.font.family = `"Work Sans", sans-serif`;
                Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend, PolarAreaController, DoughnutController, PieController, LineController, ArcElement, LineElement, RadialLinearScale, PointElement);
                chartObject.type = chartType as "bar";
                parsedObj = $state.snapshot(chartObject) as ChartConfiguration;
                if (!parsedObj.options) parsedObj.options = {};
                if (!parsedObj.options.plugins) parsedObj.options.plugins = {};
                if (parsedObj.data.datasets.length === 1 && chartType !== "doughnut" && chartType !== "polarArea") { // Remove the legend
                    if (!parsedObj.options.plugins.legend) parsedObj.options.plugins.legend = {};
                    parsedObj.options.plugins.legend.display = false;
                } 
                if (chartType === "bar") { // Update the border radius of the bars
                    for (const dataset of parsedObj.data.datasets) dataset.borderRadius = 12;
                }
                if (chartType === "line") { 
                    if (chartObject.data.datasets.length === 1) { // There's only a dataset, let's color each part of the line with a different color
                        parsedObj.data.datasets[0].segment = {
                            borderColor: ctx => Settings.customChartColors[ctx.p0DataIndex % Settings.customChartColors.length]
                        }
                    } else { // There are multiple dataset (and so multiple lines), let's make each line in the dataset of a different color
                        for (let i = 0; i < parsedObj.data.datasets.length; i++) {
                            parsedObj.data.datasets[i].borderColor = Settings.customChartColors[i % Settings.customChartColors.length];
                        }
                    }
                } else if (chartType === "doughnut" && parsedObj.data.datasets.length > 1) { // Let's add a label in the bottom part of the chart so that the user knows the name of each doughnut
                    for (const dataset of parsedObj.data.datasets) dataset.backgroundColor = Settings.customChartColors;
                    Chart.register({
                        id: "ringLabels",
                        afterDraw: (chart) => {
                            for (let i = 0; i < chart.data.datasets.length; i++) {
                                const meta = chart.getDatasetMeta(i);
                                const arc = meta.data[0];
                                if (!arc) return;
                                const midRadius = (arc.innerRadius + arc.outerRadius) / 2;
                                chart.ctx.save();
                                chart.ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--text");
                                chart.ctx.font = `14px "Work Sans"`;
                                chart.ctx.textAlign = 'center';
                                chart.ctx.fillText(chart.data.datasets[i].label ?? "", arc.x + Math.cos(Math.PI / 2) * midRadius, arc.y + Math.sin(Math.PI / 2) * midRadius);
                                chart.ctx.restore();
                            }                            
                        }
                    });
                }
                parsedObj.options.animation = {duration: 800}
                // @ts-ignore
                new Chart(canvas, parsedObj);
            })
        }
        main(chartObject, chartType);
    })
    onMount(() => canvasCallback && canvasCallback(canvas));
    let showExportDialog = $state(false);
    /**
     * The canvas used to draw the image that'll be shared/exported
    */
    let exportCanvas: HTMLCanvasElement | undefined = $state();
    /**
     * The colors used for the text and the background of the exported image
    */
    let exportColors = $state({background: getComputedStyle(document.body).getPropertyValue("--background"), firstText: getComputedStyle(document.body).getPropertyValue("--text"), secondText: getComputedStyle(document.body).getPropertyValue("--secondtext"), chartText: getComputedStyle(document.body).getPropertyValue("--text"), gridLines: getComputedStyle(document.body).getPropertyValue("--secondcard")});
    /**
     * If a background color should be added when exporting the chart
     */
    let showBackgroundColor = $state(true);
    /**
     * If grid lines should be visible when exporting the chart
    */
    let showGridLines = $state(true);
    $effect(() => {
        async function rerenderChart(exportCanvas: HTMLCanvasElement, colors: typeof exportColors, showBackgroundColor: boolean, showGridLines: boolean) {
            const ctx = exportCanvas.getContext("2d");
            ctx?.clearRect(0, 0, exportCanvas.width, exportCanvas.height);
            ctx?.drawImage(await ExportChart({type: exportInfo.title, dateInterval: exportInfo.dateInterval, chart: parsedObj, colors: {
                ...colors,
                background: showBackgroundColor ? colors.background : undefined,
                gridLines: showGridLines ? colors.gridLines : undefined
            }}), 0, 0)
        }
        if (exportCanvas) rerenderChart(exportCanvas, exportColors, showBackgroundColor, showGridLines);
    })
</script>
<div>
    <label class="flex hcenter gap">
        {lang("Chart style")}: <select bind:value={chartType} style={inputSecondColor ? "background-color: var(--secondcard)" : undefined}> 
            <option value="bar">{lang("Bar")}</option>
            <option value="doughnut">{lang("Doughnut")}</option>
            <option value="line">{lang("Line")}</option>
            <option value="polarArea">{lang("Polar area")}</option>
        </select>
            <button class="emptyButton flex hcenter wcenter circularButton hoveredBtn" style={`background-color: var(--${inputSecondColor ? "second" : ""}card)`} onclick={async () => {
                showExportDialog = true;
            }}>
                <img use:AutoRevokeUrl style="width: 24px; height: 24px; padding: 5px" src={IconsManager.getIconObjectUrl("shareios")} alt={lang("Export and/or share")}>
            </button>
    </label><br>
    <div style="width: 100%; min-width: 0; position: relative">
        <canvas bind:this={canvas} style="width: 100%;"></canvas>
    </div>
</div>

{#if showExportDialog} 
<Dialog closeFn={() => (showExportDialog = false)}>
    <div class="circularButtonContainer" style="position: fixed; right: calc(15vw + 15px + env(safe-area-inset-right))">
        <button class="circularButton emptyButton flex hcenter gap" style="width: fit-content; display: flex;" onclick={() => (showExportDialog = false)} title={lang("Close image export dialog")}>
            <img
                src={IconsManager.getIconObjectUrl("dismiss")}
                class="icon"
                use:AutoRevokeUrl
                alt={lang("Close image export dialog")}
            />
        </button>
    </div>
    <h3>{lang("Chart export options")}:</h3>
        <div class="flex hcenter gap" style="flex-direction: column">
            <div class="flex wcenter">
                <canvas width="1080" height="1920" bind:this={exportCanvas} style="max-height: 50vh; width: auto"></canvas>
            </div>
            <div class="maxWidth">
                <Card secondCard={true}>
                    <label class="flex hcenter gap">
                        <input type="checkbox" bind:checked={showBackgroundColor}>
                        {lang("Background color")}: <input type="color" bind:value={exportColors.background}>
                    </label><br>
                    <label class="flex hcenter gap">
                        {lang("Text color")}: <input type="color" bind:value={exportColors.firstText}>
                    </label><br>
                    <label class="flex hcenter gap">
                        {lang("Secondary text color")}: <input type="color" bind:value={exportColors.secondText}>
                    </label><br>
                    <label class="flex hcenter gap">
                        {lang("Chart text color")}: <input type="color" bind:value={exportColors.chartText}>
                    </label><br>
                    <label class="flex hcenter gap">
                        <input type="checkbox" bind:checked={showGridLines}>
                        {lang("Grid lines color")}: <input type="color" bind:value={exportColors.gridLines}>
                    </label><br>
                    <i>{lang("You can customize the chart colors from the Settings")}.</i>
                </Card>
            </div>
        </div><br>
        <ExportCanvasButtons canvas={exportCanvas} fileName={`${exportInfo.title} [${exportInfo.dateInterval}].png`}></ExportCanvasButtons>
</Dialog>
{/if}