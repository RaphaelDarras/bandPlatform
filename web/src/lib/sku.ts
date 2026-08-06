// D-13's deterministic SKU slug scheme (Claude's Discretion under D-13,
// 06.1-CONTEXT.md). Hand-rolled rather than pulling in a third-party
// slug-generation package: per RESEARCH's Don't-Hand-Roll table, such a
// dependency isn't worth vetting here, because D-13 already requires every generated SKU to stay a
// plain, freely editable text input -- the admin's manual override is the
// real correctness backstop for pre-printed labels, so this only needs to
// be a reasonable, deterministic convenience, not a perfect Unicode-aware
// transliteration.
//
// generateSku(name, size, color) joins skuToken(name, 8), skuToken(size, 4)
// and skuToken(color, 3) with '-', omitting any empty token so no '--' or
// trailing '-' can appear.
//
// skuToken(input, maxLength):
//   1. Uppercases, strips diacritics (`normalize('NFD')` followed by
//      dropping every combining mark in the u0300-u036f codepoint range --
//      the standard Unicode "Combining Diacritical Marks" block), then
//      removes every character that isn't A-Z or 0-9.
//   2. If the cleaned string already fits within maxLength, returns it as-is.
//   3. Otherwise truncates. A trailing vowel carries little distinguishing
//      information, so it's fine to cut plainly left-to-right
//      ('ECUSSONBRODE' -> 'ECUSSONB'). A trailing consonant (or digit) is
//      usually what makes a short size/color abbreviation recognisable --
//      plain truncation would silently drop it ('BLACK'.slice(0, 3) is
//      'BLA', losing the 'K' that reads as "black") -- so in that case the
//      final character is preserved and the cut happens just before it
//      ('BLACK' -> 'BLK', 'WHITE' -> 'WHI' since 'E' is a vowel and needs no
//      special handling).

const COMBINING_MARK_LOW = 0x0300
const COMBINING_MARK_HIGH = 0x036f
const VOWELS = new Set(['A', 'E', 'I', 'O', 'U'])

function stripDiacritics(input: string): string {
  return Array.from(input)
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0
      return code < COMBINING_MARK_LOW || code > COMBINING_MARK_HIGH
    })
    .join('')
}

export function skuToken(input: string, maxLength: number): string {
  const cleaned = stripDiacritics((input ?? '').normalize('NFD'))
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')

  if (cleaned.length <= maxLength) return cleaned

  const lastChar = cleaned[cleaned.length - 1]
  if (VOWELS.has(lastChar)) {
    return cleaned.slice(0, maxLength)
  }
  return cleaned.slice(0, maxLength - 1) + lastChar
}

export function generateSku(productName: string, size: string | null, color: string | null): string {
  const tokens = [skuToken(productName ?? '', 8), skuToken(size ?? '', 4), skuToken(color ?? '', 3)]
  return tokens.filter((token) => token.length > 0).join('-')
}
