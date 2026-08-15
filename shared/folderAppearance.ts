/** Shared folder appearance + nesting helpers (renderer + electron + tests). */

export const FOLDER_COLOR_IDS = [
  'gray',
  'slate',
  'blue',
  'teal',
  'green',
  'beige',
  'amber',
  'coral',
  'rose',
  'indigo',
] as const

export type FolderColorId = (typeof FOLDER_COLOR_IDS)[number]

/** Hex values tuned for dark Clarifi chrome (readable on --ds-bg-panel). */
export const FOLDER_COLORS: Record<FolderColorId, string> = {
  gray: '#8b93a7',
  slate: '#64748b',
  blue: '#2b6cff',
  teal: '#0d9488',
  green: '#22a06b',
  beige: '#c4a574',
  amber: '#d97706',
  coral: '#e07a5f',
  rose: '#e11d48',
  indigo: '#4f6bed',
}

export const DEFAULT_FOLDER_COLOR: FolderColorId = 'gray'

export const FOLDER_ICON_IDS = [
  'folder',
  'briefcase',
  'users',
  'calendar',
  'mic',
  'video',
  'document',
  'star',
  'bookmark',
  'flag',
  'rocket',
  'target',
  'chart',
  'lightbulb',
  'building',
  'handshake',
  'mail',
  'tag',
  'shield',
  'sparkles',
] as const

export type FolderIconId = (typeof FOLDER_ICON_IDS)[number]

export const DEFAULT_FOLDER_ICON: FolderIconId = 'folder'

/** Max nesting: root (depth 0) → child (depth 1). No grandchildren. */
export const FOLDER_MAX_DEPTH = 1

export type FolderLike = {
  id: string
  parentId?: string | null
}

export function isFolderColorId(value: unknown): value is FolderColorId {
  return typeof value === 'string' && (FOLDER_COLOR_IDS as readonly string[]).includes(value)
}

export function isFolderIconId(value: unknown): value is FolderIconId {
  return typeof value === 'string' && (FOLDER_ICON_IDS as readonly string[]).includes(value)
}

export function isFolderEmoji(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false
  if (isFolderIconId(value)) return false
  // Single emoji / short pictograph (allow ZWJ sequences up to ~8 code units)
  return [...value.trim()].length >= 1 && [...value.trim()].length <= 8
}

export function folderColorHex(color: string | undefined | null): string {
  if (isFolderColorId(color)) return FOLDER_COLORS[color]
  return FOLDER_COLORS[DEFAULT_FOLDER_COLOR]
}

export function folderDepth(folders: FolderLike[], id: string): number {
  const byId = new Map(folders.map((f) => [f.id, f]))
  let depth = 0
  let current = byId.get(id)
  const seen = new Set<string>()
  while (current?.parentId) {
    if (seen.has(current.id)) return depth
    seen.add(current.id)
    depth += 1
    current = byId.get(current.parentId)
    if (depth > 20) break
  }
  return depth
}

export function wouldExceedFolderDepth(
  folders: FolderLike[],
  folderId: string,
  newParentId: string | null,
): boolean {
  if (!newParentId) return false
  if (newParentId === folderId) return true
  const parentDepth = folderDepth(folders, newParentId)
  if (parentDepth >= FOLDER_MAX_DEPTH) return true
  // Moving a folder that already has children under a parent would create depth 2
  const hasChild = folders.some((f) => f.parentId === folderId)
  if (hasChild && parentDepth >= 0 && newParentId) {
    // child of moved folder would be at parentDepth+2
    if (parentDepth + 1 >= FOLDER_MAX_DEPTH) return true
  }
  return false
}

export function isAncestorOf(
  folders: FolderLike[],
  ancestorId: string,
  nodeId: string,
): boolean {
  const byId = new Map(folders.map((f) => [f.id, f]))
  let current = byId.get(nodeId)
  const seen = new Set<string>()
  while (current?.parentId) {
    if (current.parentId === ancestorId) return true
    if (seen.has(current.id)) return false
    seen.add(current.id)
    current = byId.get(current.parentId)
  }
  return false
}

export function canReparentFolder(
  folders: FolderLike[],
  folderId: string,
  newParentId: string | null,
): boolean {
  if (newParentId === folderId) return false
  if (newParentId && isAncestorOf(folders, folderId, newParentId)) return false
  if (wouldExceedFolderDepth(folders, folderId, newParentId)) return false
  if (newParentId) {
    const parentDepth = folderDepth(folders, newParentId)
    if (parentDepth >= FOLDER_MAX_DEPTH) return false
    const hasChild = folders.some((f) => f.parentId === folderId)
    if (hasChild) return false // cannot nest a parent that already has children under another folder
  }
  return true
}

export type FolderTreeNode<T extends FolderLike> = T & { children: FolderTreeNode<T>[] }

export function buildFolderTree<T extends FolderLike>(folders: T[]): FolderTreeNode<T>[] {
  const nodes = new Map<string, FolderTreeNode<T>>()
  for (const folder of folders) {
    nodes.set(folder.id, { ...folder, children: [] })
  }
  const roots: FolderTreeNode<T>[] = []
  for (const folder of folders) {
    const node = nodes.get(folder.id)!
    const parentId = folder.parentId ?? null
    if (parentId && nodes.has(parentId)) {
      nodes.get(parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  const sortRec = (list: FolderTreeNode<T>[]) => {
    list.sort((a, b) => {
      const ao = 'sortOrder' in a && typeof (a as { sortOrder?: number }).sortOrder === 'number'
        ? (a as { sortOrder: number }).sortOrder
        : 0
      const bo = 'sortOrder' in b && typeof (b as { sortOrder?: number }).sortOrder === 'number'
        ? (b as { sortOrder: number }).sortOrder
        : 0
      return ao - bo
    })
    for (const child of list) sortRec(child.children)
  }
  sortRec(roots)
  return roots
}
