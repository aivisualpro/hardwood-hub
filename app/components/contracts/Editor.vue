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

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [content: string]
  'update:pages': [pages: number]
}>()

function calculatePages() {
  if (!editor.value) return 1
  const dom = editor.value.view.dom
  if (!dom) return 1
  return Math.max(1, Math.ceil(dom.clientHeight / 1056))
}

const editor = useEditor({
  content: props.modelValue || '',
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4] },
      horizontalRule: false,
    }),
    Placeholder.configure({
      placeholder: ({ node }) => {
        if (node.type.name === 'heading') {
          return `Heading ${node.attrs.level}`
        }
        return 'Type here or use the toolbar to format...'
      },
    }),
    Underline,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Highlight.configure({ multicolor: true }),
    Table.configure({ resizable: true }),
    TableRow,
    TableCell,
    TableHeader,
    Image.configure({ inline: false, allowBase64: true }),
    Link.configure({ openOnClick: false, HTMLAttributes: { class: 'editor-link' } }),
    TextStyle,
    Color,
    HorizontalRule,
  ],
  editorProps: {
    attributes: {
      class: 'contract-editor-content',
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

// Colors
const textColors = [
  { name: 'Default', color: '' },
  { name: 'Red', color: '#EF4444' },
  { name: 'Orange', color: '#F97316' },
  { name: 'Green', color: '#10B981' },
  { name: 'Blue', color: '#3B82F6' },
  { name: 'Purple', color: '#8B5CF6' },
]

const showColorPicker = ref(false)
function setColor(color: string) {
  if (!editor.value) return
  if (!color) { editor.value.chain().focus().unsetColor().run() }
  else { editor.value.chain().focus().setColor(color).run() }
  showColorPicker.value = false
}

function setLink() {
  if (!editor.value) return
  const previousUrl = editor.value.getAttributes('link').href
  const url = window.prompt('Enter URL:', previousUrl)
  if (url === null) return
  if (url === '') {
    editor.value.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }
  editor.value.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
}

function insertImage() {
  if (!editor.value) return
  const url = window.prompt('Enter image URL:')
  if (url) {
    editor.value.chain().focus().setImage({ src: url }).run()
  }
}
</script>

<template>
  <div class="relative contract-canvas">
    <!-- ═══════ TOOLBAR ═══════ -->
    <div class="relative z-10 bg-card/95 backdrop-blur-xl border-b shadow-sm">
      <div v-if="editor" class="flex items-center gap-0.5 px-3 py-1.5 overflow-x-auto">
        <!-- Undo/Redo -->
        <div class="flex items-center gap-0.5 pr-2 border-r mr-2">
          <button class="contract-toolbar-btn" :disabled="!editor.can().undo()" title="Undo" @click="editor.chain().focus().undo().run()">
            <Icon name="i-lucide-undo-2" class="size-3.5" />
          </button>
          <button class="contract-toolbar-btn" :disabled="!editor.can().redo()" title="Redo" @click="editor.chain().focus().redo().run()">
            <Icon name="i-lucide-redo-2" class="size-3.5" />
          </button>
        </div>

        <!-- Headings -->
        <div class="flex items-center gap-0.5 pr-2 border-r mr-2">
          <button class="contract-toolbar-btn" :class="{ 'is-active': editor.isActive('heading', { level: 1 }) }" title="Heading 1" @click="editor.chain().focus().toggleHeading({ level: 1 }).run()">
            <Icon name="i-lucide-heading-1" class="size-3.5" />
          </button>
          <button class="contract-toolbar-btn" :class="{ 'is-active': editor.isActive('heading', { level: 2 }) }" title="Heading 2" @click="editor.chain().focus().toggleHeading({ level: 2 }).run()">
            <Icon name="i-lucide-heading-2" class="size-3.5" />
          </button>
          <button class="contract-toolbar-btn" :class="{ 'is-active': editor.isActive('heading', { level: 3 }) }" title="Heading 3" @click="editor.chain().focus().toggleHeading({ level: 3 }).run()">
            <Icon name="i-lucide-heading-3" class="size-3.5" />
          </button>
        </div>

        <!-- Text Formatting -->
        <div class="flex items-center gap-0.5 pr-2 border-r mr-2">
          <button class="contract-toolbar-btn" :class="{ 'is-active': editor.isActive('bold') }" title="Bold" @click="editor.chain().focus().toggleBold().run()">
            <Icon name="i-lucide-bold" class="size-3.5" />
          </button>
          <button class="contract-toolbar-btn" :class="{ 'is-active': editor.isActive('italic') }" title="Italic" @click="editor.chain().focus().toggleItalic().run()">
            <Icon name="i-lucide-italic" class="size-3.5" />
          </button>
          <button class="contract-toolbar-btn" :class="{ 'is-active': editor.isActive('underline') }" title="Underline" @click="editor.chain().focus().toggleUnderline().run()">
            <Icon name="i-lucide-underline" class="size-3.5" />
          </button>
          <button class="contract-toolbar-btn" :class="{ 'is-active': editor.isActive('strike') }" title="Strikethrough" @click="editor.chain().focus().toggleStrike().run()">
            <Icon name="i-lucide-strikethrough" class="size-3.5" />
          </button>
          <button class="contract-toolbar-btn" :class="{ 'is-active': editor.isActive('highlight') }" title="Highlight" @click="editor.chain().focus().toggleHighlight().run()">
            <Icon name="i-lucide-highlighter" class="size-3.5" />
          </button>
        </div>

        <!-- Text Color -->
        <div class="relative pr-2 border-r mr-2">
          <button class="contract-toolbar-btn" title="Text Color" @click="showColorPicker = !showColorPicker">
            <Icon name="i-lucide-palette" class="size-3.5" />
          </button>
          <transition name="fade">
            <div v-if="showColorPicker" class="absolute top-full left-0 mt-1 z-50 bg-popover border rounded-lg shadow-xl p-2 flex gap-1.5">
              <button
                v-for="c in textColors"
                :key="c.name"
                class="size-6 rounded-full border-2 transition-transform hover:scale-125 flex items-center justify-center"
                :class="c.color ? 'border-transparent' : 'border-border'"
                :style="c.color ? { backgroundColor: c.color } : {}"
                :title="c.name"
                @click="setColor(c.color)"
              >
                <Icon v-if="!c.color" name="i-lucide-ban" class="size-3 text-muted-foreground" />
              </button>
            </div>
          </transition>
        </div>

        <!-- Alignment -->
        <div class="flex items-center gap-0.5 pr-2 border-r mr-2">
          <button class="contract-toolbar-btn" :class="{ 'is-active': editor.isActive({ textAlign: 'left' }) }" title="Align Left" @click="editor.chain().focus().setTextAlign('left').run()">
            <Icon name="i-lucide-align-left" class="size-3.5" />
          </button>
          <button class="contract-toolbar-btn" :class="{ 'is-active': editor.isActive({ textAlign: 'center' }) }" title="Align Center" @click="editor.chain().focus().setTextAlign('center').run()">
            <Icon name="i-lucide-align-center" class="size-3.5" />
          </button>
          <button class="contract-toolbar-btn" :class="{ 'is-active': editor.isActive({ textAlign: 'right' }) }" title="Align Right" @click="editor.chain().focus().setTextAlign('right').run()">
            <Icon name="i-lucide-align-right" class="size-3.5" />
          </button>
        </div>

        <!-- Lists -->
        <div class="flex items-center gap-0.5 pr-2 border-r mr-2">
          <button class="contract-toolbar-btn" :class="{ 'is-active': editor.isActive('bulletList') }" title="Bullet List" @click="editor.chain().focus().toggleBulletList().run()">
            <Icon name="i-lucide-list" class="size-3.5" />
          </button>
          <button class="contract-toolbar-btn" :class="{ 'is-active': editor.isActive('orderedList') }" title="Ordered List" @click="editor.chain().focus().toggleOrderedList().run()">
            <Icon name="i-lucide-list-ordered" class="size-3.5" />
          </button>
          <button class="contract-toolbar-btn" :class="{ 'is-active': editor.isActive('blockquote') }" title="Blockquote" @click="editor.chain().focus().toggleBlockquote().run()">
            <Icon name="i-lucide-text-quote" class="size-3.5" />
          </button>
        </div>

        <!-- Insert -->
        <div class="flex items-center gap-0.5">
          <button class="contract-toolbar-btn" title="Insert Link" @click="setLink">
            <Icon name="i-lucide-link" class="size-3.5" />
          </button>
          <button class="contract-toolbar-btn" title="Insert Image" @click="insertImage">
            <Icon name="i-lucide-image" class="size-3.5" />
          </button>
          <button class="contract-toolbar-btn" title="Insert Table" @click="editor.chain().focus().insertTable({ rows: 3, cols: 2, withHeaderRow: false }).run()">
            <Icon name="i-lucide-table" class="size-3.5" />
          </button>
          <button class="contract-toolbar-btn" title="Horizontal Rule" @click="editor.chain().focus().setHorizontalRule().run()">
            <Icon name="i-lucide-separator-horizontal" class="size-3.5" />
          </button>
        </div>
      </div>
    </div>

    <!-- ═══════ BUBBLE MENU ═══════ -->
    <BubbleMenu
      v-if="editor"
      :editor="editor"
      :tippy-options="{ duration: 150, placement: 'top' }"
    >
      <div class="flex items-center gap-0.5 bg-popover border rounded-xl shadow-2xl px-1.5 py-1 backdrop-blur-xl">
        <button class="bubble-btn" :class="{ 'is-active': editor.isActive('bold') }" @click="editor.chain().focus().toggleBold().run()">
          <Icon name="i-lucide-bold" class="size-3.5" />
        </button>
        <button class="bubble-btn" :class="{ 'is-active': editor.isActive('italic') }" @click="editor.chain().focus().toggleItalic().run()">
          <Icon name="i-lucide-italic" class="size-3.5" />
        </button>
        <button class="bubble-btn" :class="{ 'is-active': editor.isActive('underline') }" @click="editor.chain().focus().toggleUnderline().run()">
          <Icon name="i-lucide-underline" class="size-3.5" />
        </button>
        <button class="bubble-btn" :class="{ 'is-active': editor.isActive('strike') }" @click="editor.chain().focus().toggleStrike().run()">
          <Icon name="i-lucide-strikethrough" class="size-3.5" />
        </button>
        <div class="w-px h-4 bg-border mx-0.5" />
        <button class="bubble-btn" :class="{ 'is-active': editor.isActive('highlight') }" @click="editor.chain().focus().toggleHighlight().run()">
          <Icon name="i-lucide-highlighter" class="size-3.5" />
        </button>
        <button class="bubble-btn" @click="setLink">
          <Icon name="i-lucide-link" class="size-3.5" />
        </button>
      </div>
    </BubbleMenu>

    <!-- ═══════ EDITOR CONTENT ═══════ -->
    <EditorContent :editor="editor" class="min-h-[500px]" />
  </div>
</template>

<style>
/* ─── Editor Content Styles ─── */
.contract-editor-content {
  padding: 2rem 2.5rem;
  outline: none;
  font-family: 'Inter', 'Georgia', serif;
  line-height: 1.75;
  color: var(--foreground);
  min-height: 1056px;
  max-width: 816px;
  margin: 0 auto;
  
  /* US Letter Page break simulation (11 inches = 1056px at 96 DPI) */
  --page-height: 1056px;
  background-image: repeating-linear-gradient(
    to bottom,
    transparent,
    transparent calc(var(--page-height) - 2px),
    rgba(220, 38, 38, 0.4) calc(var(--page-height) - 2px),
    rgba(220, 38, 38, 0.4) var(--page-height)
  );
}

.contract-editor-content:focus { outline: none; }

.contract-editor-content h1 {
  font-size: 1.875rem;
  font-weight: 900;
  letter-spacing: -0.025em;
  margin-bottom: 1rem;
  margin-top: 2rem;
}

.contract-editor-content h2 {
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.025em;
  margin-bottom: 0.75rem;
  margin-top: 1.5rem;
}

.contract-editor-content h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  margin-top: 1.25rem;
}

.contract-editor-content p {
  font-size: 0.875rem;
  line-height: 1.625;
  margin-bottom: 0.75rem;
}

.contract-editor-content ul {
  list-style-type: disc;
  padding-left: 1.5rem;
  margin-bottom: 0.75rem;
}

.contract-editor-content ol {
  list-style-type: decimal;
  padding-left: 1.5rem;
  margin-bottom: 0.75rem;
}

.contract-editor-content li {
  font-size: 0.875rem;
}

.contract-editor-content blockquote {
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

.contract-editor-content hr {
  border-top: 2px solid hsl(var(--border) / 0.6);
  margin: 1.5rem 0;
}

.contract-editor-content img {
  max-width: 100%;
  border-radius: 0.5rem;
  margin: 1rem 0;
}

.contract-editor-content a,
.contract-editor-content .editor-link {
  color: hsl(var(--primary));
  text-decoration: underline;
  cursor: pointer;
}

.contract-editor-content mark {
  background: #fef08a;
  padding: 0 0.125rem;
  border-radius: 0.125rem;
}

/* Template Variables */
.contract-editor-content .template-variable,
.contract-editor-content span[data-var] {
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
.contract-editor-content table {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
  font-size: 0.875rem;
}

.contract-editor-content th,
.contract-editor-content td {
  border: 1px solid hsl(var(--border) / 0.6);
  padding: 0.5rem 0.75rem;
  text-align: left;
}

.contract-editor-content th {
  background: hsl(var(--muted));
  font-weight: 600;
}

/* Placeholder */
.contract-editor-content .is-empty::before {
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
