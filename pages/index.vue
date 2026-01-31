<template>
  <div class="h-screen overflow-hidden bg-gray-50">
    <FileDisplaying
      v-if="displayedFile"
      :filename="displayedFile.filename"
      :bucketId="displayedFile.bucketId"
      @close="displayedFile = null"
    >
    </FileDisplaying>

    <div class="flex flex-col h-full p-6 mx-auto max-w-8xl">
      <header class="flex items-start justify-between gap-6 shrink-0">
        <div>
          <h1 class="text-2xl font-semibold text-gray-900">S3 Viewer</h1>
          <p class="text-sm text-gray-500">Browse buckets and documents</p>
        </div>

        <div class="flex h-16 gap-2">
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
        v-if="errors.length"
        class="p-4 mt-4 text-sm text-red-700 border border-red-200 rounded-md shrink-0 bg-red-50"
      >
        {{ errors }}
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
                :disabled="loadingBuckets"
                @click="
                  sortBy === 'name'
                    ? (sortDirection = sortDirection === 'asc' ? 'desc' : 'asc')
                    : ((sortBy = 'name'), (sortDirection = 'asc'))
                "
                :class="[
                  'px-3 py-1.5 text-xs rounded-md transition',
                  sortBy === 'name'
                    ? 'bg-white shadow text-gray-900'
                    : 'text-gray-500',
                  loadingBuckets || buckets.length === 0
                    ? 'cursor-not-allowed opacity-50 hover:bg-transparent'
                    : 'hover:text-gray-700 hover:bg-white',
                ]"
              >
                Name
                <span v-if="sortBy === 'name'" class="ml-1 text-[10px]">
                  {{ sortDirection === "asc" ? "↑" : "↓" }}
                </span>
              </button>

              <button
                :disabled="loadingBuckets"
                @click="
                  sortBy === 'size'
                    ? (sortDirection = sortDirection === 'asc' ? 'desc' : 'asc')
                    : ((sortBy = 'size'), (sortDirection = 'asc'))
                "
                :class="[
                  'px-3 py-1.5 text-xs rounded-md transition',
                  sortBy === 'size'
                    ? 'bg-white shadow text-gray-900'
                    : 'text-gray-500',
                  loadingBuckets || buckets.length === 0
                    ? 'cursor-not-allowed opacity-50 hover:bg-transparent'
                    : 'hover:text-gray-700 hover:bg-white',
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
              <li v-for="bucket in sortedBuckets" :key="bucket.id">
                <button
                  @click="
                    bucket.errorMessage === null ? selectBucket(bucket.id) : ''
                  "
                  :class="[
                    'w-full flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition',
                    selectedBucketId === bucket.id
                      ? 'bg-blue-50 text-blue-700'
                      : 'hover:bg-gray-50 text-gray-700',
                    bucket.errorMessage !== null
                      ? 'text-red-500 cursor-not-allowed hover:bg-red-50'
                      : '',
                  ]"
                >
                  <img
                    class="rounded size-8"
                    :src="bucket.cloudProvider.logoUrl"
                    alt=""
                  />

                  <div class="flex-1">
                    <div class="flex justify-between font-medium">
                      <h2 class="text-lg">
                        {{ bucket.errorMessage ?? bucket.name }}
                      </h2>
                      <p v-if="bucket.errorMessage === null" class="text-sm">
                        {{ bucket.sizeHuman }}
                      </p>
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
            @openFile="(filename) => openFile(filename)"
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
import {
  extractGenerateBucketIdentity,
  type BucketIdentityNumber,
} from "~/functions/bucket-identity-number";

const $router = useRouter();
const $route = useRoute();

useHead({
  title:
    window?.location &&
    new URL(window?.location?.toString()).hostname === "localhost"
      ? "🚀 DEV 🚀 S3 Viewer"
      : "S3 Viewer",
});

const buckets = ref<Array<S3ViewerBucket>>([]);
const currentDirectory = ref("<root>");
const currentFiles = ref([]);
const currentIndexes = ref<number[]>([]);
const documents = ref<Array<S3ViewerDocument>>([]);
const documentsCount = ref<number>(0);
const displayedFile = ref<{ filename: string; bucketId: string } | null>();
const selectedBucketId = ref<BucketIdentityNumber | null>(null);
const sortBy = ref<"name" | "size">("name");
const sortDirection = ref<"asc" | "desc">("asc");
const stats = ref();

const loadingBuckets = ref(false);
const loadingDocuments = ref(false);
const errors = ref<Array<string>>([]);

const PAGE_SIZE = 20;

const sortedBuckets = computed(() =>
  buckets.value.toSorted((a, b) =>
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

const loadBuckets = async () => {
  loadingBuckets.value = true;

  try {
    const res = await $fetch("/api/buckets");
    buckets.value = res.data.buckets;
    stats.value = res.data.stats;
  } finally {
    loadingBuckets.value = false;
  }
};

const selectBucket = async (bucketIdentityNumber: BucketIdentityNumber) => {
  selectedBucketId.value = bucketIdentityNumber;

  try {
    const res = await $fetch(`/api/buckets/${bucketIdentityNumber}/documents`);
    documents.value = res.data.files;
    currentFiles.value = res.data.files ?? [];
    documentsCount.value = res.data.filesCount;
  } finally {
    loadingBuckets.value = false;
    $router.replace({ query: { ...$route.query, bin: bucketIdentityNumber } });
  }
};

const loadDocuments = async (reset = false) => {
  if (!selectedBucketId.value) {
    return;
  }

  loadingDocuments.value = true;

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

const openFile = async (filename: string) => {
  if (selectedBucketId.value) {
    displayedFile.value = {
      filename: filename,
      bucketId: selectedBucketId.value,
    };
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
</script>
