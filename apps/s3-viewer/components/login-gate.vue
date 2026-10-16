<template>
  <div class="flex items-center justify-center h-screen bg-gradient-to-br from-sky-50 via-white to-indigo-50">
    <form
      class="w-full max-w-sm p-6 bg-white border shadow-sm border-slate-100 rounded-2xl"
      @submit.prevent="submit"
    >
      <h1 class="text-2xl font-semibold text-slate-900">
        S3 Viewer
      </h1>
      <p class="mt-1 text-sm text-slate-500">
        Sign in to browse buckets.
      </p>

      <label class="block mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Username
        <input
          v-model="username"
          autocomplete="username"
          class="block w-full mt-1 px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-800 border border-slate-200 rounded-xl"
        >
      </label>

      <label class="block mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Password
        <input
          v-model="password"
          type="password"
          autocomplete="current-password"
          class="block w-full mt-1 px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-800 border border-slate-200 rounded-xl"
        >
      </label>

      <p
        v-if="error"
        class="mt-3 text-sm text-red-700"
      >
        {{ error }}
      </p>

      <button
        type="submit"
        class="w-full mt-5 px-3 py-2 text-sm font-medium text-white bg-slate-900 rounded-xl disabled:opacity-50"
        :disabled="busy"
      >
        Sign in
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

import { getFetchErrorMessage } from "~/utils/api-error";

const emit = defineEmits<{
  success: [];
}>();

const username = ref("");
const password = ref("");
const error = ref("");
const busy = ref(false);

async function submit() {
  busy.value = true;
  error.value = "";
  try {
    await $fetch("/api/auth/login", {
      method: "POST",
      body: {
        username: username.value,
        password: password.value,
      },
    });
    emit("success");
  } catch (err: unknown) {
    error.value = getFetchErrorMessage(err, "Sign in failed");
  } finally {
    busy.value = false;
  }
}
</script>
