<template>
  <div class="flex">
    <div
      v-for="workspace of apiData?.workspaces"
      :style="`background: ${workspace.color};`"
      @click="changeWorkspace(workspace)"
      class="flex items-center justify-center p-2 mr-2 text-2xl font-bold text-center text-white border-2 border-gray-600 rounded-lg cursor-pointer size-12"
    >
      {{ workspace.name.slice(0, 1) }}
    </div>

    <div
      class="flex items-center justify-center"
      v-if="apiData?.workspaces.length === 0"
    >
      <NuxtLink class="ml-4 text-2xl underline cursor-pointer"
        >Create your first workspace</NuxtLink
      >
    </div>

    <span
      :style="`color: ${preferencesStore.currentWorkspace?.color};`"
      class="ml-4 text-4xl text-white"
      >|</span
    >

    <div
      :style="`color: ${preferencesStore.currentWorkspace?.color};`"
      class="flex items-center justify-center ml-4 text-3xl text-white"
    >
      {{ preferencesStore.currentWorkspace?.name }}
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { Workspace } from ".prisma/client";
import type { MapDateToString } from "~/server/config/types";

const emit = defineEmits(["workspaceChanged"]);
const preferencesStore = usePreferencesStore();
const { data: apiData } = await useFetch(`/api/workspaces`);

const changeWorkspace = (workspace: MapDateToString<Workspace>) => {
  preferencesStore.changeWorkspace(workspace).then(async () => {
    emit("workspaceChanged", workspace);
  });
};
</script>
