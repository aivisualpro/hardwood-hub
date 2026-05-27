import mongoose from 'mongoose'

const DropdownOptionSchema = new mongoose.Schema({
  label: { type: String, required: true },
  value: { type: String, required: true },
  color: { type: String, default: '' },
  icon: { type: String, default: '' },
  order: { type: Number, default: 0 },
  category: { type: String, default: '' },
})

const DropdownSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, index: true },
    options: { type: [DropdownOptionSchema], default: [] },
  },
  {
    timestamps: true,
    collection: 'hardwoodDB_Dropdowns',
  }
)

export const Dropdown =
  mongoose.models.Dropdown || mongoose.model('Dropdown', DropdownSchema)
