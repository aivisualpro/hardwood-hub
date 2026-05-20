import mongoose from 'mongoose'

const ProductSchema = new mongoose.Schema(
  {
    sku: { type: String, default: '' },
    color: { type: String, default: '' },
    path: { type: String, default: '' },
    type: { type: String, default: '' },
    description: { type: String, default: '' },
    trade: { type: String, default: '' },
    unit: { type: String, default: '' },
    wasteAddon: { type: Number, default: 0 },
    salesPrice: { type: Number, default: 0 },
    costPrice: { type: Number, default: 0 },
    boxSalesPrice: { type: Number, default: 0 },
    boxCostPrice: { type: Number, default: 0 },
    isBoxPricesLinked: { type: Boolean, default: false },
    boxName: { type: String, default: '' },
    unitsPerBox: { type: Number, default: 0 },
    sellByBox: { type: Boolean, default: false },
    worksheetByBox: { type: Boolean, default: false },
    isTaxable: { type: Boolean, default: false },
    isAddon: { type: Boolean, default: false },
    vendor: { type: String, default: '' },
    vendorSku: { type: String, default: '' },
    manufacturer: { type: String, default: '' },
    costCode: { type: String, default: '' },
    styleCode: { type: String, default: '' },
    styleName: { type: String, default: '' },
    colorCode: { type: String, default: '' },
    colorName: { type: String, default: '' },
    createdBy: { type: String, default: '' },
  },
  {
    timestamps: true,
    collection: 'hardwoodDB_Products',
  },
)

ProductSchema.index({ sku: 1 })
ProductSchema.index({ type: 1 })
ProductSchema.index({ vendor: 1 })
ProductSchema.index({ manufacturer: 1 })

export interface IProduct {
  _id?: any
  sku: string
  color: string
  path: string
  type: string
  description: string
  trade: string
  unit: string
  wasteAddon: number
  salesPrice: number
  costPrice: number
  boxSalesPrice: number
  boxCostPrice: number
  isBoxPricesLinked: boolean
  boxName: string
  unitsPerBox: number
  sellByBox: boolean
  worksheetByBox: boolean
  isTaxable: boolean
  isAddon: boolean
  vendor: string
  vendorSku: string
  manufacturer: string
  costCode: string
  styleCode: string
  styleName: string
  colorCode: string
  colorName: string
  createdBy: string
  createdAt?: Date
  updatedAt?: Date
}

export const Product =
  mongoose.models.Product || mongoose.model<IProduct>('Product', ProductSchema)
