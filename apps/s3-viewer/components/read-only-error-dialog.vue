<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="read-only-error-title"
      @click.self="emit('close')"
    >
      <div
        class="w-full max-w-md overflow-hidden rounded-2xl border border-amber-200/80 bg-white shadow-xl"
        @click.stop
      >
        <div class="px-5 pt-5 pb-3 border-b border-amber-100 bg-amber-50/70">
          <h2
            id="read-only-error-title"
            class="text-lg font-semibold text-amber-950"
          >
            Read-only credentials
          </h2>
        </div>

        <div class="px-5 py-4">
          <p class="text-sm text-slate-700">
            {{ message }}
          </p>
          <p class="mt-3 text-sm text-slate-500">
            You can still browse and download objects, but delete and empty-bucket actions are blocked for this account.
          </p>
        </div>

        <div class="px-5 py-4 border-t border-slate-100 bg-slate-50/60 flex justify-end">
          <button
            type="button"
            class="px-4 py-2 text-sm font-medium text-white bg-slate-800 rounded-xl hover:bg-slate-900 transition"
            @click="emit('close')"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
defineProps<{
  open: boolean;
  message: string;
}>();

const emit = defineEmits<{
  close: [];
}>();
</script>
