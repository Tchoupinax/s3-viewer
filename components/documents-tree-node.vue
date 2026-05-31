<template>
  <div class="tree-node">
    <div
      class="tree-node-row group"
      :style="{ paddingLeft: `${(node.level - 1) * 24}px` }"
      @click="onRowClick"
    >
      <div
        v-if="node.isFolder"
        class="tree-node-chevron-slot"
      >
        <button
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
      </div>

      <span class="tree-node-icon">
        <IconFolder
          v-if="node.isFolder"
          class="text-amber-500/90"
        />
        <IconFile
          v-else
          class="text-slate-400"
        />
      </span>

      <span
        class="truncate tree-node-name"
        :class="node.isFolder ? 'font-medium text-slate-800' : 'text-slate-600'"
      >
        {{ node.name }}
      </span>

      <button
        v-if="allowDelete"
        type="button"
        class="tree-node-delete"
        aria-label="Delete"
        title="Delete"
        @click.stop="emit('request-delete', node)"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fill-rule="evenodd"
            d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.286a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.47 41.47 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34 0a.75.75 0 10-1.5.06l-.3 7.5a.75.75 0 101.5-.06l.3-7.5z"
            clip-rule="evenodd"
          />
        </svg>
      </button>

      <span class="tree-node-meta">
        <span
          v-if="!node.isFolder && node.lastModified"
          class="tree-node-date"
        >
          {{ formatDate(node.lastModified) }}
        </span>
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
        :format-date="formatDate"
        :count-files="countFiles"
        :allow-delete="allowDelete"
        @toggle="emit('toggle', $event)"
        @open-file="emit('open-file', $event)"
        @request-delete="emit('request-delete', $event)"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import DocumentsTreeNode from "./documents-tree-node.vue";
import IconFile from "~/components/icon/file.vue";
import IconFolder from "~/components/icon/folder.vue";
import type { FileNode } from "~/server/types/file-node";

const props = defineProps<{
  node: FileNode;
  collapsedPaths: Set<string>;
  formatSize: (size: number) => string;
  formatDate: (date: Date | null) => string;
  countFiles: (node: FileNode) => number;
  allowDelete?: boolean;
}>();

const emit = defineEmits<{
  toggle: [fullPath: string];
  "open-file": [fullPath: string];
  "request-delete": [node: FileNode];
}>();

const isExpanded = computed(
  () => !props.collapsedPaths.has(props.node.fullPath),
);

const allowDelete = computed(() => props.allowDelete ?? true);

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

.tree-node-chevron-slot {
  flex-shrink: 0;
  box-sizing: border-box;
  width: 1.25rem;
  height: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.tree-node-chevron {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  padding: 0;
  margin: 0;
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

.tree-node-icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
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
  text-align: left;
}

.tree-node-delete {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  margin: 0;
  color: rgb(148 163 184);
  border: none;
  background: transparent;
  border-radius: 0.375rem;
  cursor: pointer;
  opacity: 0.35;
  transition:
    color 0.12s ease,
    background-color 0.12s ease,
    opacity 0.12s ease;
}

.tree-node-row:hover .tree-node-delete,
.tree-node-delete:focus-visible {
  opacity: 1;
}

.tree-node-delete:hover {
  color: rgb(220 38 38);
  background: rgb(254 226 226 / 0.6);
}

.tree-node-delete svg {
  width: 0.9375rem;
  height: 0.9375rem;
}

.tree-node-meta {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: rgb(100 116 139);
  text-align: left;
}

.tree-node-date {
  min-width: 4rem;
  text-align: left;
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
