<script lang="ts">
    import { lang } from "../../ts/SvelteComponentsHelpers/Language";
import Dialog from "../Dialog.svelte";
    let {closeFn, handle, isFile}: {
        /**
         * This function will be called after the user decided to pick a file/folder, or if they have decided to remove the element.
         * @param handle if the user picked something, it'll be either a FileSystemDirectoryHandle (if `isFile` is either false or undefined) or a FileSystemFileHandle.
         */
        closeFn: (handle?: FileSystemDirectoryHandle | FileSystemFileHandle) => void, 
        /**
         * The original handle, that caused the problem
         */
        handle: FileSystemDirectoryHandle | FileSystemFileHandle, 
        /**
         * The handle is a FileSystemFileHandle, so a file should be picked
         */
        isFile?: boolean
    } = $props();
    /**
     * If false, the dialog won't be displayed. This is done so that we can at least have an opacity transition when the dialog is closed.
     */
    let showDialog = $state(true);
</script>

{#if showDialog}
<Dialog {closeFn}>
    <h3>{lang(`A ${isFile ? "file" : "directory"} couldn't be opened`)}</h3>
    <p>{lang("The appliication couldn't open")}: <i>{handle.name}</i>, {lang("probably because it was either moved or deleted")}. {isFile ? lang("Select the file with the button below, or delete it by clicking the three dots at the right of its name in the metadata viewer") : "Select the new directory with the button below, and we'll try to match the files using their file name"}.</p>
    <div class="flex hcenter gap">
        <button onclick={async () => {
            const picker = isFile ? (await window.showOpenFilePicker({
                id: "MusicPlayer-MusicPicker",
                    multiple: false,
                    startIn: "music",
                    types: [{
                        description: "Music files",
                        accept: {
                            "audio/*": [".mp3", ".aac", ".m4a", ".ogg", ".opus", ".wav", ".flac", ".alac", ".wma", ".mkv"],
                            "text/plain": [".lrc", ".ttml", ".txt"],
                            "application/xml": [".ttml"]
                        }
                    }]
            }))[0] : await window.showDirectoryPicker({
                id: "MusicPlayer-MusicPicker",
                startIn: "music",
                mode: "read"
            });
            setTimeout(() => {
                closeFn(picker);
            }, 210);
            showDialog = false;
        }} class="btn" style="background-color: var(--secondcard)">{lang(`Pick new ${isFile ? "file" : "directory"}`)}</button>
        <button class="btn" style="background-color: var(--secondcard)" onclick={() => {
            setTimeout(() => closeFn(), 210);
            showDialog = false;
        }}>{isFile ? lang("Maybe later") : lang("Delete directory files")}</button>
    </div>
</Dialog>
{/if}