import WriteTextToCanvas from "./WriteTextToCanvas";

interface Props {
    /**
     * Colors used to write the chart title
     */
    colors: {
        background?: string,
        firstText: string,
        secondText: string,
    },
    /**
     * The Context for that chart
     */
    ctx: CanvasRenderingContext2D,
    /**
     * The title that'll be added in the chart
     */
    title: string,
    /**
     * The subtitle that'll be added in the chart (usually, the time interval)
     */
    subtitle: string
}

/**
 * Write the title and the subtitle of the chart/podium in the canvas. Automatically adds the background if passed.
 * @returns the `y` position of the last written line
 */
export default function WriteChartTitle({colors, ctx, title, subtitle}: Props) {
    if (colors.background) {
        ctx.fillStyle = colors.background;
        ctx.fillRect(0, 0, 1080, 1920);
        ctx.fill();
    }
    ctx.fillStyle = colors.firstText;
    ctx.font = "bold 72px Work Sans";
    let y = WriteTextToCanvas({
        text: title,
        ctx,
        startY: 140,
        startX: 100,
        endX: 980
    });
    y += 50;
    ctx.fillStyle = colors.secondText;
    ctx.font = "48px Work Sans";
    y = WriteTextToCanvas({
        text: subtitle,
        ctx,
        startX: 100,
        endX: 980,
        startY: y
    })
    return y;
}