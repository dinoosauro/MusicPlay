<script lang="ts">
    const {secondCard, border}: {
        /**
         * If the card should be a little bit brighter
         */
        secondCard?: boolean,
        /**
         * Extra CSS styling that'll be added to the div. Not limited to changing the border color (since, in fact, doesn't even add the `border:` prefix)
         */
        border?: string} = $props();
</script>

<div class="card" style={`${secondCard ? "background-color: var(--secondcard); " : ""}${border ? border : ""}`}>
    <slot></slot>
</div>

