<script lang="ts">
    import AutoRevokeUrl from "../../../ts/SvelteComponentsHelpers/AutoRevokeUrl";
    import IconsManager from "../../../ts/Icons/IconsManager";
    import { lang } from "../../../ts/SvelteComponentsHelpers/Language";

    const { saveFn, closeFn }: { 
        /**
         * Function called when the "Save" button is clicked
         */
        saveFn: () => void; 
        /**
         * Function called when the "Close" button is clicked
         */
        closeFn: () => void 
    } =
        $props();
</script>

<button
    class="emptyButton flex hcenter wcenter"
    style="display: flex;"
    onclick={() => saveFn()}
    title={lang("Save edits")}
>
    <img src={IconsManager.getIconObjectUrl("save")} use:AutoRevokeUrl alt={lang("Save edits")} />
</button>
<button
    class="flex hcenter wcenter emptyButton"
    style="display: flex;"
    onclick={() => closeFn()}
    title={lang("Close without saving")}
>
    <img
        src={IconsManager.getIconObjectUrl("dismiss")}
        use:AutoRevokeUrl
        alt={lang("Close without saving")}
    />
</button>
