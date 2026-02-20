<script lang="ts">
    import ArtistImageManager from "../../../ts/DataFetcher/ArtistImageManager";
    import { lang } from "../../../ts/SvelteComponentsHelpers/Language";
    import Card from "../../Card.svelte";

    let { img, text, isFirstCard }: { 
        /**
         * The image element where the changes will be previewed
         */
        img: HTMLImageElement; 
        /**
         * The default text that should be written in the textbox
         */
        text: string, 
        /**
         * Changes the card color
         */
        isFirstCard?: boolean 
    } = $props();
    let textSize = 200;
    let font = 'Arial, "sans-serif"';
    let background = "#212121";
    let textColor = "#fafafa";
    /**
     * Renders the new image
     */
    function renderImage() {
        img.src = URL.createObjectURL(
            new Blob(
                [
                    ArtistImageManager.createSvg({
                        str: text,
                        backgroundColor: background,
                        textColor,
                        textFont: font,
                        textSize: textSize.toString(),
                    }).outerHTML,
                ],
                { type: "image/svg+xml" },
            ),
        );
    }
</script>

<Card secondCard={!isFirstCard}>
    <h4>{lang("Text options")}:</h4>
    <label class="flex hcenter gap">
        {lang("Text")}: <input type="text" style={isFirstCard ? "background-color: var(--secondcard)" : undefined} bind:value={text} oninput={renderImage} />
    </label><br />
    <label class="flex hcenter gap">
        {lang("Font size")}: <input
            bind:value={textSize}
            oninput={renderImage}
            style={isFirstCard ? "background-color: var(--secondcard)" : undefined}
            type="number"
        />
    </label><br />
    <label class="flex hcenter gap">
        {lang("Font used")}: <input style={isFirstCard ? "background-color: var(--secondcard)" : undefined} bind:value={font} oninput={renderImage} type="text" />
    </label><br />
    <label class="flex hcenter gap">
        {lang("Background color")}: <input
            bind:value={background}
            onchange={renderImage}
            style={isFirstCard ? "background-color: var(--secondcard)" : undefined}
            type="color"
        />
    </label><br />
    <label class="flex hcenter gap">
        {lang("Text color")}: <input
            bind:value={textColor}
            style={isFirstCard ? "background-color: var(--secondcard)" : undefined}
            onchange={renderImage}
            type="color"
        />
    </label>
</Card>
