<template>
  <div class="mb-4 border border-slate-200 rounded-xl bg-white">
    <div class="flex items-center justify-between gap-3 px-3 py-2 border-b border-slate-100">
      <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Incomplete uploads ({{ uploads.length }})
      </h3>
      <button
        v-if="uploads.length && !readOnly"
        type="button"
        class="px-3 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-full"
        :disabled="busy"
        @click="emit('abort-all')"
      >
        Abort all
      </button>
    </div>

    <p
      v-if="loading"
      class="px-3 py-3 text-sm text-slate-500"
    >
      Loading incomplete uploads…
    </p>
    <p
      v-else-if="error"
      class="px-3 py-3 text-sm text-red-700"
    >
      {{ error }}
    </p>
    <p
      v-else-if="!uploads.length"
      class="px-3 py-3 text-sm text-slate-500"
    >
      No incomplete multipart uploads.
    </p>
    <ul
      v-else
      class="divide-y divide-slate-100"
    >
      <li
        v-for="upload in uploads"
        :key="upload.uploadId"
        class="flex items-center justify-between gap-3 px-3 py-2"
      >
        <div class="min-w-0">
          <p class="text-sm text-slate-800 truncate font-mono">
            {{ upload.key }}
          </p>
          <p class="text-xs text-slate-500">
            {{ upload.initiated ?? "Unknown start time" }}
          </p>
        </div>
        <button
          v-if="!readOnly"
          type="button"
          class="shrink-0 px-3 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-full"
          :disabled="busy"
          @click="emit('abort', upload)"
        >
          Abort
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
export type IncompleteUpload = {
  initiated: string | null;
  key: string;
  uploadId: string;
};

defineProps<{
  uploads: IncompleteUpload[];
  loading: boolean;
  busy: boolean;
  error: string | null;
  readOnly: boolean;
}>();

const emit = defineEmits<{
  abort: [upload: IncompleteUpload];
  "abort-all": [];
}>();
</script>
