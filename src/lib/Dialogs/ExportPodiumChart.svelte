<script lang="ts">
    import type { DatabaseContainer } from "../../ts/Database/DatabaseInterfaces";
    import IconsManager from "../../ts/Icons/IconsManager";
    import { CreatePodiumImage, type PodiumInfo, type PodiumProps } from "../../ts/ImageCreator/CreatePodiumImage";
    import AutoRevokeUrl from "../../ts/SvelteComponentsHelpers/AutoRevokeUrl";
    import { lang } from "../../ts/SvelteComponentsHelpers/Language";
    import Card from "../Card.svelte";
    import Dialog from "../Dialog.svelte";
    import ExportCanvasButtons from "./ExportCanvasButtons.svelte";
    let {closeFn, podiumInfo, type, dateInterval, databases}: {
        /**
         * Function called to close the Dialog
         */
        closeFn: () => void, 
        /**
         * Information about the tracks that should be added to the podium
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
        databases: DatabaseContainer
    } = $props();
    /**
     * Information used to create the chart
     */
    let exportInfo = $state<PodiumProps>({
        podiumInfo,
        type,
        dateInterval,
        databases,
        colors: {
            background: getComputedStyle(document.body).getPropertyValue("--background"),
            firstText: getComputedStyle(document.body).getPropertyValue("--text"),
            secondText: getComputedStyle(document.body).getPropertyValue("--secondtext"),
            firstPlaceBackground: getComputedStyle(document.body).getPropertyValue("--firstplacebg"),
            secondPlaceBackground: getComputedStyle(document.body).getPropertyValue("--secondplacebg"),
            thirdPlaceBackground: getComputedStyle(document.body).getPropertyValue("--thirdplacebg"),
            firstPlaceText: getComputedStyle(document.body).getPropertyValue("--firstplace"),
            secondPlaceText: getComputedStyle(document.body).getPropertyValue("--secondplace"),
            thirdPlaceText: getComputedStyle(document.body).getPropertyValue("--thirdplace")
        }
    });
    /**
     * If true, the background color will be added to the chart
     */
    let addBackground = $state(true);
    /**
     * If true, the 4th and 5th position will be added at the bottom of the chart
     */
    let addExtraPositions = $state(true);
    $effect(() => {
        /**
         * Generate the new canvas
         * @param data all the information and settings for the new podium image
         * @param addExtraPositions if the 4th and 5th position should be added at the bottom of the podium
         */
        async function updateCanvas(data: PodiumProps, addExtraPositions: boolean) {
            const ctx = canvas.getContext("2d");
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
            ctx?.drawImage(await CreatePodiumImage(addExtraPositions ? data : {...data, podiumInfo: data.podiumInfo.slice(0, 3)}), 0, 0);
        }
        updateCanvas({
            ...exportInfo,
            colors: {
                ...exportInfo.colors,
                background: addBackground ? exportInfo.colors.background : undefined
            }
        }, addExtraPositions);
    })
    /**
     * Canvas where the image should be drawn
     */
    let canvas: HTMLCanvasElement;
</script>
<Dialog {closeFn}>
    <div class="circularButtonContainer" style="position: fixed; right: calc(15vw + 15px + env(safe-area-inset-right))">
        <button class="circularButton emptyButton flex hcenter gap" style="width: fit-content; display: flex;" onclick={() => closeFn()} title={lang("Close image export dialog")}>
            <img
                src={IconsManager.getIconObjectUrl("dismiss")}
                class="icon"
                use:AutoRevokeUrl
                alt={lang("Close image export dialog")}
            />
        </button>
    </div>
    <h3>{lang("Export your podium")}:</h3>
    <div class="flex hcenter gap" style="flex-direction: column">
        <div class="flex wcenter">
            <canvas width="1080" height="1920" bind:this={canvas} style="max-height: 50vh; width: auto"></canvas>
        </div>
        <div class="maxWidth">
        <Card secondCard={true}>
            <label class="flex hcenter gap">
                <input type="checkbox" bind:checked={addExtraPositions}>{lang("Add fourth and fifth song if available")}
            </label><br>
            <label class="flex hcenter gap">
                <input type="checkbox" bind:checked={addBackground}>
                {lang("Background color")}:
                <input type="color" bind:value={exportInfo.colors.background}>
            </label><br>
            <label class="flex hcenter gap">
                {lang("Main text color")}: <input type="color" bind:value={exportInfo.colors.firstText}>
            </label><br>
            <label class="flex hcenter gap">
                {lang("Secondary text color")}: <input type="color" bind:value={exportInfo.colors.secondText}>
            </label><br>
            <Card>
                <h4>{lang("Podium color for first/second/third place")}:</h4>
                <div class="flex hcenter gap">
                    <input type="color" bind:value={exportInfo.colors.firstPlaceBackground}>
                    <input type="color" bind:value={exportInfo.colors.secondPlaceBackground}>
                    <input type="color" bind:value={exportInfo.colors.thirdPlaceBackground}>
                </div>
            </Card><br>
            <Card>
                <h4>{lang("Podium text color for first/second/third place")}:</h4>
                <div class="flex hcenter gap">
                    <input type="color" bind:value={exportInfo.colors.firstPlaceText}>
                    <input type="color" bind:value={exportInfo.colors.secondPlaceText}>
                    <input type="color" bind:value={exportInfo.colors.thirdPlaceText}>
                </div>
            </Card>
        </Card>
        </div>
    </div><br>
    <ExportCanvasButtons {canvas} fileName={`TopStats-${type} [${dateInterval}].png`}></ExportCanvasButtons>
</Dialog>

<style>
    .adaptiveFlex {
        display: flex;
    }
</style>