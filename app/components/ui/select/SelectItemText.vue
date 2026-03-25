<script setup lang="ts">
import type { SelectItemTextProps } from 'reka-ui'
import { SelectItemText as SelectItemTextRoot } from 'reka-ui'

const props = defineProps<SelectItemTextProps>()
</script>

<template>
  <SelectItemTextRoot
    data-slot="select-item-text"
    v-bind="props"
  >
    <slot />
  </SelectItemTextRoot>
</template>
