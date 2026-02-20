<script lang="ts">
    import AutoRevokeUrl from "../ts/SvelteComponentsHelpers/AutoRevokeUrl";
    import HistoryHandler from "../ts/Player/HistoryHandler";
    import Icons from "../ts/Icons/IconsManager";
    import { lang } from "../ts/SvelteComponentsHelpers/Language";
</script>

<button class="emptyButton opacity flex hcenter wcenter circularButton" style="display: flex;" onclick={() => HistoryHandler.goBack()} title={lang("Back button")}>
    <img use:AutoRevokeUrl src={Icons.getIconObjectUrl("left")} class="icon" style="width: 24px; height: 24px; padding: 5px" alt={lang("Back button")}>
</button>

<style>
</style>