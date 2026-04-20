import json

file_path = "app/pages/hr/employee-performance.vue"

def solve():
    with open(file_path, "r") as f:
        content = f.read()

    # 1. Update Types
    target_types = """interface SkillNode { _id: string; name: string; isRequired: boolean; category: string; subCategory: string }
interface BonusRule { skillSet: string; reviewedTimes: number; supervisorCheck: string; bonusAmount: number }
interface SubCatNode { _id: string; name: string; category: string; predecessor: string; predecessorName: string; bonusRules: BonusRule[]; skills: SkillNode[] }
interface CatNode { _id: string; name: string; color: string; subCategories: SubCatNode[] }"""
    replacement_types = """interface SkillNode { _id: string; name: string; isRequired: boolean; category: string; subCategory: string; info?: string }
interface BonusRule { skillSet: string; reviewedTimes: number; supervisorCheck: string; bonusAmount: number }
interface SubCatNode { _id: string; name: string; category: string; predecessor: string; predecessorName: string; bonusRules: BonusRule[]; skills: SkillNode[] }
interface CatNode { _id: string; name: string; color: string; subCategories: SubCatNode[]; info?: string }"""

    # 2. Add State for Modals
    target_state = """// ─── Settings popover state ──────────────────────────────
const showSettings = ref(false)"""
    replacement_state = """// ─── Document Modals State ───────────────────────────────
const showCatPdfModal = ref(false)
const activeCatPdfUrl = ref('')
const activeCatName = ref('')

function openCatPdf(cat: CatNode) {
  if (!cat.info) return
  activeCatPdfUrl.value = cat.info
  activeCatName.value = cat.name
  showCatPdfModal.value = true
}

const showSkillInfoModal = ref(false)
const activeSkillInfoText = ref('')
const activeSkillName = ref('')

function openSkillInfoView(sk: SkillNode) {
  if (!sk.info) return
  activeSkillInfoText.value = sk.info
  activeSkillName.value = sk.name
  showSkillInfoModal.value = true
}

// ─── Settings popover state ──────────────────────────────
const showSettings = ref(false)"""

    # 3. Add Cat logic
    target_cat_name = """<div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold" :class="pal(catIdx).text">{{ cat.name }}</p>
                  <p class="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5">"""
    replacement_cat_name = """<div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold flex items-center gap-2" :class="pal(catIdx).text">
                    {{ cat.name }}
                    <button v-if="cat.info" @click.stop="openCatPdf(cat)" class="hover:text-foreground text-muted-foreground transition-colors shrink-0 flex items-center justify-center p-0.5" title="View PDF">
                      <Icon name="i-lucide-file-text" class="size-3.5" />
                    </button>
                  </p>
                  <p class="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5">"""

    # 4. Add Skill logic
    target_skill_name = """<div class="flex items-center gap-1.5 sm:gap-2">
                              <p class="text-[13px] sm:text-sm leading-snug">{{ sk.name }}</p>
                            </div>"""
    replacement_skill_name = """<div class="flex items-center gap-1.5 sm:gap-2">
                              <p class="text-[13px] sm:text-sm leading-snug flex items-center gap-2">
                                {{ sk.name }}
                                <button v-if="sk.info" @click.stop="openSkillInfoView(sk)" class="hover:text-foreground text-muted-foreground transition-colors shrink-0 flex items-center justify-center p-0.5" title="Skill Info">
                                  <Icon name="i-lucide-info" class="size-3.5" />
                                </button>
                              </p>
                            </div>"""

    # 5. Add Modals html before </template>
    target_template_end = """  </div>
</template>"""
    replacement_template_end = """
    <!-- Modals -->
    <Dialog v-model:open="showCatPdfModal">
      <DialogContent class="sm:max-w-4xl h-[90vh] flex flex-col p-4 sm:p-6">
        <DialogHeader class="shrink-0 flex justify-between items-start">
          <div>
            <DialogTitle>{{ activeCatName }} Documentation</DialogTitle>
            <DialogDescription>Official PDF guide for this category.</DialogDescription>
          </div>
        </DialogHeader>
        <div class="flex flex-col gap-4 py-2 flex-1 min-h-0 overflow-hidden">
          <div class="w-full flex-1 border border-border/50 rounded-xl overflow-hidden relative shadow-inner bg-muted/20">
            <iframe :src="activeCatPdfUrl.includes('#') ? activeCatPdfUrl + '&toolbar=0&navpanes=0&scrollbar=0' : activeCatPdfUrl + '#toolbar=0&navpanes=0&scrollbar=0'" class="w-full h-full pointer-events-auto" style="overflow: hidden;" frameborder="0"></iframe>
          </div>
        </div>
        <DialogFooter class="flex items-center justify-between shrink-0 pt-4 border-t border-border/40 mt-2">
           <div class="flex gap-2">
              <Button variant="outline" size="sm" as="a" :href="activeCatPdfUrl" download="Category_Documentation.pdf" target="_blank" class="text-primary hover:text-primary">
                 <Icon name="i-lucide-download" class="mr-1.5 size-3.5" />
                 Download
              </Button>
           </div>
           <Button variant="outline" @click="showCatPdfModal = false">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="showSkillInfoModal">
      <DialogContent class="sm:max-w-2xl sm:max-h-[85vh] flex flex-col p-0">
        <DialogHeader class="px-6 py-5 border-b border-border/40 bg-muted/20 shrink-0">
          <DialogTitle class="text-lg">{{ activeSkillName }}</DialogTitle>
          <DialogDescription>Standard Operating Procedure & Requirements</DialogDescription>
        </DialogHeader>
        <div class="p-6 flex-1 min-h-[200px] overflow-y-auto">
          <div class="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-headings:font-semibold" v-html="activeSkillInfoText"></div>
        </div>
        <DialogFooter class="px-6 py-4 border-t border-border/40 bg-muted/5 shrink-0">
          <Button variant="outline" @click="showSkillInfoModal = false">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

  </div>
</template>"""

    with open("replacements.json", "w") as f:
        json.dump([
            {"AllowMultiple": False, "TargetContent": target_types, "ReplacementContent": replacement_types, "StartLine": 5, "EndLine": 18},
            {"AllowMultiple": False, "TargetContent": target_state, "ReplacementContent": replacement_state, "StartLine": 490, "EndLine": 505},
            {"AllowMultiple": False, "TargetContent": target_cat_name, "ReplacementContent": replacement_cat_name, "StartLine": 915, "EndLine": 930},
            {"AllowMultiple": False, "TargetContent": target_skill_name, "ReplacementContent": replacement_skill_name, "StartLine": 1035, "EndLine": 1045},
            {"AllowMultiple": False, "TargetContent": target_template_end, "ReplacementContent": replacement_template_end, "StartLine": 1255, "EndLine": 1265},
        ], f, indent=2)

solve()
