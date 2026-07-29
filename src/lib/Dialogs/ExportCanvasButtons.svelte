<script lang="ts">
    import { lang } from "../../ts/SvelteComponentsHelpers/Language";

const {canvas, fileName}: {
    /**
     * The canvas where the image to export has been drawn
     */
    canvas: HTMLCanvasElement, 
    /**
     * The suggested name for the output file
     */
    fileName: string
} = $props();
</script>

<div class="flex hcenter gap">
        <button class="emptyButton maxWidth btn" onclick={() => {
            canvas.toBlob((blob) => {
                if (!blob) return;
                const a = Object.assign(document.createElement("a"), {
                    href: URL.createObjectURL(blob),
                    download: fileName
                });
                a.click();
                setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            })
        }}>
            {lang("Save image")}
        </button>
        {#if typeof navigator.share === "function"}
        <button class="emptyButton maxWidth btn" onclick={() => {
            canvas.toBlob((blob) => {
                if (!blob) return;
                navigator.share({
                    files: [new File([blob], fileName)]
                })
            })
        }}>
            {lang("Share image")}
        </button>
        {/if}
    </div>