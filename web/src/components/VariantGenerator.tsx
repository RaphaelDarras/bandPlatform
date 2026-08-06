import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { generateSku } from '../lib/sku'

// Shared size x colour variant generator (D-15), reused unchanged by both
// the create-product panel (06.1-06) and the add-variant panel (06.1-07)
// per D-19 -- one component, one implementation, one test suite.
//
// Sizes/colours are comma-separated free text; the preview regenerates on
// every keystroke (UI-SPEC "on change, not gated behind a Generate button"),
// producing one row per size x colour combination (colour omitted -> one row
// per size with color: null; sizes omitted but colours present -> one row
// per colour with size: null; both empty -> zero rows).
//
// Each row's auto-SKU (D-13, sku.ts) regenerates live from productName as
// long as the admin hasn't overwritten that row's SKU field -- overwriting
// sets skuEdited, which freezes that row's sku text across regenerations of
// the surviving combination.

export type GeneratedVariantRow = {
  sku: string
  size: string | null
  color: string | null
  stock: number
  skuEdited: boolean
}

export type VariantGeneratorProps = {
  productName: string
  existingSkus: string[]
  onRowsChange: (rows: GeneratedVariantRow[]) => void
}

const labelClassName = 'font-sans text-sm font-semibold uppercase tracking-[0.06em] text-white'
const inputClassName =
  'mt-1 w-full rounded-md border border-[var(--color-hairline)] bg-[var(--color-surface)] px-4 py-3 font-sans text-white'

function parseList(text: string): string[] {
  return text
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

function rowKey(size: string | null, color: string | null): string {
  return `${size ?? ''}|${color ?? ''}`
}

function buildRows(
  sizes: string[],
  colours: string[],
  productName: string,
  previousRows: GeneratedVariantRow[],
): GeneratedVariantRow[] {
  const previousByKey = new Map(previousRows.map((row) => [rowKey(row.size, row.color), row]))

  let combinations: { size: string | null; color: string | null }[]
  if (sizes.length === 0 && colours.length === 0) {
    combinations = []
  } else if (colours.length === 0) {
    combinations = sizes.map((size) => ({ size, color: null }))
  } else if (sizes.length === 0) {
    combinations = colours.map((color) => ({ size: null, color }))
  } else {
    combinations = sizes.flatMap((size) => colours.map((color) => ({ size, color })))
  }

  return combinations.map(({ size, color }) => {
    const previous = previousByKey.get(rowKey(size, color))
    const skuEdited = previous?.skuEdited ?? false
    const sku = skuEdited && previous ? previous.sku : generateSku(productName, size, color)
    return {
      sku,
      size,
      color,
      stock: previous?.stock ?? 0,
      skuEdited,
    }
  })
}

export function VariantGenerator({ productName, existingSkus, onRowsChange }: VariantGeneratorProps) {
  const [sizesText, setSizesText] = useState('')
  const [coloursText, setColoursText] = useState('')
  const [rows, setRows] = useState<GeneratedVariantRow[]>([])
  const lastProductName = useRef(productName)

  // The one permitted effect-driven update (see file header / plan note):
  // notification must fire from event handlers everywhere else, but a
  // change to productName arrives as a prop from the parent form, not from
  // an event this component owns, so there's no handler to notify from.
  // Guarded by a ref so it only recomputes once per actual name change.
  useEffect(() => {
    if (lastProductName.current === productName) return
    lastProductName.current = productName
    const nextRows = buildRows(parseList(sizesText), parseList(coloursText), productName, rows)
    setRows(nextRows)
    onRowsChange(nextRows)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productName])

  function handleSizesChange(e: ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setSizesText(value)
    const nextRows = buildRows(parseList(value), parseList(coloursText), productName, rows)
    setRows(nextRows)
    onRowsChange(nextRows)
  }

  function handleColoursChange(e: ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setColoursText(value)
    const nextRows = buildRows(parseList(sizesText), parseList(value), productName, rows)
    setRows(nextRows)
    onRowsChange(nextRows)
  }

  function handleSkuChange(index: number, value: string) {
    const nextRows = rows.map((row, i) => (i === index ? { ...row, sku: value, skuEdited: true } : row))
    setRows(nextRows)
    onRowsChange(nextRows)
  }

  function handleStockChange(index: number, value: string) {
    const parsed = value === '' ? 0 : Number(value)
    const nextRows = rows.map((row, i) => (i === index ? { ...row, stock: Number.isNaN(parsed) ? 0 : parsed } : row))
    setRows(nextRows)
    onRowsChange(nextRows)
  }

  function handlePrune(index: number) {
    const nextRows = rows.filter((_, i) => i !== index)
    setRows(nextRows)
    onRowsChange(nextRows)
  }

  function isDuplicateSku(sku: string, index: number): boolean {
    if (!sku) return false
    const duplicateInPreview = rows.some((row, i) => i !== index && row.sku === sku)
    const duplicateExisting = existingSkus.includes(sku)
    return duplicateInPreview || duplicateExisting
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className={labelClassName} htmlFor="variant-generator-sizes">
          Sizes
        </label>
        <input
          id="variant-generator-sizes"
          type="text"
          placeholder="S, M, L, XL"
          value={sizesText}
          onChange={handleSizesChange}
          className={inputClassName}
        />
      </div>

      <div>
        <label className={labelClassName} htmlFor="variant-generator-colours">
          Colours (optional)
        </label>
        <input
          id="variant-generator-colours"
          type="text"
          placeholder="Black, White"
          value={coloursText}
          onChange={handleColoursChange}
          className={inputClassName}
        />
      </div>

      {rows.length === 0 ? (
        <p className="font-sans text-sm text-white/50">Enter at least one size to preview variants.</p>
      ) : (
        <table className="w-full border-collapse font-sans text-sm text-white">
          <thead>
            <tr className="border-b border-[var(--color-hairline)] text-left">
              <th className="py-2 pr-2 text-xs font-semibold uppercase tracking-[0.06em]">SKU</th>
              <th className="py-2 pr-2 text-xs font-semibold uppercase tracking-[0.06em]">Size</th>
              <th className="py-2 pr-2 text-xs font-semibold uppercase tracking-[0.06em]">Colour</th>
              <th className="py-2 pr-2 text-xs font-semibold uppercase tracking-[0.06em]">Opening stock</th>
              <th className="py-2 pr-2" aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const duplicate = isDuplicateSku(row.sku, index)
              const key = rowKey(row.size, row.color)
              const skuInputId = `variant-generator-sku-${key}`
              const stockInputId = `variant-generator-stock-${key}`

              return (
                <tr key={key} className="border-b border-[var(--color-hairline)]">
                  <td className="py-2 pr-2 align-top">
                    <label htmlFor={skuInputId} className="sr-only">
                      {`SKU for ${row.size ?? '—'} / ${row.color ?? '—'}`}
                    </label>
                    <input
                      id={skuInputId}
                      type="text"
                      value={row.sku}
                      onChange={(e) => handleSkuChange(index, e.target.value)}
                      className="h-11 w-full border border-[var(--color-hairline)] bg-[var(--color-surface)] px-2 text-white"
                    />
                    {duplicate && (
                      <p aria-live="polite" className="font-sans text-xs text-[var(--color-stock-warning)]">
                        This SKU is already in use.
                      </p>
                    )}
                  </td>
                  <td className="py-2 pr-2 align-top">{row.size ?? '—'}</td>
                  <td className="py-2 pr-2 align-top">{row.color ?? '—'}</td>
                  <td className="py-2 pr-2 align-top">
                    <label htmlFor={stockInputId} className="sr-only">
                      {`Opening stock for ${row.size ?? '—'} / ${row.color ?? '—'}`}
                    </label>
                    <input
                      id={stockInputId}
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={row.stock}
                      onChange={(e) => handleStockChange(index, e.target.value)}
                      className="h-11 w-20 border border-[var(--color-hairline)] bg-[var(--color-surface)] px-2 text-center text-white"
                    />
                  </td>
                  <td className="py-2 pr-2 align-top">
                    {/* Prunes an UNSAVED preview row before the product/variants
                        are ever created -- not the D-16 variant-removal
                        prohibition, which only applies to variants already
                        persisted on a saved product. */}
                    <button
                      type="button"
                      aria-label={`Remove ${row.size ?? '—'} / ${row.color ?? '—'} from preview`}
                      onClick={() => handlePrune(index)}
                      className="flex h-11 w-11 items-center justify-center text-white"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" />
                      </svg>
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
