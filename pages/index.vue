<template>
  <div class="h-screen overflow-hidden bg-gray-50">
    <div class="flex flex-col h-full p-6 mx-auto max-w-8xl">
      <header class="flex items-start justify-between gap-6 shrink-0">
        <div>
          <h1 class="text-2xl font-semibold text-gray-900">S3 Viewer</h1>
          <p class="text-sm text-gray-500">Browse buckets and documents</p>
        </div>

        <div class="flex gap-4">
          <div
            v-for="stat of stats"
            :key="stat.cloudProvider.name"
            class="flex items-center gap-3 px-4 py-3 transition bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow"
          >
            <img
              class="rounded size-9"
              :src="stat.cloudProvider.logoUrl"
              :alt="stat.cloudProvider.name"
            />

            <div class="flex flex-col leading-tight">
              <span class="text-xs text-gray-500">
                {{ stat.cloudProvider.name }}
              </span>
              <span class="text-sm font-semibold text-gray-900">
                {{ stat.sizeHuman }}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div
        v-if="error"
        class="p-4 mt-4 text-sm text-red-700 border border-red-200 rounded-md shrink-0 bg-red-50"
      >
        {{ error }}
      </div>

      <div
        class="grid flex-1 grid-cols-1 gap-6 mt-6 overflow-hidden lg:grid-cols-3"
      >
        <section
          class="flex flex-col overflow-hidden bg-white border rounded-lg shadow-sm"
        >
          <div
            class="flex items-center justify-between px-4 py-3 border-b shrink-0"
          >
            <h2 class="text-sm font-medium text-gray-700">
              Buckets ({{ buckets.length }})
            </h2>

            <div class="flex items-center gap-1 p-0.5 bg-gray-100 rounded-lg">
              <button
                @click="
                  sortBy === 'name'
                    ? (sortDirection = sortDirection === 'asc' ? 'desc' : 'asc')
                    : ((sortBy = 'name'), (sortDirection = 'asc'))
                "
                :class="[
                  'px-3 py-1.5 text-xs rounded-md transition',
                  sortBy === 'name'
                    ? 'bg-white shadow text-gray-900'
                    : 'text-gray-500 hover:text-gray-700',
                ]"
              >
                Name
                <span v-if="sortBy === 'name'" class="ml-1 text-[10px]">
                  {{ sortDirection === "asc" ? "↑" : "↓" }}
                </span>
              </button>

              <button
                @click="
                  sortBy === 'size'
                    ? (sortDirection = sortDirection === 'asc' ? 'desc' : 'asc')
                    : ((sortBy = 'size'), (sortDirection = 'asc'))
                "
                :class="[
                  'px-3 py-1.5 text-xs rounded-md transition',
                  sortBy === 'size'
                    ? 'bg-white shadow text-gray-900'
                    : 'text-gray-500 hover:text-gray-700',
                ]"
              >
                Size
                <span v-if="sortBy === 'size'" class="ml-1 text-[10px]">
                  {{ sortDirection === "asc" ? "↑" : "↓" }}
                </span>
              </button>
            </div>
          </div>

          <div class="flex-1 p-4 overflow-y-auto">
            <p v-if="loadingBuckets" class="text-sm text-gray-500">
              Loading buckets…
            </p>

            <ul v-else class="space-y-2">
              <li
                v-for="(bucket, bucketIndex) in sortedBuckets"
                :key="bucketIndex"
              >
                <button
                  @click="selectBucket(bucket.id)"
                  :class="[
                    'w-full flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition',
                    selectedBucketId === bucket.id
                      ? 'bg-blue-50 text-blue-700'
                      : 'hover:bg-gray-50 text-gray-700',
                  ]"
                >
                  <img
                    class="rounded size-8"
                    :src="bucket.cloudProvider.logoUrl"
                    alt=""
                  />

                  <div class="flex-1">
                    <div class="flex justify-between font-medium">
                      <h2 class="text-lg">{{ bucket.name }}</h2>
                      <p class="text-sm">{{ bucket.sizeHuman }}</p>
                    </div>
                    <div class="text-xs text-gray-500">
                      {{ bucket.cloudProvider.name }} ·
                      {{ bucket.organizationOrAccountName }} ·
                      {{ bucket.region }}
                    </div>
                  </div>
                </button>
              </li>
            </ul>
          </div>
        </section>
        <!-- RIGHT CONTENT -->
        <section
          v-if="selectedBucketId"
          class="flex flex-col overflow-hidden bg-white border rounded-lg shadow-sm lg:col-span-2"
        >
          <file-explorer
            class="shrink-0"
            currentDirectory="<root>"
            :currentLevel="currentIndexes.length"
            :files="currentFiles"
            :filesCount="documentsCount"
            @enterDirectory="handleDirectoryEntered"
            @leaveDirectory="handleDirectoryLeft"
            :displayUploadButton="false"
          />

          <!-- Documents header -->
          <div class="px-4 py-3 border-b shrink-0">
            <h2 class="text-sm font-medium text-gray-700">Documents</h2>
          </div>

          <!-- Documents content (scrollable) -->
          <div class="flex-1 p-4 overflow-y-auto">
            <p
              v-if="loadingDocuments && documents.length === 0"
              class="text-sm text-gray-500"
            >
              Loading documents…
            </p>

            <div v-if="documents.length" class="overflow-x-auto">
              <table class="min-w-full text-sm">
                <thead>
                  <tr class="text-left text-gray-500 border-b">
                    <th class="py-2 font-medium">Key</th>
                    <th class="py-2 font-medium">Size</th>
                    <th class="py-2 font-medium">Last modified</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="doc in documents"
                    :key="doc.name"
                    class="border-b last:border-0 hover:bg-gray-50"
                  >
                    <td class="py-2 font-mono text-xs text-gray-800">
                      {{ doc.name }}
                    </td>
                    <td class="py-2 text-gray-600">
                      {{ doc.sizeHuman }}
                    </td>
                    <td class="py-2 text-gray-600">
                      {{ doc.lastModified ? format(doc.lastModified) : "" }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p
              v-if="!loadingDocuments && documents.length === 0"
              class="text-sm text-gray-500"
            >
              No documents found.
            </p>

            <div class="mt-4">
              <button
                :disabled="loadingDocuments"
                @click="loadDocuments()"
                class="inline-flex items-center rounded-md border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {{ loadingDocuments ? "Loading…" : "Load more" }}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { format } from "timeago.js";
import type { S3ViewerBucket } from "~/server/types/bucket";
import type { S3ViewerDocument } from "~/server/types/document";
import { match } from "ts-pattern";

useHead({
  title: "🚀 DEV 🚀 S3 Viewer",
});

const $router = useRouter();
const $route = useRoute();

const buckets = ref<Array<S3ViewerBucket>>([]);
const selectedBucketId = ref<string | null>(null);
const documents = ref<Array<S3ViewerDocument>>([]);
const documentsCount = ref<number>(0);
const currentDirectory = ref("<root>");
const currentFiles = ref([]);
const currentIndexes = ref<number[]>([]);
const stats = ref();
const sortBy = ref<"name" | "size">("name");
const sortDirection = ref<"asc" | "desc">("asc");

const loadingBuckets = ref(false);
const loadingDocuments = ref(false);
const error = ref<string | null>(null);

const PAGE_SIZE = 20;

const sortedBuckets = computed(() =>
  buckets.value.sort((a, b) =>
    match(sortBy.value)
      .with("name", () =>
        (sortDirection.value === "asc" ? a.name > b.name : a.name < b.name)
          ? 1
          : -1,
      )
      .with("size", () =>
        (sortDirection.value === "asc" ? a.size > b.size : a.size < b.size)
          ? -1
          : 1,
      )
      .exhaustive(),
  ),
);

const selectBucket = async (id: string) => {
  selectedBucketId.value = id;

  try {
    const res = await $fetch(`/api/buckets/${id}/documents`);
    documents.value = res.data.files;
    currentFiles.value = res.data.files ?? [];
    documentsCount.value = res.data.filesCount;
  } catch (e: any) {
    error.value = e?.statusMessage || "Failed to load buckets";
  } finally {
    loadingBuckets.value = false;
    $router.replace({ query: { ...$route.query, bucket: id } });
  }
};

const loadBuckets = async () => {
  loadingBuckets.value = true;
  error.value = null;

  try {
    const res = await $fetch("/api/buckets");
    buckets.value = res.data.buckets;
    stats.value = res.data.stats;
  } catch (e: any) {
    error.value = e?.statusMessage || "Failed to load buckets";
  } finally {
    loadingBuckets.value = false;
  }
};

const loadDocuments = async (reset = false) => {
  if (!selectedBucketId.value) {
    return;
  }

  loadingDocuments.value = true;
  error.value = null;

  try {
    const res = await $fetch<{
      items: DocumentItem[];
      nextCursor: string | null;
    }>(`/api/buckets/${selectedBucket.value}/documents`, {
      query: {
        limit: PAGE_SIZE,
        cursor: reset ? undefined : nextCursor.value,
      },
    });

    documents.value = reset ? res.items : [...documents.value, ...res.items];

    nextCursor.value = res.nextCursor;
  } catch (e: any) {
    error.value = e?.statusMessage || "Failed to load documents";
  } finally {
    loadingDocuments.value = false;
  }
};

onMounted(() => {
  loadBuckets();

  const localCurrentDirectory = $route.query.current_directory as string;
  if (localCurrentDirectory) {
    currentDirectory.value = localCurrentDirectory;

    if (currentFiles.value) {
      const parts = localCurrentDirectory.split("/");
      for (const part of parts.slice(1)) {
        const folderIndex = currentFiles.value.findIndex(
          (f) => f.name === part,
        );
        currentFiles.value = currentFiles.value[folderIndex]?.children ?? [];
        currentIndexes.value.push(folderIndex);
      }
    }
  }
});

const handleDirectoryEntered = (folderName: string) => {
  const folderIndex = currentFiles.value.findIndex(
    (f) => f.name === folderName,
  );
  const nodeName = currentFiles.value[folderIndex].name;
  currentFiles.value = currentFiles.value[folderIndex]?.children ?? [];

  currentIndexes.value.push(folderIndex);
  currentDirectory.value += `/${nodeName}`;
};

const handleDirectoryLeft = () => {
  if (currentIndexes.value.length === 1) {
    currentFiles.value = documents.value ?? [];
  } else {
    let tempFiles = documents.value;
    for (let i = 0; i < currentIndexes.value.length - 1; i++) {
      tempFiles = tempFiles[currentIndexes.value[i]].children;
    }
    currentFiles.value = tempFiles ?? [];
  }

  currentIndexes.value.pop();
  currentDirectory.value = currentDirectory.value
    .split("/")
    .slice(0, -1)
    .join("/");
};
</script>
