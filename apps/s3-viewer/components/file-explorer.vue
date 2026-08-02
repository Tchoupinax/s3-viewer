<template>
  <div class="flex flex-col h-full">
    <div
      class="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/60 shrink-0"
    >
      <div class="flex items-center min-w-0 gap-2 text-sm text-slate-700">
        <button
          v-if="currentLevel > 0"
          type="button"
          class="shrink-0 inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-600 bg-white/90 border border-slate-200 rounded-full shadow-sm hover:bg-slate-50 transition"
          @click="back"
        >
          Back
        </button>

        <span class="font-medium truncate text-slate-800">
          {{ formattedDirectory }}
        </span>
      </div>

      <div
        v-if="displayUploadButton"
        class="shrink-0"
      >
        <FormUploadButton
          @upload-files="($event) => emit('uploadFiles', $event)"
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

      <ul
        v-else
        class="space-y-1"
      >
        <li
          v-for="(file, index) in sortedFiles"
          :key="file.fullPath"
        >
          <div
            role="button"
            tabindex="0"
            class="flex items-center justify-between w-full px-3 py-2 text-sm transition rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            :class="{
              'bg-sky-50/80 text-sky-800 ring-1 ring-sky-100': selectedIndex === index && !isPathSelected(file.fullPath),
              'bg-sky-100/90 text-sky-900 ring-1 ring-sky-200': isPathSelected(file.fullPath),
              'hover:bg-slate-50 text-slate-700': selectedIndex !== index && !isPathSelected(file.fullPath),
            }"
            @click="onRowClick(file, $event)"
            @keydown.enter.prevent="onRowEnter(file)"
          >
            <div class="flex items-center min-w-0 gap-2 truncate">
              <label
                v-if="allowSelect"
                class="inline-flex items-center shrink-0"
                @click.stop
              >
                <input
                  type="checkbox"
                  class="rounded border-slate-300 text-sky-600 focus:ring-sky-500/30"
                  :checked="isPathSelected(file.fullPath)"
                  @change="emit('toggle-select', file)"
                >
              </label>

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
            <div class="flex items-center gap-2 text-xs text-slate-500 shrink-0">
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

              <button
                v-if="allowDelete"
                type="button"
                class="inline-flex items-center justify-center rounded-lg p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                aria-label="Delete"
                title="Delete"
                @click.stop="emit('request-delete', file)"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  class="size-4"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fill-rule="evenodd"
                    d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.286a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.47 41.47 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34 0a.75.75 0 10-1.5.06l-.3 7.5a.75.75 0 101.5-.06l.3-7.5z"
                    clip-rule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import prettyBytes from "pretty-bytes";
import { format } from "timeago.js";
import { computed, type PropType,ref, watch } from "vue";

import type { FileNode } from "~/server/types/file-node";

const $router = useRouter();
const $route = useRoute();

const emit = defineEmits([
  "enterDirectory",
  "leaveDirectory",
  "openFile",
  "uploadFiles",
  "request-delete",
  "select-node",
  "toggle-select",
  "clear-selection",
]);
const props = defineProps({
  currentDirectory: { type: String, required: true },
  currentLevel: { type: Number, required: true },
  displayUploadButton: Boolean,
  allowDelete: { type: Boolean, default: true },
  allowSelect: { type: Boolean, default: false },
  selectedPaths: {
    type: Object as PropType<Set<string>>,
    default: () => new Set<string>(),
  },
  files: { type: Array as PropType<Array<FileNode>>, required: true },
  filesCount: { type: Number, default: undefined },
});

const selectedIndex = ref(0);

const formattedDirectory = computed(() =>
  props.currentDirectory.split("/").join(" / "),
);
const sortedFiles = computed(() => {
  return [...props.files].sort((a, b) => {
    if (a.isFolder && !b.isFolder) {return -1;}
    if (!a.isFolder && b.isFolder) {return 1;}
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

function isPathSelected(path: string) {
  return props.selectedPaths.has(path);
}

function onRowClick(file: FileNode, event: MouseEvent) {
  if (
    props.allowSelect &&
    (event.shiftKey || event.ctrlKey || event.metaKey)
  ) {
    emit("select-node", file, event);
    return;
  }

  emit("clear-selection");

  if (file.isFolder) {
    enterDirectory(file.name);
  } else {
    openFile(file.fullPath);
  }
}

function onRowEnter(file: FileNode) {
  emit("clear-selection");

  if (file.isFolder) {
    enterDirectory(file.name);
  } else {
    openFile(file.fullPath);
  }
}

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
      if (a.isFolder && !b.isFolder) {return -1;}
      if (!a.isFolder && b.isFolder) {return 1;}
      return a.name.localeCompare(b.name);
    })[selectedIndex.value];

    if (selectedFile.isFolder) {
      enterDirectory(selectedFile.name);
    } else {
      openFile(selectedFile.fullPath);
    }
  }
};

watch(
  () => props.files,
  () => {
    selectedIndex.value = 0;
  },
);

onMounted(() => {
  if (!$route.query.current_directory) {
    $router.replace({ query: { ...$route.query, current_directory: "<root>" } });
  }

  document.addEventListener("keydown", handleKeyDown);
});
</script>
