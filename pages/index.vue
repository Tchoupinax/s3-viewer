<template>
  <div
    class="h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-indigo-50 text-slate-900"
  >
    <FileDisplaying
      v-if="displayedFile"
      :filename="displayedFile.filename"
      :bucketId="displayedFile.bucketId"
      @close="displayedFile = null"
    >
    </FileDisplaying>

    <div
      class="flex flex-col h-full w-full max-w-[1600px] p-4 mx-auto space-y-4 sm:p-6 lg:p-8"
    >
      <header
        class="flex items-start justify-between gap-6 px-5 py-4 border shadow-sm bg-white/80 border-white/60 rounded-2xl backdrop-blur-sm shrink-0"
      >
        <div>
          <h1 class="text-3xl font-semibold tracking-tight text-slate-900">
            S3 Viewer
          </h1>
          <p class="mt-1 text-sm text-slate-500">
            Browse buckets and documents across cloud providers
          </p>
        </div>

        <div class="flex flex-wrap items-stretch gap-3 min-h-[4.5rem]">
          <template v-if="stats && stats.length">
            <div
              v-for="stat of stats"
              :key="stat.cloudProvider.name"
              class="flex items-center gap-3 px-4 py-3 bg-white/90 border border-slate-100 rounded-xl shadow-sm transition hover:shadow-md hover:-translate-y-0.5"
            >
              <img
                class="rounded-lg shadow-sm size-9"
                :src="stat.cloudProvider.logoUrl"
                :alt="stat.cloudProvider.name"
              />

              <div class="flex flex-col leading-tight">
                <span class="text-xs font-medium text-slate-500">
                  {{ stat.cloudProvider.name }}
                </span>
                <span class="text-base font-semibold text-slate-900">
                  {{ stat.sizeHuman }}
                </span>
              </div>
            </div>
          </template>

          <template v-else>
            <div
              v-for="n in 2"
              :key="n"
              class="flex items-center gap-3 px-4 py-3 border shadow-sm bg-white/70 border-slate-100 rounded-xl"
            >
              <div
                class="rounded-lg w-9 h-9 bg-slate-100/90 animate-pulse"
              ></div>

              <div class="flex flex-col gap-1 leading-tight">
                <span
                  class="w-16 h-2 rounded-full bg-slate-100/90 animate-pulse"
                ></span>
                <span
                  class="w-20 h-3 rounded-full bg-slate-200 animate-pulse"
                ></span>
              </div>
            </div>
          </template>
        </div>
      </header>

      <div
        v-if="errors.length"
        class="p-4 mt-4 text-sm text-red-700 border border-red-100 shadow-sm rounded-xl shrink-0 bg-red-50/80"
      >
        {{ errors }}
      </div>

      <div
        class="grid flex-1 grid-cols-1 gap-5 mt-6 overflow-hidden lg:grid-cols-3"
      >
        <section
          class="flex flex-col overflow-hidden border shadow-sm bg-white/80 border-slate-100 rounded-2xl backdrop-blur"
        >
          <div
            class="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/60 shrink-0"
          >
            <h2
              class="text-xs font-semibold tracking-wide uppercase text-slate-600"
            >
              Buckets ({{ buckets.length }})
            </h2>

            <div
              class="flex items-center gap-1 p-0.5 bg-slate-100 rounded-full"
            >
              <button
                :disabled="loadingBuckets"
                @click="
                  sortBy === 'name'
                    ? (sortDirection = sortDirection === 'asc' ? 'desc' : 'asc')
                    : ((sortBy = 'name'), (sortDirection = 'asc'))
                "
                :class="[
                  'px-3 py-1.5 text-xs rounded-full transition',
                  sortBy === 'name'
                    ? 'bg-white shadow-sm text-slate-900'
                    : 'text-slate-500',
                  loadingBuckets || buckets.length === 0
                    ? 'cursor-not-allowed opacity-50 hover:bg-transparent'
                    : 'hover:text-slate-700 hover:bg-white',
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
                  'px-3 py-1.5 text-xs rounded-full transition',
                  sortBy === 'size'
                    ? 'bg-white shadow-sm text-slate-900'
                    : 'text-slate-500',
                  loadingBuckets || buckets.length === 0
                    ? 'cursor-not-allowed opacity-50 hover:bg-transparent'
                    : 'hover:text-slate-700 hover:bg-white',
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
            <div
              v-if="loadingBuckets"
              class="flex items-center justify-center h-full"
            >
              <div class="flex flex-col items-center gap-3 cube-loader">
                <div class="cube-grid">
                  <span class="cube-piece cube-piece-1"></span>
                  <span class="cube-piece cube-piece-2"></span>
                  <span class="cube-piece cube-piece-3"></span>
                  <span class="cube-piece cube-piece-4"></span>
                </div>
                <span
                  class="text-xs font-medium tracking-wide uppercase text-slate-500"
                >
                  Loading buckets…
                </span>
              </div>
            </div>

            <ul v-else class="space-y-2">
              <li v-for="bucket in sortedBuckets" :key="bucket.id">
                <button
                  @click="
                    bucket.errorMessage === null ? selectBucket(bucket.id) : ''
                  "
                  :class="[
                    'w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition',
                    selectedBucketId === bucket.id
                      ? 'bg-sky-50/80 text-sky-800 ring-1 ring-sky-100'
                      : 'hover:bg-slate-50 text-slate-700',
                    bucket.errorMessage !== null
                      ? 'text-red-500 cursor-not-allowed hover:bg-red-50/80'
                      : '',
                  ]"
                >
                  <img
                    class="rounded-lg shadow-sm size-8"
                    :src="bucket.cloudProvider.logoUrl"
                    alt=""
                  />

                  <div class="flex-1">
                    <div
                      class="flex items-baseline justify-between gap-2 font-medium text-left"
                    >
                      <h2 class="text-sm">
                        {{ bucket.errorMessage ?? bucket.name }}
                      </h2>
                      <p
                        v-if="bucket.errorMessage === null"
                        class="text-xs text-slate-600"
                      >
                        {{ bucket.sizeHuman }}
                      </p>
                    </div>
                    <div class="mt-0.5 text-xs text-slate-500">
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
          class="flex flex-col overflow-hidden border shadow-sm bg-white/80 border-slate-100 rounded-2xl backdrop-blur lg:col-span-2"
        >
          <!-- Documents header with List/Tree toggle -->
          <div
            class="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/60 shrink-0"
          >
            <h2
              class="text-xs font-semibold tracking-wide uppercase text-slate-600"
            >
              Documents
            </h2>

            <div
              class="flex items-center gap-1 p-0.5 bg-slate-100 rounded-full"
            >
              <button
                :disabled="loadingDocuments || !documents.length"
                type="button"
                :class="[
                  'px-3 py-1.5 text-xs rounded-full transition',
                  documentsViewMode === 'list'
                    ? 'bg-white shadow-sm text-slate-900'
                    : 'text-slate-500',
                  loadingDocuments || !documents.length
                    ? 'cursor-not-allowed opacity-50 hover:bg-transparent'
                    : 'hover:text-slate-700 hover:bg-white',
                ]"
                @click="documentsViewMode = 'list'"
              >
                File Explorer
              </button>

              <button
                :disabled="loadingDocuments || !documents.length"
                type="button"
                :class="[
                  'px-3 py-1.5 text-xs rounded-full transition',
                  documentsViewMode === 'tree'
                    ? 'bg-white shadow-sm text-slate-900'
                    : 'text-slate-500',
                  loadingDocuments || !documents.length
                    ? 'cursor-not-allowed opacity-50 hover:bg-transparent'
                    : 'hover:text-slate-700 hover:bg-white',
                ]"
                @click="documentsViewMode = 'tree'"
              >
                Tree
              </button>
            </div>
          </div>

          <!-- Documents content (scrollable) -->
          <div class="flex-1 p-4 overflow-y-auto">
            <p
              v-if="loadingDocuments && documents.length === 0"
              class="text-sm text-slate-500"
            >
              Loading documents…
            </p>

            <template v-if="documentsViewMode === 'list'">
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
            </template>

            <template
              v-else-if="documentsViewMode === 'tree' && documents.length"
            >
              <div class="tree-view">
                <div
                  v-for="node in documents"
                  :key="node.fullPath"
                  class="tree-view-root"
                >
                  <DocumentsTreeNode
                    :node="node"
                    :collapsed-paths="treeCollapsedPaths"
                    :format-size="formatSize"
                    :format-date="format"
                    :count-files="countFilesInNode"
                    @toggle="toggleTreePath"
                    @open-file="openFile"
                  />
                </div>
              </div>
            </template>

            <p
              v-else-if="documentsViewMode === 'tree' && !documents.length"
              class="text-sm text-slate-500"
            >
              No documents to show in tree.
            </p>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { format } from "timeago.js";
import prettyBytes from "pretty-bytes";
import type { S3ViewerBucket } from "~/server/types/bucket";
import type { S3ViewerDocument } from "~/server/types/document";
import type { FileNode } from "~/server/types/file-node";
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
const documentsViewMode = ref<"list" | "tree">("tree");
const treeCollapsedPaths = ref<Set<string>>(new Set());

const PAGE_SIZE = 20;

function formatSize(size: number): string {
  return prettyBytes(size ?? 0);
}

function countFilesInNode(node: FileNode): number {
  if (!node.isFolder) return 1;
  return (node.children ?? []).reduce(
    (sum, child) => sum + countFilesInNode(child),
    0,
  );
}

function getAllFolderPaths(nodes: FileNode[]): string[] {
  const paths: string[] = [];
  for (const node of nodes) {
    if (node.isFolder) {
      paths.push(node.fullPath);
      if (node.children?.length)
        paths.push(...getAllFolderPaths(node.children));
    }
  }
  return paths;
}

function toggleTreePath(fullPath: string) {
  const next = new Set(treeCollapsedPaths.value);
  if (next.has(fullPath)) next.delete(fullPath);
  else next.add(fullPath);
  treeCollapsedPaths.value = next;
}

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
    treeCollapsedPaths.value = new Set(
      getAllFolderPaths((res.data.files ?? []) as FileNode[]),
    );
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
    let tempFiles = documents.value ?? [];
    const indexes = currentIndexes.value;
    for (let i = 0; i < indexes.length - 1; i++) {
      const node = tempFiles?.[indexes[i]];
      const next = node?.children;
      if (next == null) break;
      tempFiles = next;
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

<style scoped>
.tree-view {
  padding: 0.125rem 0;
}

.tree-view-root {
  margin-bottom: 0.125rem;
}

.tree-view-root:last-child {
  margin-bottom: 0;
}

.cube-grid {
  width: 2.5rem;
  height: 2.5rem;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.25rem;
}

.cube-piece {
  border-radius: 0.375rem;
  background: linear-gradient(135deg, #0ea5e9, #6366f1);
  box-shadow: 0 4px 10px rgba(15, 23, 42, 0.18);
  animation: cubePulse 1.1s ease-in-out infinite;
  transform-origin: center;
}

.cube-piece-1 {
  animation-delay: 0s;
}

.cube-piece-2 {
  animation-delay: 0.12s;
}

.cube-piece-3 {
  animation-delay: 0.24s;
}

.cube-piece-4 {
  animation-delay: 0.36s;
}

@keyframes cubePulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  40% {
    transform: scale(0.6);
    opacity: 0.8;
  }
}
</style>
