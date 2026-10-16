<template>
  <div class="flex items-center gap-1">
    <label
      class="px-3 py-1.5 text-xs font-medium text-sky-800 bg-sky-50 border border-sky-200 rounded-full cursor-pointer hover:bg-sky-100 transition"
    >
      Upload
      <input
        class="hidden"
        type="file"
        multiple
        @change="onFiles"
      >
    </label>

    <label
      class="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-full cursor-pointer hover:bg-slate-50 transition"
    >
      Folder
      <input
        class="hidden"
        type="file"
        multiple
        webkitdirectory
        @change="onFiles"
      >
    </label>
  </div>
</template>

<script lang="ts" setup>
import { itemsFromFileList, type UploadItem } from "~/utils/upload-files";

const emit = defineEmits<{
  uploadFiles: [items: UploadItem[]];
}>();

function onFiles(event: Event) {
  const input = event.target as HTMLInputElement;
  if (!input.files?.length) {return;}
  emit("uploadFiles", itemsFromFileList(input.files));
  input.value = "";
}
</script>
