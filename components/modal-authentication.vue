<template>
  <!-- Modal -->
  <div
    id="modal"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
  >
    <div class="p-6 bg-white rounded-lg shadow-xl w-96">
      <div class="flex items-center justify-between pb-2 border-b">
        <h2 class="text-xl font-semibold text-gray-700">Authentication</h2>
        <button id="closeModalBtn" class="text-gray-400 hover:text-gray-600">
          &times;
        </button>
      </div>

      <div class="my-8">
        <button
          class="flex items-center px-6 py-3 text-black border border-black rounded-lg shadow-lg"
          @click="loginWithAuthelia"
        >
          <img
            src="https://www.authelia.com/svgs/branding/logo-cropped.svg"
            alt="Authelia Logo"
            class="mr-2 size-10"
          />
          <span class="text-primary-dark">Login with Authelia</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  methods: {
    loginWithAuthelia() {
      window.location.href = `/api/oidc/connect`;
    },
  },
};
</script>
