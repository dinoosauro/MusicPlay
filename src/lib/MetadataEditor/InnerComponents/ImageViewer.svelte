<script lang="ts">
    import { onMount } from "svelte";
    import { lang } from "../../../ts/SvelteComponentsHelpers/Language";

    const {src, getImg}: {
        /**
         * Source of the album art that should be added
         */
        src: string, 
        /**
         * Function immediately called when the component is mounted. Returns the new HTMLImageElement where the album/artist/etc image is displayed.
         * @param img the HTMLImageElement of this component
         */
        getImg: (img: HTMLImageElement) => void
    } = $props();
    let img: HTMLImageElement;
    onMount(() => getImg(img))
</script>

<button
    class="flex hcenter gap wcenter emptyButton maxWidth"
    style="display: flex;"
    onclick={() => {
        const input = Object.assign(document.createElement("input"), {
            type: "file",
            onchange: async () => {
                if (input.files) {
                    img.src = URL.createObjectURL(input.files[0]);
                }
            },
            accept: "image/*",
        });
        input.click();
    }}
>
    <!-- svelte-ignore a11y_img_redundant_alt -->
    <img
        bind:this={img}
        {src}
        alt={lang("Click here to upload a custom picture")}
        title={lang("Click here to upload a custom picture")}
        style="width: min(25vw, 25vh); height: min(25vw, 25vh); border-radius: 12px"
    />
</button><br />
