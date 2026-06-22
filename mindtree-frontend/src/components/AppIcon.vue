<script setup>
defineProps({
  size: { type: Number, default: 18 },
  alt: { type: String, default: '' },
})
</script>

<template>
  <img
    class="app-icon"
    src="/favicon.svg"
    :alt="alt"
    :style="{ width: `${size}px`, height: `${size}px` }"
    aria-hidden="true"
  />
</template>

<style scoped>
.app-icon {
  display: block;
  object-fit: contain;
  filter: drop-shadow(0 2px 5px rgba(126, 110, 98, 0.12));
}
</style>
