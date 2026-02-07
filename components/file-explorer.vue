<template>
  <div class="flex flex-col h-full">
    <div
      class="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/60 shrink-0"
    >
      <div class="flex items-center gap-2 text-sm text-slate-700 min-w-0">
        <button
          v-if="currentLevel > 0"
          type="button"
          @click="back"
          class="shrink-0 inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-600 bg-white/90 border border-slate-200 rounded-full shadow-sm hover:bg-slate-50 transition"
        >
          Back
        </button>

        <span class="font-medium text-slate-800 truncate">
          {{ formattedDirectory }}
        </span>
      </div>

      <div v-if="displayUploadButton" class="shrink-0">
        <FormUploadButton
          @uploadFiles="($event) => emit('uploadFiles', $event)"
        />
      </div>
    </div>

    <div class="flex-1 p-4 overflow-auto">
      <div
        v-if="files?.length === 0"
        class="mt-20 text-sm text-center text-slate-500"
      >
        No files found.
      </div>

      <ul v-else class="space-y-1">
        <li
          v-for="(file, index) in sortedFiles"
          :key="file.fullPath"
        >
          <button
            type="button"
            class="flex items-center justify-between w-full px-3 py-2 text-sm transition rounded-lg"
            :class="{
              'bg-sky-50/80 text-sky-800 ring-1 ring-sky-100': selectedIndex === index,
              'hover:bg-slate-50 text-slate-700': selectedIndex !== index,
            }"
            @click="
              file.isFolder
                ? enterDirectory(file.name)
                : openFile(file.fullPath)
            "
          >
            <!-- Name -->
            <div class="flex items-center gap-2 min-w-0 truncate">
              <IconFolder
                v-if="file.isFolder"
                class="text-amber-500/90 shrink-0 size-5"
              />
              <span
                class="truncate"
                :class="file.isFolder ? 'font-medium' : 'text-slate-600'"
              >
                {{ file.name }}
              </span>
            </div>

            <!-- Meta -->
            <div class="flex items-center gap-3 text-xs text-slate-500 shrink-0">
              <span v-if="file.lastModified">
                {{ format(file.lastModified) }}
              </span>

              <span class="font-variant-numeric tabular-nums">
                {{ prettyBytes(file.size) }}
              </span>

              <span
                v-if="file.isFolder"
                class="rounded-full bg-slate-200/80 px-2 py-0.5 text-slate-600 font-medium"
              >
                {{ file.children?.length ?? 0 }}
              </span>

              <IconDownload
                v-else
                class="size-5 text-slate-400"
              />
            </div>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, type PropType } from "vue";
import prettyBytes from "pretty-bytes";
import { format } from "timeago.js";

const $router = useRouter();
const $route = useRoute();

const emit = defineEmits([
  "enterDirectory",
  "leaveDirectory",
  "openFile",
  "uploadFiles",
]);
const props = defineProps({
  currentDirectory: { type: String, required: true },
  currentLevel: { type: Number, required: true },
  displayUploadButton: Boolean,
  files: { type: Array as PropType<Array<File>>, required: true },
  filesCount: Number,
});

const selectedIndex = ref(0);

const formattedDirectory = computed(() =>
  props.currentDirectory.split("/").join(" / ")
);
const sortedFiles = computed(() => {
  return [...props.files].sort((a, b) => {
    if (a.isFolder && !b.isFolder) return -1;
    if (!a.isFolder && b.isFolder) return 1;
    return a.name.localeCompare(b.name);
  });
});

const enterDirectory = (folderName: string) => {
  $router.replace({
    query: { ...$route.query, current_directory: props.currentDirectory + "/" + folderName },
  });

  emit("enterDirectory", folderName);
  selectedIndex.value = 0;
};

const openFile = (filePath: string) => {
  emit("openFile", filePath);
};

const back = () => {
  const parent = props.currentDirectory.split("/").slice(0, -1).join("/");
  $router.replace({ query: { ...$route.query, current_directory: parent } });

  emit("leaveDirectory");
  selectedIndex.value = 0;
};

const handleKeyDown = (event: KeyboardEvent) => {
  if (
    props.currentLevel > 0 &&
    ["Backspace", "ArrowLeft"].includes(event.code)
  ) {
    back();
  }

  if (event.code === "ArrowUp" && selectedIndex.value > 0) {
    selectedIndex.value--;
  } else if (
    event.code === "ArrowDown" &&
    props?.files &&
    selectedIndex.value < props?.files?.length - 1
  ) {
    selectedIndex.value++;
  }

  if (["Enter", "ArrowRight"].includes(event.code)) {
    const selectedFile = [...props.files].sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.name.localeCompare(b.name);
    })[selectedIndex.value];

    selectedFile.isFolder
      ? enterDirectory(selectedFile.name)
      : openFile(selectedFile.fullPath);
  }
};

watch(
  () => props.files,
  () => {
    selectedIndex.value = 0;
  }
);

onMounted(() => {
  if (!$route.query.current_directory) {
    $router.replace({ query: { ...$route.query, current_directory: "<root>" } });
  }

  document.addEventListener("keydown", handleKeyDown);
});
</script>
