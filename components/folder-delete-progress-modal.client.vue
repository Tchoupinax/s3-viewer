<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="folder-delete-progress-title"
      aria-busy="true"
    >
      <div
        class="w-full max-w-md overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl"
      >
        <div class="px-6 pt-8 pb-6 flex flex-col items-center text-center">
          <span
            class="inline-block size-10 rounded-full border-[3px] border-sky-200 border-t-sky-600 animate-spin"
            aria-hidden="true"
          />

          <h2
            id="folder-delete-progress-title"
            class="mt-5 text-xl font-semibold text-slate-900"
          >
            Deleting folder…
          </h2>

          <p
            v-if="folderPath"
            class="mt-2 text-sm text-slate-600 break-all px-2"
          >
            <span class="font-mono">{{ folderPath }}</span>
          </p>

          <p
            v-if="total > 0"
            class="mt-5 text-3xl font-semibold tabular-nums text-slate-900"
          >
            {{ deleted.toLocaleString() }} / {{ total.toLocaleString() }}
          </p>

          <p class="mt-1 text-sm text-slate-500">
            {{ total === 1 ? "file deleted" : "files deleted" }}
          </p>

          <p class="mt-4 text-sm text-slate-500 leading-relaxed">
            Please keep this page open until the deletion finishes.
          </p>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
defineProps<{
  open: boolean;
  folderPath?: string | null;
  deleted: number;
  total: number;
}>();
</script>
