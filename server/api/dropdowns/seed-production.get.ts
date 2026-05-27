/**
 * GET /api/dropdowns/seed-production
 * One-time seed: creates "Daily Production Categories" and
 * "Daily Production Sub Types" (with category field on each option).
 *
 * Safe to re-run — uses upsert on name.
 */
import { connectDB } from '../../utils/mongoose'
import { Dropdown } from '../../models/Dropdown'

const CATEGORY_SUBTYPES: Record<string, string[]> = {
  'Demo': ['Carpet removal', 'Hardwood removal — nailed', 'Hardwood removal — glued', 'Floating floor removal', 'Tile removal', 'Vinyl removal', 'Subfloor removal', 'Stair demo', 'Trim removal', 'Misc demo'],
  'Subfloor — Sheeting': ['1/4 underlayment', '15/32 sheeting', '23/32 sheeting', 'AdvanTech', 'Dricore', 'Plywood'],
  'Subfloor — Leveling': ['Self leveler', 'Grind and screw', 'Moisture barrier 1 coat', 'Moisture barrier 2 coats', 'Concrete prep'],
  'Installation — Staple': ['Unfinished standard', 'Unfinished on angle', 'Prefinished', 'Prefinished on angle', 'Prefinished less than 3/4'],
  'Installation — Cleat': ['Unfinished standard', 'Unfinished on angle', 'Prefinished', 'Hard species'],
  'Installation — Glue Assist': ['Unfinished greater than 4 inch', 'Prefinished greater than 4 inch'],
  'Installation — Full Glue Down': ['Unfinished engineered', 'Prefinished engineered', 'Click and lock glue'],
  'Installation — Floating': ['Click and lock', 'Glue T&G', 'Laminate', 'Vinyl plank'],
  'Installation — Pattern': ['Herringbone', 'Chevron', 'Diagonal / angle'],
  'Sanding': ['Big machine', 'Edger', 'Screen / buff'],
  'Staining': ['Duraseal standard', 'Custom color', 'Water pop prep'],
  'Finishing': ['Pallmann Pal X Gold', 'Loba Duo', 'Loba Supra AT', 'Loba Easy Finish', 'Loba Invisible', 'Emulsion Pro', 'Pall-X Power', 'Masterline', 'Magic oil', 'Rubio Mono Coat', 'Uno Coat', 'Screen and recoat'],
  'Repairs': ['Board replacement', 'Dutchman', 'Stitch in', 'Squeak repair', 'Gap fill'],
  'Stairs / Steps': ['Tread install', 'Riser install', 'Sand tread', 'Finish tread', 'Stain tread', 'Baluster work'],
  'Trim': ['Shoe removal', 'Shoe install — existing (save)', 'Shoe install — new', 'Base removal', 'Base install', 'Transitions', 'Custom milling'],
  'Site Prep': ['Plastic hanging', 'Door removal / reinstall', 'Appliance move — clear area', 'Appliance shuffle', 'Floor protection', 'Dustless setup'],
  'Shop Work': ['Tread finishing', 'Vent milling', 'Custom milling', 'Material prep'],
  'Admin / Other': ['Estimates', 'Material pickup', 'Dump run', 'Jobsite cleaning'],
}

export default defineEventHandler(async () => {
  await connectDB()

  // 1. Seed "Daily Production Categories"
  const categoryOptions = Object.keys(CATEGORY_SUBTYPES).map((cat, idx) => ({
    label: cat,
    value: cat,
    color: '',
    icon: '',
    order: idx,
    category: '',
  }))

  await Dropdown.findOneAndUpdate(
    { name: 'Daily Production Categories' },
    { $set: { name: 'Daily Production Categories', options: categoryOptions } },
    { upsert: true, new: true }
  )

  // 2. Seed "Daily Production Sub Types" with category on each option
  let subtypeOrder = 0
  const subtypeOptions: any[] = []
  for (const [cat, subs] of Object.entries(CATEGORY_SUBTYPES)) {
    for (const sub of subs) {
      subtypeOptions.push({
        label: sub,
        value: sub,
        color: '',
        icon: '',
        order: subtypeOrder++,
        category: cat,
      })
    }
  }

  await Dropdown.findOneAndUpdate(
    { name: 'Daily Production Sub Types' },
    { $set: { name: 'Daily Production Sub Types', options: subtypeOptions } },
    { upsert: true, new: true }
  )

  return {
    success: true,
    message: `Seeded ${categoryOptions.length} categories and ${subtypeOptions.length} subtypes`,
  }
})
