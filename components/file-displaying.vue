<template>
  <div
    v-if="jsonObject || pdfUrl || imageUrl"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
  >
    <div
      class="h-full overflow-hidden bg-white shadow-lg xl:rounded-lg"
      :class="{
        'xl:w-3/4 xl:h-3/4': type !== 'pdf',
        'w-full': type === 'pdf',
      }"
    >
      <div class="flex items-center justify-between px-4 py-2 bg-gray-100">
        <h3 class="font-bold">{{ title }}</h3>
        <button
          class="text-gray-600 hover:text-gray-800"
          @click="$emit('close')"
        >
          Close
        </button>
      </div>

      <div v-if="type === 'pdf'">
        <object
          :data="pdfUrl"
          type="application/pdf"
          style="min-height: 100vh; width: 100%"
        ></object>
      </div>
    
      <div
        v-if="type === 'jpg' || type === 'jpeg'"
        class="max-h-full overflow-y-auto border border-gray-300"
      >
        <img v-if="imageUrl" :src="imageUrl" alt="Preview" class="block max-w-full" />
      </div>

      <div v-else class="h-full p-2 pt-4 overflow-auto bg-gray-50">
        <div v-html="jsonObject"></div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { getHighlighter } from "shikiji";

function processLangs(title: string) {
  if (title?.endsWith(".js")) {
    return ["javascript"];
  }

  if (title?.endsWith(".yaml")) {
    return ["yaml"];
  }

  return ["javascript"];
}

export default {
  props: {
    filename: {
      type: String,
      required: true,
    },
    bucketId: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      content: "",
      jsonObject: "",
      imageUrl: null,
      pdfUrl: null,
      selectedFileName: "",
      type: "",
      _escapeHandler: null as ((e: KeyboardEvent) => void) | null,
    };
  },
  computed: {
    title() {
      return this.filename;
    },
  },
  async mounted() {
    const encodedFilePath = btoa(encodeURIComponent(this.filename));
    const data = await $fetch(
      `/api/files/download?file=${encodedFilePath}&bucketIdentityNumber=${this.bucketId}`,
    );

    if (data) {
      this.content = data.content;
      this.type = data.type ?? "";
    }

    if (this.type === "jpg" || this.type === "jpeg") {
      this.imageUrl = `data:image/jpeg;base64,${this.content}`;
    } else if (this.type === "pdf") {
      const base64ToBlob = (base64, mimeType) => {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType });
      };

      const pdfBlob = base64ToBlob(this.content, "application/pdf");
      this.pdfUrl = URL.createObjectURL(pdfBlob);
    }

    if (this.type !== "pdf") {
      const shiki = await getHighlighter({
        themes: ["nord", "dark-plus"],
        langs: processLangs(this.filename),
      });

      await shiki.loadTheme("vitesse-light");
      await shiki.loadLanguage(processLangs(this.title)[0]);

      this.jsonObject = shiki.codeToHtml(this.content, {
        theme: "none",
        lang: "",
        defaultColor: "light",
      });
    }

    this._escapeHandler = (evt: KeyboardEvent) => {
      if (evt.key === "Escape") this.$emit("close");
    };
    document.addEventListener("keydown", this._escapeHandler);
  },
  
  beforeUnmount() {
    if (this._escapeHandler) {
      document.removeEventListener("keydown", this._escapeHandler);
    }
  },
};
</script>

<style scoped>
/* Optional: Make the scrollbar more visually appealing */
::-webkit-scrollbar {
  width: 8px;
}
::-webkit-scrollbar-thumb {
  background-color: #cbd5e1; /* Tailwind's slate-300 */
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background-color: #94a3b8; /* Tailwind's slate-400 */
}
</style>

<style>
code {
  counter-reset: step;
  counter-increment: step 0;
}

code .line::before {
  content: counter(step);
  counter-increment: step;
  width: 1rem;
  margin-right: 1.5rem;
  display: inline-block;
  text-align: right;
  color: rgba(115, 138, 148, 0.8);
}
</style>
