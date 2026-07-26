import type { ChartConfiguration } from "chart.js";
import WriteChartTitle from "./WriteChartTitle";
import { chartOptions } from "../SvelteComponentsHelpers/GetChartFromArtistStats";

interface Props {
    /**
     * The title that'll be added on top of the chart
     */
    type: string,
    /**
     * A string that indicates the interval to which the chart refers to
     */
    dateInterval: string,
    /**
     * The object used to create the chart using Chart.js
     */
    chart: ChartConfiguration,
    /**
     * Colors used for this chart
     */
    colors: {
        background?: string,
        firstText: string,
        secondText: string,
        chartText: string,
        gridLines?: string
    }
}
export default async function ExportChart({type, dateInterval, chart, colors}: Props) {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;
    // First step: let's write the title
    ctx.fillStyle = colors.firstText;
    ctx.font = "bold 72px Work Sans";
    let y = WriteChartTitle({colors, ctx, title: type, subtitle: dateInterval});
    y += 50;
    let availableCanvasHeight = 1920 - (2 * 140) - y;
    // Let's create the chart in a separated canvas, we'll later draw the new canvas in the old one.
    const chartCanvas = document.createElement("canvas");
    chartCanvas.width = 880;
    chartCanvas.height = availableCanvasHeight;
    const chartCtx = chartCanvas.getContext("2d");
    if (!chartCtx) return canvas;
    const chartJs = await import("chart.js");
    await new Promise<void>(res => {
        new chartJs.Chart(chartCtx, {
            ...chart,
            options: {
                ...chart.options,
                plugins: {
                    ...chart.options?.plugins,
                    legend: {
                        ...chart.options?.plugins?.legend,
                        labels: {
                            ...chart.options?.plugins?.legend?.labels,
                            color: colors.chartText,
                            padding: 20,
                            font: {
                                ...chart.options?.plugins?.legend?.labels?.font,
                                size: 28,
                            }
                        }
                    }
                },
                scales: {
                    ...chart.options?.scales,
                    x: {
                        ...chart.options?.scales?.x,
                        grid: {
                            ...chart.options?.scales?.x?.grid,
                            color: colors.gridLines ?? "transparent"
                        },
                        ticks: {
                            ...chart.options?.scales?.x?.ticks,
                            color: colors.chartText,
                            font: {
                                ...chart.options?.scales?.x?.ticks?.font,
                                size: 28
                            }
                        }
                    },
                    y: {
                        ...chart.options?.scales?.y,
                        grid: {
                            ...chart.options?.scales?.y?.grid,
                            color: colors.gridLines ?? "transparent"
                        },
                        ticks: {
                            ...chart.options?.scales?.y?.ticks,
                            color: colors.chartText,
                            font: {
                                ...chart.options?.scales?.y?.ticks?.font,
                                size: 28
                            }
                        }
                    }
                },
                responsive: false, // Essential: without this the chart wouldn't be created
                devicePixelRatio: 1, // We don't need special scaling
                animation: { // Let's add an animation so that we can know when the chart has been rendered
                    duration: 50,
                    onComplete: () => { 
                        res();
                    }
                }
            },
            plugins: [{ // Plugin used so that the chart box will be a little bit separated from the legend
                id: "addExtraMargin",
                beforeInit(chart) {
                    if (!chart.legend) return;
                    const originalFit = chart.legend.fit;
                    chart.legend.fit = function fit() {
                        originalFit.bind(chart.legend)();
                        this.height += 35; 
                    };
                }

            }]
        });
    })
    ctx.drawImage(chartCanvas, 100, y, 880, availableCanvasHeight);
    chartJs.Chart.getChart(chartCtx)?.destroy();
    return canvas;
}