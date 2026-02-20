<script lang="ts">
    const {secondCard}: {secondCard?: boolean} = $props();
</script>

<div class="card" style={secondCard ? "background-color: var(--secondcard)" : ""}>
    <slot></slot>
</div>

