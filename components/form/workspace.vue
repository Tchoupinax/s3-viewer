<template>
  <div class="workspace-form">
    <h2>{{ isEdit ? "Edit Workspace" : "Create Workspace" }}</h2>
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="name">Name</label>
        <input
          type="text"
          id="name"
          v-model="workspace.name"
          required
          placeholder="Enter workspace name"
        />
      </div>

      <div class="form-group">
        <label for="color">Color</label>
        <input type="color" id="color" v-model="workspace.color" required />
      </div>

      <button type="submit">{{ isEdit ? "Update" : "Create" }}</button>
    </form>
  </div>
</template>

<script>
export default {
  emits: ["create-workspace", "update-workspace"],
  props: {
    initialData: {
      type: Object,
      default: () => ({
        name: "",
        color: "#000000",
      }),
    },
    isEdit: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      workspace: { ...this.initialData },
    };
  },
  mounted() {
    this.color = `#${Math.floor(Math.random() * 16777215)
      .toString(16)
      .padStart(6, "0")}`;
  },
  methods: {
    handleSubmit() {
      if (this.isEdit) {
        this.$emit("update-workspace", this.workspace);
      } else {
        this.$emit("create-workspace", this.workspace);
      }
    },
  },
};
</script>

<style scoped>
.workspace-form {
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
