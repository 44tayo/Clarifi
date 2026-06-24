import { useCallback, useEffect, useMemo, useState } from 'react'
import { SettingsPageHeader } from '../SettingsPageHeader'
import type {
  CommunityFolder,
  CommunityInvite,
  CommunityItem,
  CommunitySummary,
  DeviceProfile,
} from '../types'
import { hasCommunitiesAccess } from '../utils'

type CommunityTabProps = {
  profile: DeviceProfile | null
  onBilling: () => void
}

function buildFolderTree(folders: CommunityFolder[]): Array<CommunityFolder & { depth: number }> {
  const byParent = new Map<string | null, CommunityFolder[]>()
  for (const folder of folders) {
    const key = folder.parentId
    const list = byParent.get(key) ?? []
    list.push(folder)
    byParent.set(key, list)
  }

  const result: Array<CommunityFolder & { depth: number }> = []
  const walk = (parentId: string | null, depth: number) => {
    const children = byParent.get(parentId) ?? []
    for (const child of children.sort((a, b) => a.sortOrder - b.sortOrder)) {
      result.push({ ...child, depth })
      walk(child.id, depth + 1)
    }
  }
  walk(null, 0)
  return result
}

function itemTypeLabel(type: CommunityItem['type']): string {
  if (type === 'meeting_recap') return 'Recap'
  if (type === 'transcript') return 'Transcript'
  return 'Note'
}

export function CommunityTab({ profile, onBilling }: CommunityTabProps) {
  const hasAccess = hasCommunitiesAccess(profile)
  const [communities, setCommunities] = useState<CommunitySummary[]>([])
  const [invites, setInvites] = useState<CommunityInvite[]>([])
  const [selectedCommunityId, setSelectedCommunityId] = useState('')
  const [folders, setFolders] = useState<CommunityFolder[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState('')
  const [items, setItems] = useState<CommunityItem[]>([])
  const [selectedItem, setSelectedItem] = useState<CommunityItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newCommunityName, setNewCommunityName] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [inviteError, setInviteError] = useState('')

  const folderTree = useMemo(() => buildFolderTree(folders), [folders])
  const selectedCommunity = communities.find((c) => c.id === selectedCommunityId)
  const isOwner = selectedCommunity?.role === 'owner'

  const loadCommunities = useCallback(async () => {
    if (!hasAccess) return
    setLoading(true)
    setError('')
    try {
      const data = (await window.electronAPI.invoke('community:list')) as {
        communities?: CommunitySummary[]
        invites?: CommunityInvite[]
        error?: string
      }
      if (data.error) {
        setError(data.error)
        return
      }
      const list = data.communities ?? []
      setCommunities(list)
      setInvites(data.invites ?? [])
      if (!selectedCommunityId && list[0]) {
        setSelectedCommunityId(list[0].id)
      }
    } finally {
      setLoading(false)
    }
  }, [hasAccess, selectedCommunityId])

  useEffect(() => {
    void loadCommunities()
  }, [loadCommunities])

  useEffect(() => {
    if (!selectedCommunityId || !hasAccess) return
    void window.electronAPI
      .invoke('community:folders', { communityId: selectedCommunityId })
      .then((data) => {
        const payload = data as { folders?: CommunityFolder[] }
        const list = payload.folders ?? []
        setFolders(list)
        if (!selectedFolderId && list[0]) setSelectedFolderId(list[0].id)
      })
  }, [selectedCommunityId, hasAccess, selectedFolderId])

  useEffect(() => {
    if (!selectedCommunityId || !hasAccess) return
    void window.electronAPI
      .invoke('community:items', {
        communityId: selectedCommunityId,
        folderId: selectedFolderId || null,
      })
      .then((data) => {
        const payload = data as { items?: CommunityItem[] }
        setItems(payload.items ?? [])
      })
  }, [selectedCommunityId, selectedFolderId, hasAccess])

  const handleCreateCommunity = async () => {
    const name = newCommunityName.trim()
    if (!name) return
    const data = (await window.electronAPI.invoke('community:create', { name })) as {
      community?: CommunitySummary
      error?: string
    }
    if (data.community) {
      setCommunities((prev) => [...prev, data.community!])
      setSelectedCommunityId(data.community.id)
      setShowCreate(false)
      setNewCommunityName('')
    } else {
      setError(data.error ?? 'create_failed')
    }
  }

  const handleInvite = async () => {
    if (!selectedCommunityId) return
    setInviteError('')
    const data = (await window.electronAPI.invoke('community:invite', {
      communityId: selectedCommunityId,
      email: inviteEmail.trim(),
    })) as { error?: string }
    if (data.error) {
      setInviteError(
        data.error === 'invite_requires_pro_plus'
          ? 'Invitee must have an active Pro+ subscription.'
          : data.error,
      )
      return
    }
    setShowInvite(false)
    setInviteEmail('')
  }

  const handleAcceptInvite = async (invite: CommunityInvite) => {
    const data = (await window.electronAPI.invoke('community:accept-invite', {
      communityId: invite.communityId,
      token: invite.token,
    })) as { communityId?: string; error?: string }
    if (data.error) {
      setError(data.error)
      return
    }
    void loadCommunities()
  }

  const handleCreateFolder = async () => {
    if (!selectedCommunityId) return
    const name = newFolderName.trim()
    if (!name) return
    const data = (await window.electronAPI.invoke('community:create-folder', {
      communityId: selectedCommunityId,
      name,
      parentId: selectedFolderId || null,
    })) as { folder?: CommunityFolder }
    if (data.folder) {
      setFolders((prev) => [...prev, data.folder!])
      setShowNewFolder(false)
      setNewFolderName('')
    }
  }

  if (!hasAccess) {
    return (
      <>
        <SettingsPageHeader
          title="Community"
          description="Share meeting recaps, transcripts, and notes with your Pro+ team."
        />
        <div className="settings-card settings-profile-card">
          <div className="settings-card-title">Pro+ required</div>
          <p className="settings-card-desc">
            Communities let Pro+ teams organize and share session content in the cloud. Upgrade to
            create a community and invite teammates who also have Pro+.
          </p>
          <button type="button" className="settings-btn primary" onClick={onBilling}>
            Upgrade to Pro+
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <SettingsPageHeader
        title="Community"
        description="Share meeting recaps, transcripts, and notes with your Pro+ team."
        actions={
          <div className="settings-page-header-actions">
            <button type="button" className="settings-btn small" onClick={() => setShowCreate(true)}>
              New community
            </button>
            {isOwner ? (
              <button type="button" className="settings-btn small primary" onClick={() => setShowInvite(true)}>
                Invite member
              </button>
            ) : null}
          </div>
        }
      />

      {invites.length > 0 ? (
        <div className="settings-card settings-community-invites">
          <div className="settings-card-title">Pending invites</div>
          {invites.map((invite) => (
            <div key={invite.id} className="settings-community-invite-row">
              <span>
                {invite.communityName} · {invite.email}
              </span>
              <button
                type="button"
                className="settings-btn small primary"
                onClick={() => void handleAcceptInvite(invite)}
              >
                Accept
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {loading ? <p className="settings-empty">Loading communities…</p> : null}
      {error ? <p className="settings-modal-error">{error}</p> : null}

      {communities.length === 0 && !loading ? (
        <div className="settings-empty-state">
          <p className="settings-empty">No communities yet.</p>
          <button type="button" className="settings-btn primary" onClick={() => setShowCreate(true)}>
            Create your first community
          </button>
        </div>
      ) : null}

      {communities.length > 0 ? (
        <div className="settings-community-layout">
          <aside className="settings-community-picker">
            {communities.map((community) => (
              <button
                key={community.id}
                type="button"
                className={`settings-community-picker-btn ${community.id === selectedCommunityId ? 'active' : ''}`}
                onClick={() => {
                  setSelectedCommunityId(community.id)
                  setSelectedFolderId('')
                  setSelectedItem(null)
                }}
              >
                <span className="settings-community-picker-name">{community.name}</span>
                <span className="settings-community-picker-meta">
                  {community.memberCount} member{community.memberCount === 1 ? '' : 's'}
                </span>
              </button>
            ))}
          </aside>

          <section className="settings-community-folders">
            <div className="settings-community-panel-header">
              <span>Folders</span>
              {isOwner ? (
                <button
                  type="button"
                  className="settings-link-btn"
                  onClick={() => setShowNewFolder(true)}
                >
                  + New folder
                </button>
              ) : null}
            </div>
            <div className="settings-community-folder-list">
              {folderTree.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  className={`settings-community-folder-btn ${folder.id === selectedFolderId ? 'active' : ''}`}
                  style={{ paddingLeft: `${12 + folder.depth * 14}px` }}
                  onClick={() => {
                    setSelectedFolderId(folder.id)
                    setSelectedItem(null)
                  }}
                >
                  {folder.name}
                </button>
              ))}
            </div>
          </section>

          <section className="settings-community-items">
            <div className="settings-community-panel-header">
              <span>Shared items</span>
            </div>
            {items.length === 0 ? (
              <p className="settings-empty">No items in this folder yet.</p>
            ) : (
              <div className="settings-list-view settings-list-view--compact">
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`settings-list-row settings-list-row--button ${selectedItem?.id === item.id ? 'active' : ''}`}
                    onClick={() => setSelectedItem(item)}
                  >
                    <div className="settings-list-row-main">
                      <div className="settings-list-row-title">{item.title}</div>
                      <div className="settings-list-row-meta">
                        {itemTypeLabel(item.type)} · {new Date(item.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          {selectedItem ? (
            <aside className="settings-community-detail">
              <div className="settings-community-panel-header">
                <span>{selectedItem.title}</span>
                <button type="button" className="settings-link-btn" onClick={() => setSelectedItem(null)}>
                  Close
                </button>
              </div>
              <div className="settings-community-detail-body">
                {selectedItem.type === 'meeting_recap' ? (
                  <pre className="settings-community-json">
                    {JSON.stringify(selectedItem.content, null, 2)}
                  </pre>
                ) : selectedItem.type === 'transcript' ? (
                  <div className="settings-community-transcript">
                    {Array.isArray(selectedItem.content)
                      ? selectedItem.content.map((line, i) => {
                          const entry = line as { text?: string; speaker?: string }
                          return (
                            <p key={i}>
                              {entry.speaker ? <strong>{entry.speaker}: </strong> : null}
                              {entry.text}
                            </p>
                          )
                        })
                      : null}
                  </div>
                ) : (
                  <pre className="settings-community-json">
                    {typeof selectedItem.content === 'object' &&
                    selectedItem.content &&
                    'text' in (selectedItem.content as object)
                      ? String((selectedItem.content as { text: string }).text)
                      : JSON.stringify(selectedItem.content, null, 2)}
                  </pre>
                )}
              </div>
            </aside>
          ) : null}
        </div>
      ) : null}

      {showCreate ? (
        <div className="settings-modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="settings-modal-title">New community</h2>
            <div className="settings-field">
              <label>Name</label>
              <input
                className="settings-input"
                value={newCommunityName}
                onChange={(e) => setNewCommunityName(e.target.value)}
                placeholder="Sales team"
              />
            </div>
            <div className="settings-modal-actions">
              <button type="button" className="settings-btn" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="settings-btn primary"
                onClick={() => void handleCreateCommunity()}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showInvite ? (
        <div className="settings-modal-backdrop" onClick={() => setShowInvite(false)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="settings-modal-title">Invite member</h2>
            <p className="settings-modal-desc">Invitees must have an active Pro+ subscription.</p>
            <div className="settings-field">
              <label>Email</label>
              <input
                className="settings-input"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@company.com"
              />
            </div>
            {inviteError ? <p className="settings-modal-error">{inviteError}</p> : null}
            <div className="settings-modal-actions">
              <button type="button" className="settings-btn" onClick={() => setShowInvite(false)}>
                Cancel
              </button>
              <button type="button" className="settings-btn primary" onClick={() => void handleInvite()}>
                Send invite
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showNewFolder ? (
        <div className="settings-modal-backdrop" onClick={() => setShowNewFolder(false)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="settings-modal-title">New folder</h2>
            <div className="settings-field">
              <label>Name</label>
              <input
                className="settings-input"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
              />
            </div>
            <div className="settings-modal-actions">
              <button type="button" className="settings-btn" onClick={() => setShowNewFolder(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="settings-btn primary"
                onClick={() => void handleCreateFolder()}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
