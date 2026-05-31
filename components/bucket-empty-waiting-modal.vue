<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bucket-empty-waiting-title"
      aria-busy="true"
    >
      <div
        class="w-full max-w-md overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-b from-sky-50 via-white to-indigo-50 shadow-2xl"
      >
        <div class="px-6 pt-8 pb-4 flex flex-col items-center text-center">
          <div
            class="relative mb-5 h-40 w-40"
            aria-hidden="true"
          >
            <div class="waiting-cloud waiting-cloud-left" />
            <div class="waiting-cloud waiting-cloud-right" />

            <div class="princess">
              <div class="princess-sparkle princess-sparkle-1">✦</div>
              <div class="princess-sparkle princess-sparkle-2">✧</div>
              <div class="princess-sparkle princess-sparkle-3">✦</div>

              <svg
                class="princess-svg"
                viewBox="0 0 120 140"
                xmlns="http://www.w3.org/2000/svg"
              >
                <ellipse
                  cx="60"
                  cy="128"
                  rx="28"
                  ry="6"
                  fill="rgb(148 163 184 / 0.25)"
                />

                <g class="princess-dress">
                  <path
                    d="M38 88 C42 72, 48 66, 60 66 C72 66, 78 72, 82 88 L88 118 C88 124, 82 128, 60 128 C38 128, 32 124, 32 118 Z"
                    fill="#f472b6"
                  />
                  <path
                    d="M44 88 C48 78, 54 74, 60 74 C66 74, 72 78, 76 88"
                    fill="none"
                    stroke="#ec4899"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                </g>

                <rect
                  x="48"
                  y="58"
                  width="24"
                  height="18"
                  rx="8"
                  fill="#fde68a"
                />

                <circle
                  cx="60"
                  cy="46"
                  r="18"
                  fill="#fde68a"
                />

                <path
                  d="M42 40 C46 28, 54 22, 60 22 C66 22, 74 28, 78 40 L72 36 C68 30, 64 28, 60 28 C56 28, 52 30, 48 36 Z"
                  fill="#fbbf24"
                />
                <circle
                  cx="60"
                  cy="24"
                  r="4"
                  fill="#ef4444"
                />
                <circle
                  cx="52"
                  cy="28"
                  r="3"
                  fill="#3b82f6"
                />
                <circle
                  cx="68"
                  cy="28"
                  r="3"
                  fill="#22c55e"
                />

                <circle
                  cx="54"
                  cy="44"
                  r="2.5"
                  fill="#1e293b"
                />
                <circle
                  cx="66"
                  cy="44"
                  r="2.5"
                  fill="#1e293b"
                />
                <circle
                  cx="55"
                  cy="43"
                  r="0.8"
                  fill="white"
                />
                <circle
                  cx="67"
                  cy="43"
                  r="0.8"
                  fill="white"
                />

                <path
                  d="M56 52 Q60 56 64 52"
                  fill="none"
                  stroke="#f97316"
                  stroke-width="1.5"
                  stroke-linecap="round"
                />

                <path
                  d="M40 52 C34 48, 30 56, 36 62"
                  fill="none"
                  stroke="#fde68a"
                  stroke-width="5"
                  stroke-linecap="round"
                />
                <path
                  d="M80 52 C86 48, 90 56, 84 62"
                  fill="none"
                  stroke="#fde68a"
                  stroke-width="5"
                  stroke-linecap="round"
                />

                <g class="princess-wand">
                  <line
                    x1="84"
                    y1="58"
                    x2="98"
                    y2="42"
                    stroke="#a855f7"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                  <polygon
                    points="98,42 102,36 106,42 102,48"
                    fill="#fde047"
                  />
                </g>
              </svg>
            </div>
          </div>

          <h2
            id="bucket-empty-waiting-title"
            class="text-xl font-semibold text-slate-900"
          >
            Emptying bucket…
          </h2>

          <p
            v-if="bucketName"
            class="mt-2 text-sm text-slate-700"
          >
            Removing all objects from
            <span class="font-mono font-semibold text-slate-900">{{ bucketName }}</span>
          </p>

          <p class="mt-3 text-sm text-slate-500 leading-relaxed">
            The princess is clearing the vault. Large buckets can take several minutes — please keep this page open.
          </p>

          <div class="mt-5 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-sky-700">
            <span class="waiting-dot" />
            <span class="waiting-dot waiting-dot-delay-1" />
            <span class="waiting-dot waiting-dot-delay-2" />
            <span>Working</span>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
defineProps<{
  open: boolean;
  bucketName?: string | null;
}>();
</script>

<style scoped>
.princess {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: princess-bob 2.4s ease-in-out infinite;
}

.princess-svg {
  width: 7.5rem;
  height: 8.75rem;
  overflow: visible;
}

.princess-dress {
  transform-origin: 60px 96px;
  animation: dress-sway 1.8s ease-in-out infinite;
}

.princess-wand {
  transform-origin: 84px 58px;
  animation: wand-wave 1.2s ease-in-out infinite;
}

.princess-sparkle {
  position: absolute;
  color: #fbbf24;
  font-size: 0.875rem;
  opacity: 0;
  animation: sparkle-pop 2s ease-in-out infinite;
}

.princess-sparkle-1 {
  top: 1.25rem;
  left: 2.5rem;
}

.princess-sparkle-2 {
  top: 0.5rem;
  right: 2.75rem;
  animation-delay: 0.6s;
}

.princess-sparkle-3 {
  top: 2rem;
  right: 1.5rem;
  animation-delay: 1.2s;
}

.waiting-cloud {
  position: absolute;
  top: 1.5rem;
  width: 3rem;
  height: 1.25rem;
  border-radius: 9999px;
  background: rgb(255 255 255 / 0.85);
  box-shadow:
    1.25rem 0.2rem 0 -0.15rem rgb(255 255 255 / 0.85),
    -1rem 0.15rem 0 -0.1rem rgb(255 255 255 / 0.7);
  opacity: 0.8;
}

.waiting-cloud-left {
  left: 0.25rem;
  animation: cloud-drift 4s ease-in-out infinite;
}

.waiting-cloud-right {
  right: 0.25rem;
  animation: cloud-drift 4s ease-in-out infinite reverse;
}

.waiting-dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 9999px;
  background: #0ea5e9;
  animation: dot-bounce 1.2s ease-in-out infinite;
}

.waiting-dot-delay-1 {
  animation-delay: 0.15s;
}

.waiting-dot-delay-2 {
  animation-delay: 0.3s;
}

@keyframes princess-bob {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-8px);
  }
}

@keyframes dress-sway {
  0%,
  100% {
    transform: rotate(-2deg);
  }

  50% {
    transform: rotate(2deg);
  }
}

@keyframes wand-wave {
  0%,
  100% {
    transform: rotate(-8deg);
  }

  50% {
    transform: rotate(14deg);
  }
}

@keyframes sparkle-pop {
  0%,
  100% {
    opacity: 0;
    transform: scale(0.6) rotate(0deg);
  }

  40%,
  60% {
    opacity: 1;
    transform: scale(1) rotate(20deg);
  }
}

@keyframes cloud-drift {
  0%,
  100% {
    transform: translateX(0);
  }

  50% {
    transform: translateX(6px);
  }
}

@keyframes dot-bounce {
  0%,
  100% {
    transform: translateY(0);
    opacity: 0.45;
  }

  50% {
    transform: translateY(-4px);
    opacity: 1;
  }
}
</style>
