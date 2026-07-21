<script lang="ts">
    import { cubicInOut } from "svelte/easing";
    import { fade } from "svelte/transition";
    import inputRangeStyle from "../../ts/SvelteComponentsHelpers/InputTypeRangeStyle";
    import { onMount } from "svelte";
    import UpdateConvertDialogValues from "../../ts/SvelteComponentsHelpers/UpdateConvertDialogValues";
    /**
     * The title of the dialog
     */
    let paragraphToUpdate: HTMLParagraphElement;
    /**
     * The range element used to track the progress
     */
    let rangeToUpdate: HTMLInputElement;
    onMount(() => {
        // We'll create a new function to update the dialog content, that'll be added in the events array
        function updateDialogOptions(paragraphText?: string, progressValue?: number) {
            if (typeof paragraphText === "string") paragraphToUpdate.textContent = paragraphText;
            if (typeof progressValue === "number") {
                rangeToUpdate.value = progressValue.toString();
                rangeToUpdate.dispatchEvent(new Event("input"));
                rangeToUpdate.dispatchEvent(new Event("change"));
            }
        }
        UpdateConvertDialogValues.eventsToUpdate.push(updateDialogOptions);
        main.style.opacity = "1";
        return () => {
            UpdateConvertDialogValues.eventsToUpdate.splice(UpdateConvertDialogValues.eventsToUpdate.indexOf(updateDialogOptions), 1);
        }
    });
    let main: HTMLDivElement;
</script>
<div class="topDialog flex wcenter opacity" bind:this={main}>
    <div in:fade={{duration: 200, easing: cubicInOut}} out:fade={{duration: 200, easing: cubicInOut}}>
        <p bind:this={paragraphToUpdate}></p><br>
        <input type="range" disabled={true} bind:this={rangeToUpdate} use:inputRangeStyle={() => {}} max="1" min="0" style="width: 100%" step="0.00001" class="maxWidth">
    </div>
</div>