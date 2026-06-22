<script setup>
defineProps({
  visible: { type: Boolean, default: false },
  level: { type: String, default: 'medium' },
  keyword: { type: String, default: '' },
})

const emit = defineEmits(['close'])
</script>

<template>
  <transition name="fade">
    <section v-if="visible" class="crisis" :class="`crisis--${level}`">
      <div class="crisis__content">
        <div class="crisis__title">安全提醒</div>
        <p>
          系统检测到可能涉及自伤或严重危机的表达。如果你现在存在即时危险，
          请优先联系身边可信的人，或直接拨打当地紧急电话。
        </p>
        <div class="crisis__actions">
          <a href="tel:120">120</a>
          <a href="tel:110">110</a>
          <a href="tel:4001619995">希望24热线</a>
        </div>
      </div>
      <button class="crisis__close" title="关闭提示" @click="emit('close')">
        ×
      </button>
    </section>
  </transition>
</template>

<style scoped>
.crisis {
  max-width: 780px;
  margin: 0 auto 10px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-left: 3px solid var(--danger);
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.crisis__content {
  flex: 1;
  min-width: 0;
}

.crisis__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--danger);
  margin-bottom: 4px;
}

.crisis p {
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-secondary);
}

.crisis__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.crisis__actions a {
  padding: 5px 9px;
  border-radius: 6px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  color: var(--danger);
  text-decoration: none;
  font-size: 12px;
  font-weight: 600;
}

.crisis__actions a:hover {
  border-color: var(--danger);
}

.crisis__close {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 20px;
  line-height: 1;
}

.crisis__close:hover {
  background: rgba(194, 117, 106, 0.1);
  color: var(--danger);
}

@media (max-width: 640px) {
  .crisis {
    margin: 0 14px 10px;
  }
}
</style>
