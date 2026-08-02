/** Serialize Clarifi Summary DOM (contentEditable) back to enhance markdown. */

function inlineText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''
  if (!(node instanceof HTMLElement)) return ''
  const tag = node.tagName.toLowerCase()
  const inner = Array.from(node.childNodes).map(inlineText).join('')
  if (tag === 'strong' || tag === 'b') return `**${inner}**`
  if (tag === 'em' || tag === 'i') return `*${inner}*`
  if (tag === 'code') return `\`${inner}\``
  if (tag === 'a') {
    const href = node.getAttribute('href') ?? ''
    return href ? `[${inner}](${href})` : inner
  }
  if (tag === 'br') return '\n'
  return inner
}

function serializeList(ul: HTMLElement, indent: number): string[] {
  const lines: string[] = []
  const pad = '  '.repeat(indent)
  for (const child of Array.from(ul.children)) {
    if (!(child instanceof HTMLElement) || child.tagName.toLowerCase() !== 'li') continue
    const nested: HTMLElement[] = []
    const parts: string[] = []
    for (const node of Array.from(child.childNodes)) {
      if (node instanceof HTMLElement && node.tagName.toLowerCase() === 'ul') {
        nested.push(node)
      } else {
        parts.push(inlineText(node))
      }
    }
    const text = parts.join('').replace(/\s+/g, ' ').trim()
    if (text) lines.push(`${pad}- ${text}`)
    for (const nest of nested) {
      lines.push(...serializeList(nest, indent + 1))
    }
  }
  return lines
}

export function serializeSummaryDom(root: HTMLElement): string {
  const parts: string[] = []
  for (const child of Array.from(root.children)) {
    if (!(child instanceof HTMLElement)) continue
    if (child.classList.contains('artifact-summary-footer')) continue
    if (child.classList.contains('artifact-summary-section')) {
      const heading = child.querySelector('.artifact-summary-heading')
      const title =
        heading?.textContent?.replace(/^#\s*/, '').trim() ||
        heading?.querySelector('.artifact-summary-title')?.textContent?.trim() ||
        'Section'
      parts.push(`# ${title}`)
      const blocks = child.querySelector('.artifact-summary-blocks')
      if (blocks) {
        for (const block of Array.from(blocks.children)) {
          if (!(block instanceof HTMLElement)) continue
          const tag = block.tagName.toLowerCase()
          if (tag === 'ul') {
            parts.push(...serializeList(block, 0))
          } else if (tag === 'blockquote') {
            const text = inlineText(block).replace(/\s+/g, ' ').trim()
            if (text) parts.push(`> ${text}`)
          } else {
            const text = inlineText(block).replace(/\s+/g, ' ').trim()
            if (text) parts.push(text)
          }
        }
      }
      parts.push('')
    }
  }
  return parts.join('\n').trim()
}

export function claimKey(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase()
}

export function flattenInlineText(
  nodes: Array<{ type: string; text?: string }>,
): string {
  return nodes
    .map((n) => ('text' in n && typeof n.text === 'string' ? n.text : ''))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}
