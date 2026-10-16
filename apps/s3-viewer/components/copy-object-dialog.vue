<template>
  <div
    v-if="open"
    class="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-900/50"
    role="dialog"
    aria-modal="true"
    aria-labelledby="copy-object-title"
    @click.self="emit('close')"
  >
    <div class="w-full max-w-lg p-6 bg-white shadow-2xl rounded-2xl">
      <h2
        id="copy-object-title"
        class="text-lg font-semibold text-slate-900"
      >
        Copy or move
      </h2>
      <p class="mt-1 text-sm text-slate-500 break-all">
        {{ sourceKey }}
      </p>

      <label class="block mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Destination bucket
        <select
          class="block w-full mt-1 px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-800 bg-white border border-slate-200 rounded-xl"
          :value="destinationBucketId"
          @change="emit('update:destinationBucketId', ($event.target as HTMLSelectElement).value)"
        >
          <option
            v-for="bucket in buckets"
            :key="bucket.id"
            :value="bucket.id"
          >
            {{ bucket.name }}
          </option>
        </select>
      </label>

      <label class="block mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Destination key
        <input
          class="block w-full mt-1 px-3 py-2 text-sm font-normal normal-case tracking-normal font-mono text-slate-800 bg-white border border-slate-200 rounded-xl"
          :value="destinationKey"
          @input="emit('update:destinationKey', ($event.target as HTMLInputElement).value)"
        >
      </label>

      <p
        v-if="error"
        class="mt-3 text-sm text-red-700"
      >
        {{ error }}
      </p>

      <div class="flex justify-end gap-2 mt-6">
        <button
          type="button"
          class="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-full"
          :disabled="busy"
          @click="emit('close')"
        >
          Cancel
        </button>
        <button
          type="button"
          class="px-3 py-1.5 text-xs font-medium text-sky-800 bg-sky-50 border border-sky-200 rounded-full disabled:opacity-50"
          :disabled="busy"
          @click="emit('confirm', false)"
        >
          Copy
        </button>
        <button
          type="button"
          class="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-full disabled:opacity-50"
          :disabled="busy"
          @click="emit('confirm', true)"
        >
          Move
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { S3ViewerBucket } from "~/server/types/bucket";

defineProps<{
  open: boolean;
  busy: boolean;
  error: string | null;
  sourceKey: string;
  buckets: Array<S3ViewerBucket>;
  destinationBucketId: string;
  destinationKey: string;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [move: boolean];
  "update:destinationBucketId": [value: string];
  "update:destinationKey": [value: string];
}>();
</script>
