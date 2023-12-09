/** https://github.com/WaniKani/WanaKana/blob/master/src/utils/romajiToKanaMap.js */
export const SMALL_Y = { ya: 'ゃ', yi: 'ぃ', yu: 'ゅ', ye: 'ぇ', yo: 'ょ' }
export const SMALL_VOWELS = { a: 'ぁ', i: 'ぃ', u: 'ぅ', e: 'ぇ', o: 'ぉ' }

export const SMALL_KANA = { ...SMALL_Y, ...SMALL_VOWELS }

const HIRA_KATA_DIFF = 'ア'.codePointAt(0)! - 'あ'.codePointAt(0)!

export function kata2hira(s: string) {
  return s.replace(/\p{sc=Katakana}/gu, (c) =>
    String.fromCodePoint(c.codePointAt(0)! - HIRA_KATA_DIFF)
  )
}
