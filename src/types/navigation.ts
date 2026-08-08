export type AppNavView =
  | 'home'
  | 'chat'
  | 'meetings'
  | 'shared'
  | 'folder'
  | 'tag'
  | 'person'
  | 'company'

export type SidebarSelection = {
  view: AppNavView
  folderId?: string
  tagName?: string
  personEmail?: string
  company?: string
}
