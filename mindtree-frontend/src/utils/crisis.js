const CRISIS_PATTERNS = [
  { level: 'high', pattern: /自杀|轻生|结束生命|不想活|活不下去|想死|去死|跳楼|割腕/ },
  { level: 'high', pattern: /吞药|服药自杀|上吊|煤气自杀|伤害自己|自残/ },
  { level: 'medium', pattern: /撑不下去|没有意义|没人需要我|消失算了|好绝望|彻底崩溃/ },
]

const LEVEL_PRIORITY = {
  high: 2,
  medium: 1,
}

export function analyzeCrisisText(text) {
  const content = String(text || '').trim()
  if (!content) return null

  let result = null

  for (const item of CRISIS_PATTERNS) {
    const match = content.match(item.pattern)
    if (!match) continue

    if (!result || LEVEL_PRIORITY[item.level] > LEVEL_PRIORITY[result.level]) {
      result = {
        level: item.level,
        keyword: match[0],
      }
    }
  }

  return result
}
