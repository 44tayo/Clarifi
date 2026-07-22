export type AppNavView = 'home' | 'chat' | 'meetings' | 'shared' | 'folder'

export type SidebarSelection = {
  view: AppNavView
  folderId?: string
}
