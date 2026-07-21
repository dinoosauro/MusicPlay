<script lang="ts">
    import type { Reader, Uint8ArrayReader, ZipWriter } from "@zip.js/zip.js";
    import type { DatabaseContainer } from "../../ts/Database/DatabaseInterfaces";
    import IndexedDatabase from "../../ts/Database/IndexedDatabase";
    import GetAudioFile from "../../ts/DataFetcher/GetAudioFile";
    import type { MetadataSource } from "../../ts/Player/PlayerInterfaces";
    import inputRangeStyle from "../../ts/SvelteComponentsHelpers/InputTypeRangeStyle";
    import Card from "../Card.svelte";
import Dialog from "../Dialog.svelte";
    import DownloadWithMetadata from "../../ts/Database/DownloadWithMetadata";
    import AutoRevokeUrl from "../../ts/SvelteComponentsHelpers/AutoRevokeUrl";
    import { lang } from "../../ts/SvelteComponentsHelpers/Language";
    import IconsManager from "../../ts/Icons/IconsManager";
    import { mount, unmount } from "svelte";
    import ConvertProcess from "./ConvertProcess.svelte";
    import UpdateConvertDialogValues from "../../ts/SvelteComponentsHelpers/UpdateConvertDialogValues";
    import { slide } from "svelte/transition";
    import { cubicInOut } from "svelte/easing";
    const {closeFn, databases, data}: {
        /**
         * Function used to close the Convert dialog
         */
        closeFn: () => void,
        /**
         * All the databases used by the application
         */
        databases: DatabaseContainer,
        /**
         * The metadata of the songs to convert
         */
        data: MetadataSource[]
    } = $props();
    /**
     * If true, a slider will be used to pick the output quality
     */
    let sliderQuality = $state(true);
    /**
     * Value from the slider (indicates the output quality)
     */
    let sliderOption = 7;
    /**
     * Value (in kbit/s) of the bitrate input
     */
    let bitrateInputOption = 192;
    /**
     * Output codec to use
     */
    let outputFormat = $state("libmp3lame");
    /**
     * Increase/decrease the track volume of *this* decibels
     */
    let outputGain = 0;
    /**
     * If the file should be downloaded
     */
    let downloadFile = $state(false);
    /**
     * If the converted file should replace the source one
     */
    let replaceFile = $state(false);
    /**
     * If the metadata of the source file should be copied to the destination one using TagLib-Sharp
     */
    let copyMetadataToOutputFile = false;

    /**
     * The message sent from FFmpeg. If false, the UI shouldn't be displayed.
     */
    let logMessage = $state<string | false>(false);
    /**
     * The title of the "Conversion in progress" part
     */
    let convertingFile = $state("");
    /**
     * The range used to display the conversion progress
     */
    let inputRange: HTMLInputElement;
    /**
     * Object composed of the properties necessary to remove the mounted dialog that informs the user about the current progress (if they close the dialog)
     */
    let contentToRemove = {
        div: undefined as undefined | HTMLDivElement,
        mounted: undefined as any
    }

    /**
     * Class to create a new worker
     */
    class FFmpegConversion {
        worker: Worker;
        constructor() {
            this.worker = new Worker("./FFmpegConversion.js"); 
        }
        postMessage(data: any, transfer: Transferable[]) {
            this.worker.postMessage(data, transfer);
        }
        onmessage(fn: (msg: any) => void) {
            this.worker.onmessage = fn;
        }
        terminate() {
            this.worker.terminate()
        }
    }
    /**
     * If the conversion is ongoing, create a pop-up that informs the user about the current process before closing the component.
     */
    function extendCloseFn() {
        if (convertingFile !== "") {
            const div = document.createElement("div");
            const mounted = mount(ConvertProcess, {
                target: div,
            });
            contentToRemove.div = div;
            contentToRemove.mounted = mounted;
            document.body.append(div);
        }
        closeFn();
    }
</script>
<Dialog closeFn={extendCloseFn}>
    <div class="circularButtonContainer" style="position: fixed; right: calc(15vw + 15px + env(safe-area-inset-right)); z-index: 2">
        <button class="circularButton emptyButton flex hcenter gap" style="width: fit-content; display: flex;" onclick={() => extendCloseFn()} title={lang("Close convert dialog")}>
            <img src={IconsManager.getIconObjectUrl("dismiss")} class="icon" use:AutoRevokeUrl alt={lang("Close convert dialog")}/>
        </button>
    </div>
    <h3>{lang("Convert music files")}:</h3>
    {#if logMessage === false}
        <p>{lang("You can reduce the music file size by using a different codec or by reducing their bitrate. This might decrease output audio quality")}.</p>
        <label class="flex hcenter gap">
            {lang("Output audio format")}: <select bind:value={outputFormat}>
                <option value="libfdk_aac">AAC</option>
                <option value="alac">ALAC</option>
                <option value="flac">FLAC</option>
                <option value="libmp3lame">MP3</option>
                <option value="libopus">Opus</option>
                <option value="libvorbis">Vorbis</option>
            </select>
        </label><br>
        <Card secondCard={true}>
            <h4>{lang("Output quality")}:</h4>
            {#if outputFormat !== "alac" && outputFormat !== "flac"}
                <div in:slide={{duration: 200, easing: cubicInOut}} out:slide={{duration: 200, easing: cubicInOut}}>
                    <label class="flex hcenter gap">
                        <input type="checkbox" bind:checked={sliderQuality}>
                        {lang("Pick with a slider")}
                    </label><br>
                    {#if sliderQuality}
                        <label class="flex hcenter gap">
                            {lang("Output quality (from worst to best)")}:
                            <input type="range" use:inputRangeStyle={() => {}} bind:value={sliderOption} min="0" max="9" class="maxWidth">
                        </label>
                    {:else}
                        <label class="flex hcenter gap">
                            {lang("Output bitrate (in kbit/s)")}:
                            <input type="number" bind:value={bitrateInputOption}>
                        </label>
                    {/if}<br>
                </div>
            {/if}
            <label class="flex hcenter gap">
                {lang("Increase the output volume of (in decibels)")}: <input type="number" bind:value={outputGain}>
            </label>
        </Card><br>
        <Card secondCard={true}>
            <h4>{lang("File exportation option")}:</h4>
            <label class="flex hcenter gap">
                <input type="checkbox" bind:checked={replaceFile}>{lang("Replace the currently-saved file with the new one")}
            </label><br>
            <label class="flex hcenter gap">
                <input type="checkbox" bind:checked={downloadFile}>{lang("Download the new file")}
            </label>
            {#if downloadFile}
                <div in:slide={{duration: 200, easing: cubicInOut}} out:slide={{duration: 200, easing: cubicInOut}}>
                    <br>
                    <label class="flex hcenter gap">
                        <input type="checkbox" bind:checked={copyMetadataToOutputFile}>{lang("Copy the metadata to the new file")}
                    </label>
                </div>
            {/if}
        </Card><br>
        {#if downloadFile || replaceFile}
            <button in:slide={{duration: 200, easing: cubicInOut}} out:slide={{duration: 200, easing: cubicInOut}} class="emptyButton maxWidth" onclick={async () => {
                if (!downloadFile && !replaceFile) return;
                /**
                 * The quality that should be used for the output bitrate. If it's a number, the -q:a bitrate should be used, otherwise the -b:a (in this case, the final `k` is already added to the string)
                 */
                const getOutputQuality = !sliderQuality ? `${bitrateInputOption}k` : outputFormat === "libmp3lame" ? 9 - sliderOption : outputFormat === "libvorbis" ? sliderOption + 1 : outputFormat === "libfdk_aac" ? Math.floor((sliderOption + 1) / 2) : `${30 * sliderOption}k`;
                setTimeout(async () => {
                    // If defined, a zip file will be created
                    let zipFile: undefined | ZipWriter<Blob>;
                    let uintReader: undefined | typeof Uint8ArrayReader;
                    /**
                     * An array of all the names added in the zip file
                     */
                    const addedNames: string[] = [];
                    /**
                     * Clone of the `data` property (the one that contains the metadata list), so that the conversion of multiple files can continue also if the pop-up is closed
                     */
                    const dataStorage = [...data];
                    if (dataStorage.length > 1 && downloadFile) { // Load the zip.js library
                        const zipjs = await import("@zip.js/zip.js");
                        zipFile = new zipjs.ZipWriter(new zipjs.BlobWriter());
                        uintReader = zipjs.Uint8ArrayReader;
                    }
                    for (let i = 0; i < dataStorage.length; i++) {
                        const song = dataStorage[i];
                        await new Promise<void>(async (res) => {
                            const conversion = new FFmpegConversion();
                            const audio = await GetAudioFile({songDb: databases.songDb, songId: song.trackId, metadataDb: databases.metadataDb});
                            conversion.onmessage(async (msg) => {
                                switch(msg.data.type) {
                                    case "message": { // Received a new log from FFmpeg
                                        logMessage = msg.data.content;
                                        for (const event of UpdateConvertDialogValues.eventsToUpdate) event(`Converting ${convertingFile}`);
                                        break;
                                    }
                                    case "ratio": { // Update the progress
                                        if (inputRange) {
                                            inputRange.value = msg.data.content.toString();
                                            inputRange.dispatchEvent(new Event("input"));
                                            inputRange.dispatchEvent(new Event("change"));
                                        }
                                        for (const event of UpdateConvertDialogValues.eventsToUpdate) event(undefined, msg.data.content);
                                        break;
                                    }
                                    case "file": { // Received the converted file
                                        let downloadName = `${audio.name.substring(0, audio.name.lastIndexOf("."))}${fileName.substring(fileName.lastIndexOf("."))}`;
                                        if (replaceFile) { // We need to replace both the source file and the metadata (since it contains the `name` property, that might have a different extension compared to the converted file)
                                            await IndexedDatabase.set({
                                                db: databases.songDb,
                                                request: "contentData",
                                                object: {
                                                    data: {
                                                        file: new File([msg.data.content], downloadName),
                                                        name: audio.name
                                                    },
                                                    id: song.trackId
                                                }
                                            });
                                            song.metadata.name = downloadName;
                                            await IndexedDatabase.set({
                                                db: databases.metadataDb,
                                                request: "musicMetadata",
                                                object: {
                                                    id: song.trackId,
                                                    data: song.metadata
                                                }
                                            });
                                        }
                                        if (copyMetadataToOutputFile) {
                                            msg.data.content = await DownloadWithMetadata({databases, songs: [song], sendBytesBack: crypto.randomUUID(), songsArr: [{
                                                bytes: msg.data.content,
                                                extension: fileName.substring(fileName.lastIndexOf(".") + 1)
                                            }]});
                                        }
                                        if (zipFile && uintReader) { // Add it to the zip file
                                            /**
                                             * The number added at the end of the file name in case there are duplicates in the zip file
                                             */
                                            let addNumber = 0;
                                            while (addedNames.indexOf(downloadName) !== -1) { // Look if there are duplicates, and change the name by adding a number before the extension
                                                addNumber++;
                                                downloadName = `${downloadName.substring(0, downloadName.lastIndexOf(addNumber ? "-" : "."))}-${addNumber}${downloadName.substring(downloadName.indexOf("."))}`;
                                            }
                                            addedNames.push(downloadName);
                                            await zipFile.add(downloadName, new uintReader(msg.data.content));
                                        } else { // Download the file
                                            const a = Object.assign(document.createElement("a"), {
                                                // @ts-ignore
                                                href: URL.createObjectURL(new Blob([msg.data.content])),
                                                download: downloadName
                                            });
                                            a.click();
                                            setTimeout(() => URL.revokeObjectURL(a.href), 500);
                                        }
                                        conversion.terminate(); // We'll create a new FFmpeg instance for the next file
                                        res();
                                        break;
                                    }
                                }
                            })
                            // Now that we've added the message events to the Worker, we can build the output command, and send it.
                            const sourceName = crypto.randomUUID();
                            const fileName = `${crypto.randomUUID()}.${outputFormat === "libmp3lame" ? "mp3" : (outputFormat === "libvorbis" || outputFormat === "libopus") ? "ogg" : (outputFormat === "libfdk_aac" || outputFormat === "alac") ? "m4a" : outputFormat}`;
                            const sourceFile = new Uint8Array(await audio.arrayBuffer());
                            // Update the title shown at the top of the convert option
                            convertingFile = `${song.metadata.title || song.metadata.name} (${song.metadata.artist}) [${i+1}/${dataStorage.length}]`;
                            conversion.postMessage({
                                type: "startConvert",
                                commands: ["-i", sourceName,
                                    "-acodec", outputFormat,
                                    !sliderQuality || typeof getOutputQuality === "string" ? "-b:a" : outputFormat === "libfdk_aac" ? "-vbr" : "-q:a", getOutputQuality.toString(),
                                    ...(outputGain === 0 ? [] : ["-af", `volume=${outputGain}dB`]),
                                    "-vn", "-map_metadata", "-1",
                                    fileName
                                ],
                                sourceName,
                                sourceFile,
                            }, [sourceFile.buffer]);
                        }); 
                    } 
                    // Finished conversion
                    if (zipFile) { // Download the created zip file
                        const a = Object.assign(document.createElement("a"), {
                            href: URL.createObjectURL(await zipFile.close()),
                            download: `ConvertedFiles.zip`
                        });
                        a.click();
                        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
                    }
                    if (contentToRemove.mounted) { // Remove the top dialog if it was created
                        if (contentToRemove.div) {
                            (contentToRemove.div.firstChild as HTMLElement).style.opacity = "0";
                            await new Promise(res => setTimeout(res, 210));
                        }
                        unmount(contentToRemove.mounted);
                    }
                    if (contentToRemove.div) contentToRemove.div.remove();
                    closeFn(); // And close the dialog
                }, 25);
            }}>
                <u>{lang("Convert")}</u>
            </button>
        {/if}
    {:else}
        <h4>{lang("Converting")} {convertingFile}</h4>
        <input type="range" bind:this={inputRange} disabled={true} use:inputRangeStyle={() => {}} max="1" min="0" style="width: 100%" step="0.00001" class="maxWidth"><br>
        <p>{logMessage}</p>
    {/if}
</Dialog>