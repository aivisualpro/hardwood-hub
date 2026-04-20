<script setup lang="ts">
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import HorizontalRule from '@tiptap/extension-horizontal-rule'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { Table } from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import Underline from '@tiptap/extension-underline'
import StarterKit from '@tiptap/starter-kit'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { BubbleMenu } from '@tiptap/vue-3/menus'
import '@tiptap/extension-text-style'
import FontSize from '@tiptap/extension-font-size'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [content: string]
}>()

const editor = useEditor({
  content: props.modelValue || '',
  extensions: [
    StarterKit.configure({
      heading: false,
      horizontalRule: false,
    }),
    Placeholder.configure({
      placeholder: 'Start typing here...',
    }),
    Link.configure({ openOnClick: false, HTMLAttributes: { class: 'editor-link' } }),
  ],
  editorProps: {
    attributes: {
      class: 'simple-editor-content focus:outline-none max-w-full',
    },
  },
  onCreate() {
    setTimeout(() => {
      emit('update:pages', calculatePages())
    }, 100)
  },
  onUpdate({ editor: ed }) {
    emit('update:modelValue', ed.getHTML())
    emit('update:pages', calculatePages())
  },
  onSelectionUpdate: ({ editor: ed }) => {
    const attrs = ed.getAttributes('textStyle')
    if (attrs && attrs.fontSize) {
      currentFontSize.value = attrs.fontSize.replace('px', '')
    } else {
      currentFontSize.value = '14'
    }
  },
})

watch(() => props.modelValue, (val) => {
  if (editor.value && val !== editor.value.getHTML()) {
    editor.value.commands.setContent(val || '', { emitUpdate: false })
  }
})

// Listen for variable insert events from parent
function onInsertVariable(e: Event) {
  const key = (e as CustomEvent).detail?.key
  if (!key || !editor.value) return
  editor.value.chain().focus().insertContent(`{{${key}}} `).run()
}

onMounted(() => {
  window.addEventListener('insert-variable', onInsertVariable)
})

onUnmounted(() => {
  window.removeEventListener('insert-variable', onInsertVariable)
  editor.value?.destroy()
})
</script>

<template>
  <div class="relative contract-canvas flex flex-col h-full bg-muted/5 dark:bg-muted/10 rounded-xl overflow-hidden">
    <!-- ═══════ MINIMAL TOOLBAR ═══════ -->
    <div class="shrink-0 bg-card/95 backdrop-blur-xl border-b shadow-sm">
      <div v-if="editor" class="flex items-center gap-1 px-3 py-1.5 overflow-x-auto">
        <button class="contract-toolbar-btn" :class="{ 'is-active': editor.isActive('bulletList') }" title="Bullet List" @click="editor.chain().focus().toggleBulletList().run()">
          <Icon name="i-lucide-list" class="size-3.5" />
        </button>
        <button class="contract-toolbar-btn" :class="{ 'is-active': editor.isActive('orderedList') }" title="Numbered List" @click="editor.chain().focus().toggleOrderedList().run()">
          <Icon name="i-lucide-list-ordered" class="size-3.5" />
        </button>
      </div>
    </div>

    <!-- ═══════ EDITOR CONTENT ═══════ -->
    <div class="flex-1 overflow-y-auto w-full relative z-0">
      <EditorContent :editor="editor" class="" />
    </div>
  </div>
</template>

<style>
/* ─── Editor Content Styles ─── */
.simple-editor-content {
  position: relative;
  padding: 16px;
  outline: none;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  @apply text-foreground;
  min-height: 200px;
  width: 100%;
}

.simple-editor-content * {
  color: inherit !important;
  font-family: inherit !important;
  font-size: inherit !important;
  line-height: inherit !important;
}

.simple-editor-content:focus { outline: none; }

.simple-editor-content h1 {
  font-size: 24pt;
  font-weight: 900;
  letter-spacing: -0.025em;
  line-height: 1.15;
  margin-bottom: 6pt;
  margin-top: 12pt;
}

.simple-editor-content h2 {
  font-size: 18pt;
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1.15;
  margin-bottom: 4pt;
  margin-top: 10pt;
}

.simple-editor-content h3 {
  font-size: 14pt;
  font-weight: 600;
  line-height: 1.15;
  margin-bottom: 3pt;
  margin-top: 8pt;
}

.simple-editor-content p {
  font-size: 11pt;
  line-height: 1.15;
  margin-bottom: 0;
  margin-top: 0;
}

.simple-editor-content ul {
  list-style-type: disc;
  padding-left: 1.5rem;
  margin-bottom: 0;
  margin-top: 0;
}

.simple-editor-content ol {
  list-style-type: decimal;
  padding-left: 1.5rem;
  margin-bottom: 0;
  margin-top: 0;
}

.simple-editor-content li {
  font-size: 11pt;
  line-height: 1.15;
}

.simple-editor-content blockquote {
  border-left: 4px solid hsl(var(--primary) / 0.4);
  padding-left: 1rem;
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
  margin: 1rem 0;
  font-style: italic;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--primary) / 0.05);
  border-radius: 0 0.5rem 0.5rem 0;
}

.simple-editor-content hr {
  border-top: 2px solid hsl(var(--border) / 0.6);
  margin: 1.5rem 0;
}

.simple-editor-content img {
  max-width: 100%;
  border-radius: 0.5rem;
  margin: 1rem 0;
}

.simple-editor-content a,
.simple-editor-content .editor-link {
  color: hsl(var(--primary));
  text-decoration: underline;
  cursor: pointer;
}

.simple-editor-content mark {
  background: #fef08a;
  padding: 0 0.125rem;
  border-radius: 0.125rem;
}

/* Template Variables */
.simple-editor-content .template-variable,
.simple-editor-content span[data-var] {
  background: rgba(245, 158, 11, 0.12);
  color: #d97706;
  border: 1px dashed rgba(245, 158, 11, 0.4);
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 0.8em;
  font-weight: 600;
  cursor: default;
}

/* Tables */
.simple-editor-content table {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
  font-size: 0.875rem;
}

.simple-editor-content th,
.simple-editor-content td {
  border: 1px solid hsl(var(--border) / 0.6);
  padding: 0.5rem 0.75rem;
  text-align: left;
}

.simple-editor-content th {
  background: hsl(var(--muted));
  font-weight: 600;
}

/* Placeholder: only show when the entire editor is blank */
.simple-editor-content .tiptap.is-editor-empty .is-empty::before {
  content: attr(data-placeholder);
  color: hsl(var(--muted-foreground) / 0.4);
  pointer-events: none;
  float: left;
  height: 0;
}

/* ─── Toolbar Buttons ─── */
.contract-toolbar-btn {
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 0.375rem;
  display: flex;
  align-items: center;
  justify-content: center;
  color: hsl(var(--muted-foreground));
  transition: all 0.15s ease;
  border: none;
  background: transparent;
  cursor: pointer;
}

.contract-toolbar-btn:hover {
  background: hsl(var(--accent));
  color: hsl(var(--accent-foreground));
}

.contract-toolbar-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.contract-toolbar-btn.is-active {
  background: hsl(var(--primary) / 0.1);
  color: hsl(var(--primary));
}

/* ─── Bubble Menu ─── */
.bubble-btn {
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 0.375rem;
  display: flex;
  align-items: center;
  justify-content: center;
  color: hsl(var(--muted-foreground));
  transition: all 0.1s ease;
  border: none;
  background: transparent;
  cursor: pointer;
}

.bubble-btn:hover {
  background: hsl(var(--accent));
  color: hsl(var(--accent-foreground));
}

.bubble-btn.is-active {
  background: hsl(var(--primary) / 0.15);
  color: hsl(var(--primary));
}

/* ─── Animations ─── */
.fade-enter-active { transition: opacity 200ms ease; }
.fade-leave-active { transition: opacity 150ms ease; }
.fade-enter-from,
.fade-leave-to { opacity: 0; }
</style>
