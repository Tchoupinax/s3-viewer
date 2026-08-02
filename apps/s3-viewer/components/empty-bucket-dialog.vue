<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="empty-bucket-dialog-title"
      @click.self="emit('close')"
    >
      <div
        class="w-full max-w-lg max-h-[min(90vh,720px)] flex flex-col overflow-hidden rounded-2xl border border-red-200/80 bg-white shadow-xl"
        @click.stop
      >
        <div class="px-5 pt-5 pb-3 border-b border-red-100 bg-red-50/40 shrink-0">
          <h2
            id="empty-bucket-dialog-title"
            class="text-lg font-semibold text-red-900"
          >
            Empty bucket
          </h2>
          <p class="mt-1 text-sm text-red-800/80">
            This permanently deletes every object in the bucket. The bucket itself is kept, but all data inside it is removed immediately and cannot be recovered.
          </p>
        </div>

        <div class="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
          <div
            v-if="loading"
            class="flex items-center gap-2 text-sm text-slate-600"
          >
            <span
              class="inline-block size-4 rounded-full border-2 border-sky-200 border-t-sky-600 animate-spin"
            />
            Counting objects in bucket…
          </div>

          <template v-else>
            <p
              v-if="previewError"
              class="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2"
            >
              {{ previewError }}
            </p>

            <template v-if="preview">
              <p
                v-if="preview.objectCount === 0"
                class="text-sm text-slate-700 bg-slate-100 border border-slate-200 rounded-xl px-3 py-2"
              >
                This bucket is already empty. There are no objects to delete.
              </p>

              <template v-else>
                <div
                  class="rounded-xl border border-red-300/80 bg-red-50 px-3 py-3 text-sm text-red-950 space-y-2"
                >
                  <p>
                    <strong class="font-semibold">You are about to delete all objects</strong>
                    in bucket
                    <span class="font-mono font-semibold">{{ preview.bucketName }}</span>.
                  </p>
                  <ul class="list-disc pl-5 space-y-1">
                    <li>
                      <strong>{{ preview.objectCount.toLocaleString() }}</strong>
                      object{{ preview.objectCount === 1 ? "" : "s" }}
                      ({{ preview.totalSizeHuman }}) will be permanently removed.
                    </li>
                    <li>
                      Every file, folder prefix, and versioned object key listed in storage will be deleted.
                    </li>
                    <li>This action cannot be undone. Backups or replicas outside this bucket are not affected.</li>
                  </ul>
                </div>

                <dl class="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-sm">
                  <dt class="text-slate-500">
                    Bucket
                  </dt>
                  <dd class="font-medium text-slate-900 break-all">
                    {{ preview.bucketName }}
                  </dd>

                  <dt class="text-slate-500">
                    Objects
                  </dt>
                  <dd class="font-medium text-slate-900">
                    {{ preview.objectCount.toLocaleString() }}
                  </dd>

                  <dt class="text-slate-500">
                    Total size
                  </dt>
                  <dd class="font-medium text-slate-900 tabular-nums">
                    {{ preview.totalSizeHuman }}
                    <span class="text-slate-500 font-normal">
                      ({{ preview.totalSizeBytes.toLocaleString() }} bytes)
                    </span>
                  </dd>
                </dl>

                <div v-if="preview.sampleKeys.length">
                  <p class="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1.5">
                    Sample keys that will be deleted
                    <span
                      v-if="preview.listTruncatedForDisplay"
                      class="font-normal normal-case text-slate-400"
                    >
                      (first {{ preview.sampleKeys.length }} shown)
                    </span>
                  </p>
                  <ul
                    class="max-h-32 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/80 px-2 py-1.5 font-mono text-[11px] text-slate-700 space-y-0.5"
                  >
                    <li
                      v-for="k in preview.sampleKeys"
                      :key="k"
                      class="break-all"
                    >
                      {{ k }}
                    </li>
                  </ul>
                </div>
              </template>
            </template>
          </template>
        </div>

        <div class="px-5 py-4 border-t border-slate-100 bg-slate-50/60 shrink-0 space-y-3">
          <template v-if="preview && !loading && canSubmit">
            <label class="flex items-start gap-2 cursor-pointer select-none">
              <input
                v-model="acknowledged"
                type="checkbox"
                class="mt-0.5 rounded border-slate-300 text-red-600 focus:ring-red-500/30"
              >
              <span class="text-sm text-slate-700">
                I understand that all {{ preview.objectCount.toLocaleString() }} object{{ preview.objectCount === 1 ? "" : "s" }} in this bucket will be permanently deleted and cannot be recovered.
              </span>
            </label>

            <div>
              <label
                for="empty-bucket-confirm-name"
                class="block text-sm text-slate-700 mb-1.5"
              >
                Type
                <span class="font-mono font-semibold">{{ preview.bucketName }}</span>
                to confirm:
              </label>
              <input
                id="empty-bucket-confirm-name"
                v-model="typedBucketName"
                type="text"
                autocomplete="off"
                spellcheck="false"
                class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                :placeholder="preview.bucketName"
              >
            </div>
          </template>

          <div class="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              class="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition"
              @click="emit('close')"
            >
              Cancel
            </button>
            <button
              type="button"
              class="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-45 disabled:cursor-not-allowed transition"
              :disabled="!canSubmit || emptying || !acknowledged || !nameConfirmed"
              @click="emit('confirm')"
            >
              Empty bucket permanently
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";

export type EmptyBucketPreviewPayload = {
  bucketName: string;
  objectCount: number;
  totalSizeBytes: number;
  totalSizeHuman: string;
  sampleKeys: string[];
  listTruncatedForDisplay: boolean;
};

const props = defineProps<{
  open: boolean;
  loading: boolean;
  preview: EmptyBucketPreviewPayload | null;
  previewError: string | null;
  emptying: boolean;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [];
}>();

const acknowledged = ref(false);
const typedBucketName = ref("");

watch(
  () => props.open,
  v => {
    if (v) {
      acknowledged.value = false;
      typedBucketName.value = "";
    }
  },
);

watch(
  () => props.preview,
  () => {
    acknowledged.value = false;
    typedBucketName.value = "";
  },
);

const nameConfirmed = computed(() => {
  if (!props.preview) {return false;}
  return typedBucketName.value.trim() === props.preview.bucketName;
});

const canSubmit = computed(() => {
  if (!props.preview || props.loading || props.previewError) {return false;}
  if (props.preview.objectCount === 0) {return false;}
  return true;
});
</script>
