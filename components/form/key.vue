<template>
  <div class="key-form">
    <h2>{{ isEdit ? "Edit Workspace" : "Create Encryption Keys" }}</h2>

    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="name">
          Name
          <input
            type="text"
            v-model="formData.name"
            required
            placeholder="Enter name"
          />
        </label>
      </div>

      <div class="form-group">
        <label for="publicKey">
          Public Key
          <input
            type="text"
            v-model="formData.publicKey"
            required
            placeholder="Enter public key"
          />
        </label>
      </div>

      <div class="form-group">
        <label for="privateKey">
          Private Key
          <input
            type="password"
            v-model="formData.privateKey"
            required
            placeholder="Enter private key"
          />
        </label>
      </div>

      <button @click="generateNewKeys" class="w-full text-black bg-purple-200">
        Generate Keys
      </button>

      <button class="w-full mt-8" type="submit">
        {{ isEdit ? "Update" : "Create" }}
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

const emit = defineEmits(["keyCreated", "keyUpdated"]);
const props = defineProps({
  isEdit: { type: Boolean, required: true },
});

// Reactive state
const formData = ref({
  name: "",
  publicKey: "",
  privateKey: "",
});

const generateNewKeys = async (e: Event) => {
  e.preventDefault();

  const data = await $fetch("/api/keys/generate", {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  formData.value.publicKey = data.publicKey;
  formData.value.privateKey = data.privateKey;
};

const handleSubmit = async () => {
  const response = await $fetch("/api/keys", {
    credentials: "include",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(formData.value),
  });

  emit("keyCreated", response);
};
</script>

<style scoped>
.key-form {
  max-width: 400px;
  margin: 0 auto;
  padding: 1em;
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: #f9f9f9;
}

.form-group {
  margin-bottom: 1em;
}

label {
  display: block;
  margin-bottom: 0.5em;
}

input {
  width: 100%;
  padding: 0.5em;
  box-sizing: border-box;
}

button {
  padding: 0.7em 1.5em;
  color: #fff;
  background-color: #007bff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background-color: #0056b3;
}
</style>
