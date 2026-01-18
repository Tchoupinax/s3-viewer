<template>
  <label
    v-tippy="{ content: 'Upload', placement: 'left' }"
    for="dropzone-file"
    class="flex flex-col items-center justify-center w-20 p-2 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500"
  >
    <div class="flex flex-col items-center justify-center h-full">
      <svg
        class="w-10 h-10 text-gray-500 dark:text-gray-400"
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 20 16"
      >
        <path
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"
        />
      </svg>

      <p class="hidden mb-2 text-sm text-gray-500 xl:block dark:text-gray-400">
        <span class="font-semibold">Click to upload</span> or drag and drop
      </p>
    </div>

    <form>
      <input
        hidden
        id="dropzone-file"
        type="file"
        @change="($e) => emit('uploadFiles', $e)"
        multiple
        webkitdirectory
      />
      <!--directory-->
      <!--webkitdirectory-->
    </form>
  </label>
</template>

<script lang="ts" setup>
const emit = defineEmits(["uploadFiles"]);
</script>
