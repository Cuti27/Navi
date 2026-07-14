<script setup lang="ts">
import MarkdownIt from 'markdown-it'
import remend from 'remend'

const props = defineProps<{
  content: string
}>()

const md = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: true,
  typographer: true,
})

const rendered = computed(() => md.render(remend(props.content)))
</script>

<template>
  <div class="markdown-content body-md" v-html="rendered" />
</template>

<style scoped>
.markdown-content :deep(p) {
  margin-bottom: 0.75em;
}
.markdown-content :deep(p:last-child) {
  margin-bottom: 0;
}
.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  padding-left: 1.5em;
  margin-bottom: 0.75em;
}
.markdown-content :deep(li) {
  margin-bottom: 0.25em;
}
.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3),
.markdown-content :deep(h4) {
  font-weight: 600;
  margin-top: 1em;
  margin-bottom: 0.5em;
  line-height: 1.3;
  color: var(--foreground);
}
.markdown-content :deep(h1) {
  font-size: 1.25em;
}
.markdown-content :deep(h2) {
  font-size: 1.1em;
}
.markdown-content :deep(h3) {
  font-size: 1em;
}
.markdown-content :deep(code) {
  font-family: var(--font-mono);
  font-size: 0.9em;
  background-color: var(--muted);
  padding: 0.15em 0.4em;
  border-radius: 0.25rem;
}
.markdown-content :deep(pre) {
  background-color: var(--muted);
  padding: 1em;
  border-radius: 0.5rem;
  overflow-x: auto;
  margin-bottom: 0.75em;
}
.markdown-content :deep(pre code) {
  background: none;
  padding: 0;
  font-size: 0.85em;
}
.markdown-content :deep(blockquote) {
  border-left: 3px solid var(--border);
  padding-left: 1em;
  margin-left: 0;
  margin-bottom: 0.75em;
  color: var(--muted-foreground);
}
.markdown-content :deep(a) {
  color: var(--primary);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.markdown-content :deep(a:hover) {
  opacity: 0.85;
}
.markdown-content :deep(hr) {
  border: none;
  border-top: 1px solid var(--border);
  margin: 1em 0;
}
.markdown-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 0.75em;
}
.markdown-content :deep(th),
.markdown-content :deep(td) {
  border: 1px solid var(--border);
  padding: 0.5em;
  text-align: left;
}
.markdown-content :deep(th) {
  font-weight: 600;
  background-color: var(--muted);
}
.markdown-content :deep(img) {
  max-width: 100%;
  border-radius: 0.375rem;
}
</style>
