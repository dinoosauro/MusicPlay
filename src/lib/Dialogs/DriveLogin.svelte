<script lang="ts">
    import { cubicInOut } from "svelte/easing";
    import { fade } from "svelte/transition";
    import { lang } from "../../ts/SvelteComponentsHelpers/Language";
    import CloudStorage from "../../ts/Database/CloudStorage";
    import type { DatabaseContainer } from "../../ts/Database/DatabaseInterfaces";
    import Settings from "../../ts/Settings";

    const {isFetching, callback, databases, link}: {isFetching?: boolean, callback: () => void, databases: DatabaseContainer, link?: string} = $props();
</script>

<div class="topDialog flex wcenter" style={`z-index: ${link ? "16" : "9"};`}>
    <div in:fade={{duration: 200, easing: cubicInOut}} out:fade={{duration: 200, easing: cubicInOut}} style="pointer-events: all;">
        {#if isFetching}
            <p>{lang(`Syncing with ${Settings.cloudStorage.onedrive.enabled ? "OneDrive" : "Google Drive"}`)}...</p>
        {:else}
            <p>{lang("You need to log in to sync with your cloud service")}.</p><br>
            <div class="flex hcenter gap">
                <button class="btn" onclick={async () => {
                    if (link) {
                        window.open(link);
                        callback();
                        return;
                    }
                    await CloudStorage.startDriveIntegration(databases, Settings.cloudStorage.onedrive.enabled);
                    callback();
                }}>{lang("Sync")}</button>
                <button class="btn" onclick={callback}>{lang("Close")}</button>
            </div>
        {/if}
    </div>
</div>
