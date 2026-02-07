<template>
  <div class="tree-node">
    <div
      class="tree-node-row group"
      :style="{ paddingLeft: `${(node.level - 1) * 12 + 4}px` }"
      @click="onRowClick"
    >
      <button
        v-if="node.isFolder"
        type="button"
        class="tree-node-chevron"
        :aria-label="isExpanded ? 'Collapse' : 'Expand'"
        @click.stop="emit('toggle', node.fullPath)"
      >
        <svg
          class="tree-chevron"
          :class="{ 'tree-chevron-open': isExpanded }"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fill-rule="evenodd"
            d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.06l-4.5 4.25a.75.75 0 01-1.06-.02z"
            clip-rule="evenodd"
          />
        </svg>
      </button>
      <span v-else class="tree-node-chevron-placeholder" />

      <span class="tree-node-icon">
        <IconFolder v-if="node.isFolder" class="text-amber-500/90" />
        <IconFile v-else class="text-slate-400" />
      </span>

      <span
        class="truncate tree-node-name"
        :class="node.isFolder ? 'font-medium text-slate-800' : 'text-slate-600'"
      >
        {{ node.name }}
      </span>

      <span class="tree-node-meta">
        <span class="tree-node-size">{{ formatSize(node.size) }}</span>
        <span
          v-if="node.isFolder"
          class="tree-node-count"
        >
          {{ countFiles(node) }} {{ countFiles(node) === 1 ? 'file' : 'files' }}
        </span>
      </span>
    </div>

    <template v-if="node.isFolder && isExpanded && node.children?.length">
      <DocumentsTreeNode
        v-for="child in node.children"
        :key="child.fullPath"
        :node="child"
        :collapsed-paths="props.collapsedPaths"
        :format-size="formatSize"
        :count-files="countFiles"
        @toggle="emit('toggle', $event)"
        @open-file="emit('open-file', $event)"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import type { FileNode } from "~/server/types/file-node";
import IconFolder from "~/components/icon/folder.vue";
import IconFile from "~/components/icon/file.vue";

const props = defineProps<{
  node: FileNode;
  collapsedPaths: Set<string>;
  formatSize: (size: number) => string;
  countFiles: (node: FileNode) => number;
}>();

const emit = defineEmits<{
  toggle: [fullPath: string];
  "open-file": [fullPath: string];
}>();

const isExpanded = computed(
  () => !props.collapsedPaths.has(props.node.fullPath),
);

function onRowClick() {
  if (props.node.isFolder) {
    emit("toggle", props.node.fullPath);
  } else {
    emit("open-file", props.node.fullPath);
  }
}
</script>

<style scoped>
.tree-node-row {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  min-height: 2rem;
  padding-right: 0.5rem;
  padding-top: 2px;
  padding-bottom: 2px;
  border-radius: 0.5rem;
  transition: background-color 0.12s ease;
}

.tree-node-row:hover {
  background-color: rgb(241 245 249 / 0.8);
}

.tree-node-chevron {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  margin: 0 -0.25rem 0 0;
  color: rgb(100 116 139);
  border: none;
  background: transparent;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: color 0.12s ease, transform 0.15s ease;
}

.tree-node-chevron:hover {
  color: rgb(51 65 85);
  background: rgb(226 232 240 / 0.6);
}

.tree-chevron {
  width: 0.875rem;
  height: 0.875rem;
  transition: transform 0.2s ease;
}

.tree-chevron-open {
  transform: rotate(90deg);
}

.tree-node-chevron-placeholder {
  flex-shrink: 0;
  width: 1.25rem;
  height: 1.25rem;
  margin-right: 0;
}

.tree-node-icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.125rem;
  height: 1.125rem;
}

.tree-node-icon :deep(svg) {
  width: 1rem;
  height: 1rem;
}

.tree-node-name {
  flex: 1;
  min-width: 0;
  font-size: 0.8125rem;
}

.tree-node-meta {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: rgb(100 116 139);
}

.tree-node-size {
  font-variant-numeric: tabular-nums;
  min-width: 3.5rem;
  text-align: right;
}

.tree-node-count {
  padding: 0.125rem 0.375rem;
  border-radius: 9999px;
  background: rgb(226 232 240 / 0.8);
  color: rgb(71 85 105);
  font-weight: 500;
}
</style>
