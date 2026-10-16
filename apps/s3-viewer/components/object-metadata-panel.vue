<template>
  <aside
    v-if="open"
    class="fixed inset-y-0 right-0 z-[80] flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl"
    role="dialog"
    aria-labelledby="object-metadata-title"
  >
    <div class="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
      <div class="min-w-0">
        <h2
          id="object-metadata-title"
          class="text-sm font-semibold text-slate-900"
        >
          Object details
        </h2>
        <p class="mt-1 text-xs text-slate-500 break-all font-mono">
          {{ objectKey }}
        </p>
      </div>
      <button
        type="button"
        class="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-full hover:bg-slate-50"
        @click="emit('close')"
      >
        Close
      </button>
    </div>

    <div class="flex-1 px-5 py-4 overflow-y-auto">
      <p
        v-if="loading"
        class="text-sm text-slate-500"
      >
        Loading details…
      </p>
      <p
        v-else-if="error"
        class="text-sm text-red-700"
      >
        {{ error }}
      </p>
      <dl
        v-else-if="metadata"
        class="space-y-3"
      >
        <div
          v-for="row in rows"
          :key="row.label"
        >
          <dt class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {{ row.label }}
          </dt>
          <dd class="mt-0.5 text-sm text-slate-800 break-all">
            {{ row.value }}
          </dd>
        </div>

        <div v-if="customMetadata.length">
          <dt class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Custom metadata
          </dt>
          <dd class="mt-2 space-y-1">
            <p
              v-for="entry in customMetadata"
              :key="entry.key"
              class="text-sm text-slate-800 break-all"
            >
              <span class="font-mono text-slate-500">{{ entry.key }}</span>
              {{ entry.value }}
            </p>
          </dd>
        </div>
      </dl>
    </div>
  </aside>
</template>

<script setup lang="ts">
import prettyBytes from "pretty-bytes";
import { computed } from "vue";

import type { ObjectMetadata } from "~/server/types/object-metadata";

const props = defineProps<{
  open: boolean;
  loading: boolean;
  error: string | null;
  objectKey: string | null;
  metadata: ObjectMetadata | null;
}>();

const emit = defineEmits<{
  close: [];
}>();

const rows = computed(() => {
  if (!props.metadata) {return [];}
  return [
    { label: "Content type", value: props.metadata.contentType ?? "—" },
    { label: "Size", value: prettyBytes(props.metadata.contentLength ?? 0) },
    { label: "Storage class", value: props.metadata.storageClass ?? "—" },
    { label: "ETag", value: props.metadata.etag ?? "—" },
    { label: "Last modified", value: props.metadata.lastModified ?? "—" },
    { label: "Cache control", value: props.metadata.cacheControl ?? "—" },
    { label: "Content encoding", value: props.metadata.contentEncoding ?? "—" },
  ];
});

const customMetadata = computed(() =>
  Object.entries(props.metadata?.metadata ?? {}).map(([key, value]) => ({ key, value })),
);
</script>
