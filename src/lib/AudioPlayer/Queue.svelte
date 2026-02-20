<script lang="ts">
    import { onMount } from "svelte";
    import AudioManager from "../../ts/Player/AudioManager";
    import AutoRevokeUrl from "../../ts/SvelteComponentsHelpers/AutoRevokeUrl";
    import GetAlbumArt from "../../ts/DataFetcher/GetAlbumArt";
    import GetAlbumArtId from "../../ts/DataFetcher/GetAlbumArtId";
        import type { MetadataSource, MetadataSourceQueue, UpdateContentProps } from "../../ts/Player/PlayerInterfaces";
    import { slide } from "svelte/transition";
    import { cubicInOut } from "svelte/easing";
    import IconsSource from "../../ts/Icons/IconsSource";
    import IconsManager from "../../ts/Icons/IconsManager";
    import { lang } from "../../ts/SvelteComponentsHelpers/Language";
    let {albumArtDb}: {albumArtDb: IDBDatabase} = $props();
    /**
     * Update the album queue list by sorting the elements according to the current "queuePosition".
     * This is done since the AudioManager doesn't automatically push the finished songs at the end of the array, but instead updates the position number in the queue.
     */
    function handleNormalQueue() {
        const queue = [...AudioManager.audioContext.queue];
        queue.push(...queue.splice(0, AudioManager.audioContext.queuePosition + 1));
        return queue as MetadataSourceQueue[];
    }
    /**
     * Content that has been added in the queue automatically, for example since the user played a track from the album viewer
     */
    let contentInQueue = $state(handleNormalQueue());
    /**
     * Content that has manually been added by the user, and therefore 
     */
    let contentInCertainQueue = $state(AudioManager.audioContext.certainNextQueue);
    onMount(() => {
        function musicListener({newAudioInstance}: UpdateContentProps) {
            if (newAudioInstance) {
                contentInQueue = handleNormalQueue();
                contentInCertainQueue = AudioManager.audioContext.certainNextQueue;
            }
        }
        AudioManager.addToUpdateContent(musicListener);
        return () => {
            AudioManager.addToUpdateContent(musicListener, false);
        }
    })
</script>

{#snippet queueItem(data: MetadataSourceQueue[], isCertain?: boolean)}
    {#each data as queueItem, i (queueItem.queueId)}
        <div role="button" tabindex={i} draggable="true" ondragover={(e) => e.preventDefault()} ondrop={(e) => {
            const data = e.dataTransfer?.getData("text/plain");
            if (typeof data !== "undefined") {
                /**
                 * If "a", the item is from the queue manually added by the user. If it's "b", it's from the queue automatically added by the application
                 */
                const sectionType = data.substring(0, 1);
                /**
                 * Queue ID of the item to move
                 */
                const sectionId = data.substring(2);
                const position = AudioManager.audioContext[sectionType === "a" ? "certainNextQueue" : "queue"].findIndex(i => i.queueId === sectionId);
                if (position === -1) return;
                if (sectionType === "a") { // Move from the certain next queue
                    AudioManager.audioContext.certainNextQueue.splice(i, 0, ...AudioManager.audioContext.certainNextQueue.splice(position, 1));
                    contentInCertainQueue = AudioManager.audioContext.certainNextQueue;
                } else { // To move it from the standard queue, we need to find also the real start position, that will probably be different from `i` (since the queue is never spliced, but instead the `queuePosition` property is increased)
                    const positionOfCurrentItem = AudioManager.audioContext.queue.findIndex(i => i.queueId === queueItem.queueId);
                    AudioManager.audioContext.queue.splice(positionOfCurrentItem, 0, ...AudioManager.audioContext.queue.splice(position, 1));
                    contentInQueue = handleNormalQueue();
                }
            }
        }} ondragstart={(e) => {
            e.dataTransfer?.setData("text/plain", `${isCertain ? "a" : "b"}-${queueItem.queueId}`);
        }} in:slide={{duration: 200, easing: cubicInOut}} out:slide={{duration: 200, easing: cubicInOut}} class="flex hcenter gap maxWidth singleItemContainer" style={i !== 0 ? "margin-top: 10px" : ""}>
            {#await GetAlbumArt({
                db: albumArtDb,
                id: GetAlbumArtId({
                    albumAuthor: queueItem.metadata.albumArtist,
                    year: queueItem.metadata.year,
                    albumName: queueItem.metadata.album
                }),
                name: queueItem.metadata.album
            })}
            {:then result}
                <img style="width: 65px; height: 65px; border-radius: 12px" use:AutoRevokeUrl alt="Album art" src={URL.createObjectURL(result)}>
            {/await}
                <div class="flex hcenter maxWidth gap">
                    <button class="flex hcenter emptyButton maxWidth" onclick={() => {
                        if (isCertain) {
                            const index = AudioManager.audioContext.certainNextQueue.findIndex(i => i.queueId === queueItem.queueId);
                            if (index !== -1) {
                                AudioManager.audioContext.certainNextQueue.splice(0, index);
                                AudioManager.nextButton();
                            }
                        } else {
                            const index = AudioManager.audioContext.queue.findIndex(i => i.queueId === queueItem.queueId);
                            if (index !== -1) AudioManager.playQueuePosition(index);
                        }
                    }}>
                        <span>{queueItem.metadata.title}</span>
                        <div style="height: 5px"></div>
                        <span
                            class="secondaryMetadata"
                            style="overflow-wrap: anywhere;"
                            >{`${queueItem.metadata.album} – ${queueItem.metadata.artist}`}</span
                        >
                    </button>
                    <button class="emptyButton" title={lang("Delete from queue")} onclick={() => {
                        const item = data.splice(i, 1);
                        const index = (isCertain ? AudioManager.audioContext.certainNextQueue : AudioManager.audioContext.queue).findIndex(i => i.queueId === queueItem.queueId);
                        if (index !== -1) (isCertain ? AudioManager.audioContext.certainNextQueue : AudioManager.audioContext.queue).splice(index, 1);
                    }}>
                        <img src={IconsManager.getIconObjectUrl("dismiss")} alt={lang("Delete from queue")}>
                    </button>
                </div>
        </div>
    {/each}
{/snippet}

<div style="overflow: auto; position: relative" class="dynamicHeight">
    
<h2>{lang("Queue")}:</h2>
{#if contentInCertainQueue.length !== 0}
    <h3 class="secondaryMetadata" style="font-size: 18px;">{lang("Added by the user")}:</h3>
    {@render queueItem(contentInCertainQueue, true)}
{/if}
{#if contentInQueue.length !== 0}
    <h3 class="secondaryMetadata" style="font-size: 18px;">{lang("Playing next")}:</h3>
    {@render queueItem(contentInQueue)}
{/if}

<style>
    .singleItemContainer {
        backdrop-filter: blur(8px) brightness(60%);
        background-color: var(--cardtransparent);
        padding: 10px;
        border-radius: 12px;
        transition: 0.2s ease-in-out
    }
</style>

</div>
