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
  'update:pages': [pages: number]
}>()

function calculatePages() {
  if (!editor.value) return 1
  const dom = editor.value.view.dom
  if (!dom) return 1
  return Math.max(1, Math.ceil(dom.clientHeight / 992))
}

const currentFontSize = ref('14')

function changeFontSize(delta: number) {
  if (!editor.value) return
  let current = parseInt(currentFontSize.value) || 14
  current += delta
  if (current < 8) current = 8
  if (current > 72) current = 72
  setFontSize(current.toString())
}

function setFontSize(size: string | Event) {
  if (!editor.value) return
  const rawValue = typeof size === 'object' ? (size.target as HTMLInputElement).value : size
  const val = parseInt(rawValue)
  if (val && !isNaN(val)) {
    // @ts-ignore
    editor.value.commands.setFontSize(`${val}px`)
    currentFontSize.value = val.toString()
    editor.value.commands.focus()
  } else {
    // @ts-ignore
    editor.value.commands.unsetFontSize()
    currentFontSize.value = '14'
  }
}

const editor = useEditor({
  content: props.modelValue || '',
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4] },
      horizontalRule: false,
    }),
    Placeholder.configure({
      placeholder: 'Start typing here...',
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
    FontSize,
    HorizontalRule,
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
  <div class="relative contract-canvas flex flex-col h-full bg-muted/5 dark:bg-muted/10 rounded-xl overflow-hidden">
    <!-- ═══════ TOOLBAR ═══════ -->
    <div class="shrink-0 bg-card/95 backdrop-blur-xl border-b shadow-sm">
      <div v-if="editor" class="flex items-center gap-0.5 px-3 py-1.5 overflow-x-auto">
        <!-- Undo/Redo & Font Size -->
        <div class="flex items-center gap-0.5 pr-2 border-r mr-2">
          <button class="contract-toolbar-btn" :disabled="!editor.can().undo()" title="Undo" @click="editor.chain().focus().undo().run()">
            <Icon name="i-lucide-undo-2" class="size-3.5" />
          </button>
          <button class="contract-toolbar-btn" :disabled="!editor.can().redo()" title="Redo" @click="editor.chain().focus().redo().run()">
            <Icon name="i-lucide-redo-2" class="size-3.5" />
          </button>
          <div class="w-px h-4 bg-border/50 mx-1" />
          
          <div class="flex items-center bg-muted/30 rounded border border-border/50 px-0.5 h-7">
            <button class="size-6 flex items-center justify-center rounded hover:bg-muted/80 hover:text-primary transition-colors text-muted-foreground" title="Decrease Font Size" @click="changeFontSize(-1)">
              <Icon name="i-lucide-minus" class="size-3" />
            </button>
            <input 
              type="text" 
              v-model="currentFontSize" 
              @change="setFontSize($event)"
              @keydown.enter="setFontSize($event)"
              class="w-8 text-center text-xs bg-transparent border-none outline-none font-semibold h-full focus:bg-muted" 
            />
            <button class="size-6 flex items-center justify-center rounded hover:bg-muted/80 hover:text-primary transition-colors text-muted-foreground" title="Increase Font Size" @click="changeFontSize(1)">
              <Icon name="i-lucide-plus" class="size-3" />
            </button>
          </div>
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
  color: var(--foreground);
  min-height: 200px;
  width: 100%;
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
