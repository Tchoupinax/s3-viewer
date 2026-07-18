<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      @click.self="emit('close')"
    >
      <div
        class="w-full max-w-lg max-h-[min(90vh,720px)] flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl"
        @click.stop
      >
        <div class="px-5 pt-5 pb-3 border-b border-slate-100 shrink-0">
          <h2
            id="delete-dialog-title"
            class="text-lg font-semibold text-slate-900"
          >
            {{ title }}
          </h2>
          <p class="mt-1 text-sm text-slate-500">
            This action cannot be undone. Objects are removed from storage immediately.
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
            Loading details from storage…
          </div>

          <template v-else>
            <p
              v-if="previewError"
              class="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2"
            >
              {{ previewError }}
            </p>

            <template v-if="effectivePreview">
              <p
                v-if="effectivePreview.objectCount === 0"
                class="text-sm text-slate-700 bg-slate-100 border border-slate-200 rounded-xl px-3 py-2"
              >
                No objects match the selected paths. Nothing to delete.
              </p>

              <div
                v-else
                class="rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2.5 text-sm text-amber-950"
              >
                <strong class="font-semibold">Warning:</strong>
                {{ warningText }}
              </div>

              <dl class="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-sm">
                <dt class="text-slate-500">
                  Bucket
                </dt>
                <dd class="font-medium text-slate-900 break-all">
                  {{ effectivePreview.bucketName }}
                </dd>

                <template v-if="isBulk">
                  <dt class="text-slate-500">
                    Selection
                  </dt>
                  <dd class="font-medium text-slate-900">
                    {{ bulkPreviews!.length.toLocaleString() }} items
                  </dd>
                </template>

                <template v-else>
                  <dt class="text-slate-500">
                    Type
                  </dt>
                  <dd class="font-medium text-slate-900">
                    {{ effectivePreview.kind === "folder" ? "Folder (prefix)" : "Object" }}
                  </dd>

                  <dt class="text-slate-500">
                    Key
                  </dt>
                  <dd class="font-mono text-xs text-slate-800 break-all">
                    {{ effectivePreview.key }}
                  </dd>
                </template>

                <dt class="text-slate-500">
                  Objects
                </dt>
                <dd class="font-medium text-slate-900">
                  {{ effectivePreview.objectCount.toLocaleString() }}
                </dd>

                <dt class="text-slate-500">
                  Total size
                </dt>
                <dd class="font-medium text-slate-900 tabular-nums">
                  {{ effectivePreview.totalSizeHuman }}
                  <span class="text-slate-500 font-normal">
                    ({{ effectivePreview.totalSizeBytes.toLocaleString() }} bytes)
                  </span>
                </dd>
              </dl>

              <div v-if="isBulk">
                <p class="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1.5">
                  Selected paths
                </p>
                <ul
                  class="max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/80 px-2 py-1.5 font-mono text-[11px] text-slate-700 space-y-0.5"
                >
                  <li
                    v-for="item in bulkPreviews"
                    :key="item.key"
                    class="break-all"
                  >
                    {{ item.kind === "folder" ? "[folder] " : "" }}{{ item.key }}
                    <span class="text-slate-400">
                      ({{ item.objectCount.toLocaleString() }})
                    </span>
                  </li>
                </ul>
              </div>

              <div v-else-if="effectivePreview.sampleKeys.length">
                <p class="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1.5">
                  Sample keys
                  <span
                    v-if="effectivePreview.listTruncatedForDisplay"
                    class="font-normal normal-case text-slate-400"
                  >
                    (first {{ effectivePreview.sampleKeys.length }} shown)
                  </span>
                </p>
                <ul
                  class="max-h-32 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/80 px-2 py-1.5 font-mono text-[11px] text-slate-700 space-y-0.5"
                >
                  <li
                    v-for="k in effectivePreview.sampleKeys"
                    :key="k"
                    class="break-all"
                  >
                    {{ k }}
                  </li>
                </ul>
              </div>
            </template>
          </template>
        </div>

        <div class="px-5 py-4 border-t border-slate-100 bg-slate-50/60 shrink-0 space-y-3">
          <label
            v-if="effectivePreview && !loading && canSubmit"
            class="flex items-start gap-2 cursor-pointer select-none"
          >
            <input
              v-model="acknowledged"
              type="checkbox"
              class="mt-0.5 rounded border-slate-300 text-red-600 focus:ring-red-500/30"
            >
            <span class="text-sm text-slate-700">
              {{ acknowledgeText }}
            </span>
          </label>

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
              :disabled="!canSubmit || deleting || !acknowledged"
              @click="emit('confirm')"
            >
              {{ deleting ? "Deleting…" : "Delete permanently" }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import prettyBytes from "pretty-bytes";
import { computed, ref, watch } from "vue";

export type DeletePreviewPayload = {
  kind: "file" | "folder";
  key: string;
  bucketName: string;
  objectCount: number;
  totalSizeBytes: number;
  totalSizeHuman: string;
  lastModified: string | null;
  sampleKeys: string[];
  listTruncatedForDisplay: boolean;
};

const props = defineProps<{
  open: boolean;
  loading: boolean;
  preview: DeletePreviewPayload | null;
  bulkPreviews?: DeletePreviewPayload[] | null;
  previewError: string | null;
  deleting: boolean;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [];
}>();

const acknowledged = ref(false);

watch(
  () => props.open,
  v => {
    if (v) {acknowledged.value = false;}
  },
);

watch(
  () => [props.preview, props.bulkPreviews],
  () => {
    acknowledged.value = false;
  },
);

const isBulk = computed(
  () => (props.bulkPreviews?.length ?? 0) > 1,
);

const effectivePreview = computed(() => {
  if (props.bulkPreviews?.length) {
    const objectCount = props.bulkPreviews.reduce(
      (sum, item) => sum + item.objectCount,
      0,
    );
    const totalSizeBytes = props.bulkPreviews.reduce(
      (sum, item) => sum + item.totalSizeBytes,
      0,
    );
    const sampleKeys = props.bulkPreviews
      .flatMap(item => item.sampleKeys)
      .slice(0, 40);

    return {
      kind: "folder" as const,
      key: "",
      bucketName: props.bulkPreviews[0]?.bucketName ?? "",
      objectCount,
      totalSizeBytes,
      totalSizeHuman: prettyBytes(totalSizeBytes),
      lastModified: null,
      sampleKeys,
      listTruncatedForDisplay: sampleKeys.length >= 40,
    };
  }

  return props.preview;
});

const title = computed(() => {
  if (isBulk.value) {
    return `Delete ${props.bulkPreviews!.length} items`;
  }
  if (!props.preview) {return "Delete object";}
  return props.preview.kind === "folder"
    ? "Delete folder"
    : "Delete file";
});

const warningText = computed(() => {
  if (isBulk.value) {
    return "Every object under the selected paths will be permanently deleted, including all files and subfolders.";
  }
  if (!props.preview) {return "";}
  if (props.preview.kind === "folder") {
    return "Every object whose key starts with this path will be deleted. Subfolders are included.";
  }
  return "The object will be removed from the bucket.";
});

const acknowledgeText = computed(() => {
  if (isBulk.value) {
    return "I understand that all selected items and their objects will be permanently deleted and cannot be recovered.";
  }
  if (!effectivePreview.value) {return "";}
  return `I understand that this will permanently delete ${
    effectivePreview.value.kind === "folder"
      ? "all listed objects under this prefix"
      : "this object"
  } and cannot be undone.`;
});

const canSubmit = computed(() => {
  if (!effectivePreview.value || props.loading || props.previewError) {
    return false;
  }
  if (effectivePreview.value.objectCount === 0) {return false;}
  return true;
});

function formatIso(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
</script>
