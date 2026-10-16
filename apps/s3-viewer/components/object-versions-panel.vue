<template>
  <aside
    v-if="open"
    class="fixed inset-y-0 right-0 z-[80] flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl"
    role="dialog"
    aria-labelledby="object-versions-title"
  >
    <div class="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
      <div class="min-w-0">
        <h2
          id="object-versions-title"
          class="text-sm font-semibold text-slate-900"
        >
          Versions
        </h2>
        <p class="mt-1 text-xs text-slate-500 break-all font-mono">
          {{ objectKey }}
        </p>
      </div>
      <button
        type="button"
        class="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-full"
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
        Loading versions…
      </p>
      <p
        v-else-if="error"
        class="text-sm text-red-700"
      >
        {{ error }}
      </p>
      <template v-else-if="data">
        <p class="text-sm text-slate-600">
          Versioning is {{ data.status ?? "off" }}.
        </p>
        <ul class="mt-4 space-y-3">
          <li
            v-for="version in data.versions"
            :key="version.versionId"
            class="p-3 border border-slate-200 rounded-xl"
          >
            <p class="text-sm font-medium text-slate-800">
              {{ version.isDeleteMarker ? "Delete marker" : prettyBytes(version.size) }}
              <span
                v-if="version.isLatest"
                class="ml-2 text-[11px] uppercase tracking-wide text-sky-700"
              >Latest</span>
            </p>
            <p class="mt-1 text-xs text-slate-500 break-all">
              {{ version.lastModified ?? "Unknown date" }}
            </p>
            <p class="mt-1 text-xs font-mono text-slate-400 break-all">
              {{ version.versionId }}
            </p>
            <div
              v-if="!readOnly"
              class="flex gap-2 mt-3"
            >
              <button
                v-if="!version.isDeleteMarker && !version.isLatest"
                type="button"
                class="px-3 py-1 text-xs font-medium text-sky-800 bg-sky-50 border border-sky-200 rounded-full"
                :disabled="busy"
                @click="emit('restore', version)"
              >
                Restore
              </button>
              <button
                type="button"
                class="px-3 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-full"
                :disabled="busy"
                @click="emit('remove', version)"
              >
                Delete version
              </button>
            </div>
          </li>
        </ul>
        <p
          v-if="!data.versions.length"
          class="mt-3 text-sm text-slate-500"
        >
          No versions for this object.
        </p>
      </template>
    </div>
  </aside>
</template>

<script setup lang="ts">
import prettyBytes from "pretty-bytes";

import type { ObjectVersion, ObjectVersions } from "~/server/types/object-version";

defineProps<{
  open: boolean;
  loading: boolean;
  busy: boolean;
  error: string | null;
  objectKey: string | null;
  readOnly: boolean;
  data: ObjectVersions | null;
}>();

const emit = defineEmits<{
  close: [];
  restore: [version: ObjectVersion];
  remove: [version: ObjectVersion];
}>();
</script>
