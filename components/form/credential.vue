<template>
  <div class="credential-form">
    <h2>{{ isEdit ? "Edit Credential" : "Create Credential" }}</h2>
    <form @submit.prevent="handleSubmit">
      <!-- Name Field -->
      <div class="form-group">
        <label for="name">Name</label>
        <input
          type="text"
          id="name"
          v-model="credential.name"
          required
          placeholder="Enter credential name"
        />
      </div>

      <!-- Color Field -->
      <div class="form-group">
        <label for="color">Color</label>
        <input type="color" id="color" v-model="credential.color" required />
      </div>

      <!-- Optional Fields -->
      <div class="form-group">
        <label for="s3AccessKey">S3 Access Key</label>
        <input
          type="text"
          id="s3AccessKey"
          v-model="credential.s3AccessKey"
          placeholder="Enter S3 Access Key"
        />
      </div>

      <div class="form-group">
        <label for="s3Bucket">S3 Bucket</label>
        <input
          type="text"
          id="s3Bucket"
          v-model="credential.s3Bucket"
          placeholder="Enter S3 Bucket"
        />
      </div>

      <div class="form-group">
        <label for="s3Endpoint">S3 Endpoint</label>
        <input
          type="text"
          id="s3Endpoint"
          v-model="credential.s3Endpoint"
          placeholder="Enter S3 Endpoint"
        />
      </div>

      <div class="form-group">
        <label for="s3Region">S3 Region</label>
        <input
          type="text"
          id="s3Region"
          v-model="credential.s3Region"
          placeholder="Enter S3 Region"
        />
      </div>

      <div class="form-group">
        <label for="s3SecretKey">S3 Secret Key</label>
        <input
          type="password"
          id="s3SecretKey"
          v-model="credential.s3SecretKey"
          placeholder="Enter S3 Secret Key"
        />
      </div>

      <!-- Submit Button -->
      <button type="submit">{{ isEdit ? "Update" : "Create" }}</button>
    </form>
  </div>
</template>

<script lang="ts">
export default {
  emits: ["create-credential", "update-credential"],
  props: {
    initialData: {
      type: Object,
      default: () => ({
        name: "",
        color: "#000000",
        s3AccessKey: "",
        s3Bucket: "",
        s3Endpoint: "",
        s3Region: "",
        s3SecretKey: "",
        workspaceId: "",
      }),
    },
    isEdit: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      credential: { ...this.initialData },
    };
  },
  methods: {
    handleSubmit() {
      if (this.isEdit) {
        this.$emit("update-credential", this.credential);
      } else {
        this.$emit("create-credential", this.credential);
      }
    },
    getRandomColor() {
      return `#${Math.floor(Math.random() * 16777215)
        .toString(16)
        .padStart(6, "0")}`;
    },
  },
  mounted() {
    if (!this.isEdit && !this.credential.color) {
      this.credential.color = this.getRandomColor();
    }
  },
};
</script>

<style scoped>
.credential-form {
  max-width: 500px;
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
