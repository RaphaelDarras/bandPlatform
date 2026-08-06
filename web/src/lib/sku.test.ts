import { describe, it, expect } from 'vitest'
import { skuToken, generateSku } from './sku'

// Pins D-13's deterministic slug scheme (see sku.ts's leading comment for
// the full rule). No slugify dependency — RESEARCH's Don't-Hand-Roll table
// rules that out since D-13's manual SKU override is the real backstop.

describe('skuToken', () => {
  it('uppercases, strips diacritics, and removes non-alphanumeric characters', () => {
    expect(skuToken('Écusson', 20)).toBe('ECUSSON')
  })

  it('returns the cleaned string unchanged when it already fits within maxLength', () => {
    expect(skuToken('Navy', 10)).toBe('NAVY')
  })

  it('truncates plainly (left-to-right) when the cleaned string ends in a vowel', () => {
    expect(skuToken('White', 3)).toBe('WHI')
    expect(skuToken('Banana', 3)).toBe('BAN')
  })

  it('truncates but preserves a trailing consonant instead of dropping it', () => {
    expect(skuToken('Black', 3)).toBe('BLK')
  })

  it('truncates at each field\'s documented length (8 for name, 4 for size, 3 for color)', () => {
    expect(skuToken('International', 8)).toBe('INTERNAL')
    expect(skuToken('XLarge', 4)).toBe('XLAR')
    expect(skuToken('Black', 3)).toBe('BLK')
  })

  it('produces an empty token for empty and whitespace-only input', () => {
    expect(skuToken('', 8)).toBe('')
    expect(skuToken('   ', 8)).toBe('')
  })

  it('is deterministic', () => {
    expect(skuToken('T-Shirt', 8)).toBe(skuToken('T-Shirt', 8))
  })
})

describe('generateSku', () => {
  it('pins the documented D-13 examples', () => {
    expect(generateSku('T-Shirt', 'M', 'Black')).toBe('TSHIRT-M-BLK')
    expect(generateSku('T-Shirt', 'XL', null)).toBe('TSHIRT-XL')
    expect(generateSku('Écusson brodé', 'M', 'White')).toBe('ECUSSONB-M-WHI')
  })

  it('strips punctuation and spaces before truncating each token', () => {
    expect(generateSku('Long Sleeve!', 'S', 'Navy Blue')).toBe('LONGSLEE-S-NAV')
  })

  it('returns just the name token when size and color are both null', () => {
    expect(generateSku('T-Shirt', null, null)).toBe('TSHIRT')
  })

  it('omits an empty name token with no leading dash', () => {
    expect(generateSku('', 'M', null)).toBe('M')
  })

  it('never produces a double dash or a trailing dash for a call with a null size', () => {
    const result = generateSku('T-Shirt', null, 'Black')
    expect(result).toBe('TSHIRT-BLK')
    expect(result).not.toContain('--')
    expect(result.endsWith('-')).toBe(false)
  })

  it('is deterministic', () => {
    expect(generateSku('T-Shirt', 'M', 'Black')).toBe(generateSku('T-Shirt', 'M', 'Black'))
  })
})
