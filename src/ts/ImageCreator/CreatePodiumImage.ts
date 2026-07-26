import type { DatabaseContainer, metadataDB } from "../Database/DatabaseInterfaces";
import ArtistImageManager from "../DataFetcher/ArtistImageManager";
import GetAlbumArt from "../DataFetcher/GetAlbumArt";
import GetAlbumArtId from "../DataFetcher/GetAlbumArtId";
import type { MetadataSource } from "../Player/PlayerInterfaces";
import { lang } from "../SvelteComponentsHelpers/Language";
import WriteChartTitle from "./WriteChartTitle";
import WriteTextToCanvas from "./WriteTextToCanvas";

/**
 * Information to create an item in the Podium
 */
export interface PodiumInfo {
    metadata: MetadataSource,
    firstLine: string,
    secondLine?: string,
    thirdLine?: string,
}

export interface ChartColorInfo {
    background?: string,
    firstText: string,
    firstPlaceBackground: string,
    secondText: string,
    secondPlaceBackground: string,
    thirdPlaceBackground: string,
    firstPlaceText: string,
    secondPlaceText: string,
    thirdPlaceText: string
}

export interface PodiumProps {
    /**
     * List of information about the tracks used to create the Podium
     */
    podiumInfo: PodiumInfo[],
    /**
     * Basically, the title that'll be added on top of the podium 
     */
    type: string,
    /**
     * A string that indicates the interval to which the podium refers to
     */
    dateInterval: string,
    /**
     * Database container
     */
    databases: DatabaseContainer,
    /**
     * Colors used to create the pdoium
     */
    colors: ChartColorInfo
}

/**
 * Create an image of the podium that can be shared
 * @returns a canvas with the image drawn
 */
export async function CreatePodiumImage({podiumInfo, type, dateInterval, databases, colors}: PodiumProps) {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;
    // First step: write the title
    let y = WriteChartTitle({colors, ctx, title: type, subtitle: dateInterval});
    y += 50;
    /**
     * The width that each column of the podium should have
     */
    let podiumColumnWidth = (880 - (20 * 2)) / 3;
    /**
     * The space that should be left at the bottom of the podium
     */
    const bottomSpace = 520 + (podiumInfo.length > 4 ? 200 : podiumInfo.length > 3 ? 100 : 0);
    /**
     * Maximum height of the podium column
     */
    let maxPodiumColumnHeight = 1920 - y - podiumColumnWidth - bottomSpace;
    /**
     * The `y` position in the canvas in the lowest point of the podium.
     * This value depends on how many lines were required to write the text.
     */
    let yAfterPodium = 0;
    for (const i of [1, 0, 2]) {
        const albumArt = type === lang("My top artists") ? await ArtistImageManager.fetchImage({author: podiumInfo[i].firstLine, artistImageDb: databases.artistImgDb}) : await GetAlbumArt({
            db: databases.albumArtDb, 
            id: GetAlbumArtId({albumAuthor: podiumInfo[i].metadata.metadata.albumArtist,year: podiumInfo[i].metadata.metadata.year, albumName: podiumInfo[i].metadata.metadata.album}),
        })
        // Step 2: draw the column of the podium
        let podiumColumnHeight = maxPodiumColumnHeight - (maxPodiumColumnHeight * 20 * i / 100);
        ctx.fillStyle = colors[`${i === 0 ? "first" : i === 1 ? "second" : "third"}PlaceBackground` as "firstPlaceBackground"];
        ctx.save();
        ctx.beginPath();
        let rectPosition = i === 0 ? 1 : i === 1 ? 0 : i;
        const startX = 100 + (podiumColumnWidth * rectPosition) + (20 * rectPosition);
        const startY = 1920 - bottomSpace - podiumColumnHeight;
        ctx.roundRect(startX, startY, podiumColumnWidth, podiumColumnHeight, 24);
        ctx.fill();
        // Step 3: draw the album art on top of the podium. 
        const img = new Image();
        await new Promise(res => {
            img.onload = res;
            img.onerror = res;
            img.src = URL.createObjectURL(albumArt);
        });
        ctx.save();
        const [startImgX, startImgY, widthImg, heightImg] = [startX, startY - 20 - podiumColumnWidth, podiumColumnWidth, podiumColumnWidth];
        ctx.beginPath();
        ctx.roundRect(startImgX, startImgY, widthImg, heightImg, 24);
        ctx.clip();
        // Before drawing the image, we need to scale it so that it's centered.
        const scale = Math.max(widthImg / img.width, heightImg / img.height);
        const drawWidth = img.width * scale;
        const drawHeight = img.height * scale;
        const offsetX = startImgX + (widthImg - drawWidth) / 2;
        const offsetY = startImgY + (heightImg - drawHeight) / 2;
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
        ctx.restore();
        URL.revokeObjectURL(img.src);
        // Now let's write the text below the podium
        ctx.fillStyle = colors.firstText;
        ctx.font = "32px Work Sans";
        let yAfterWrite = WriteTextToCanvas({
            text: podiumInfo[i].firstLine,
            ctx,
            startY: 1920 - bottomSpace + 60,
            startX,
            endX: startX + podiumColumnWidth - 10,
            maxLines: 3 
        });
        ctx.fillStyle = colors.secondText;
        ctx.font = "28px Work Sans";
        if (podiumInfo[i].secondLine) yAfterWrite = WriteTextToCanvas({
            text: podiumInfo[i].secondLine,
            ctx,
            startY: yAfterWrite + 20,
            startX,
            endX: startX + podiumColumnWidth - 10,
            maxLines: 2
        });
        ctx.fillStyle = colors[`${i === 0 ? "first" : i === 1 ? "second" : "third"}PlaceText` as "firstPlaceText"];
        if (podiumInfo[i].thirdLine) yAfterWrite = WriteTextToCanvas({
            text: podiumInfo[i].thirdLine,
            ctx,
            startY: yAfterWrite + 20,
            startX,
            endX: startX + podiumColumnWidth,
        });
        yAfterPodium = Math.max(yAfterPodium, yAfterWrite);
    };
    // Now let's write the text for the fourth and fifth position (obviously they won't have the podium bar)
    ctx.fillStyle = colors.secondText;
    yAfterPodium += 30;
    for (let i = 3; i < Math.min(podiumInfo.length, 5); i++) {
        yAfterPodium = WriteTextToCanvas({
            text: `${i+1}: ${podiumInfo[i].firstLine}${podiumInfo[i].secondLine ? ` – ${podiumInfo[i].secondLine}` : ""}`,
            ctx,
            startX: 100,
            endX: 980,
            startY: yAfterPodium + 50,
            maxLines: 2
        });
        if (podiumInfo[i].thirdLine) yAfterPodium = WriteTextToCanvas({
            text: podiumInfo[i].thirdLine as string,
            ctx,
            startX: 100,
            endX: 980,
            startY: yAfterPodium,
            maxLines: 1
        });
    }
    return canvas;    
}

