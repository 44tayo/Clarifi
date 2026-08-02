export type AppNavView = 'home' | 'chat' | 'meetings' | 'shared' | 'folder' | 'tag'

export type SidebarSelection = {
  view: AppNavView
  folderId?: string
  tagName?: string
}
