<template>
  <div class="bg-white rounded-lg shadow-sm border h-full flex flex-col">
    <div class="border-b px-4 py-3 flex items-center justify-between">
      <div class="flex items-center gap-2 text-sm text-gray-700">
        <button
          v-if="currentLevel > 0"
          @click="back"
          class="inline-flex items-center rounded-md border px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
        >
          Back
        </button>

        <span class="font-medium truncate">
          {{ formattedDirectory }}
        </span>
      </div>

      <div v-if="displayUploadButton">
        <FormUploadButton
          @uploadFiles="($event) => emit('uploadFiles', $event)"
        />
      </div>
    </div>

    <div class="flex-1 overflow-auto p-4">
      <div
        v-if="files?.length === 0"
        class="mt-20 text-center text-sm text-gray-500"
      >
        No files found.
      </div>

      <ul v-else class="space-y-1">
        <li
          v-for="(file, index) in sortedFiles"
          :key="file.fullPath"
        >
          <button
            class="w-full flex items-center justify-between rounded-md px-3 py-2 text-sm transition hover:bg-gray-50"
            :class="{
              'bg-blue-50 text-blue-700': selectedIndex === index,
              'text-gray-700': selectedIndex !== index,
            }"
            @click="
              file.isFolder
                ? enterDirectory(file.name)
                : openFile(file.fullPath)
            "
          >
            <!-- Name -->
            <div class="flex items-center gap-2 truncate">
              <IconFolder
                v-if="file.isFolder"
                class="shrink-0 text-gray-400"
              />
              <span
                class="truncate"
                :class="file.isFolder ? 'font-medium' : 'text-gray-500'"
              >
                {{ file.name }}
              </span>
            </div>

            <!-- Meta -->
            <div class="flex items-center gap-3 text-xs text-gray-500">
              <span v-if="file.lastModified">
                {{ format(file.lastModified) }}
              </span>

              <span>
                {{ prettyBytes(file.size) }}
              </span>

              <span
                v-if="file.isFolder"
                class="rounded-md bg-gray-100 px-2 w-10 py-0.5 text-gray-600"
              >
                {{ file.children?.length ?? 0 }}
              </span>

              <IconDownload
                v-else
                class="text-gray-400 w-10"
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
