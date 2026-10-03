'use client'
import { useState, useEffect } from 'react'
import {
  Users, Users2, Plus, UserPlus, Mail, Crown, X,
  ChevronLeft, Copy, Check, Loader2, Activity,
  Shield, Trash2, CheckCircle2, Clock, AlertCircle, ArrowRight
} from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'

type TeamMember = {
  id: string
  tenant_id: string
  team_id: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  joined_at: string
  name: string
  email: string
}

type Team = {
  id: string
  owner_tenant_id: string
  name: string
  description: string
  member_count: number
  my_role: string
  owner_name: string
  owner_email: string
  created_at: string
}

type ActivityRun = {
  id: string
  status: string
  workflow_name: string
  member_name: string
  member_email: string
  created_at: string
  duration_ms: number | null
}

type PendingInvite = {
  id: string
  invited_email: string
  role: string
  expires_at: string
  invite_url: string
}

function roleBadge(role: string) {
  if (role === 'owner') return 'bg-emerald-50 text-emerald-800 border-emerald-200'
  if (role === 'admin') return 'bg-indigo-50 text-indigo-800 border-indigo-200'
  if (role === 'viewer') return 'bg-gray-100 text-gray-700 border-gray-200'
  return 'bg-sky-50 text-sky-800 border-sky-200'
}

function statusIcon(status: string) {
  if (status === 'completed') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
  if (status === 'failed') return <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
  return <Clock className="w-3.5 h-3.5 text-muted" />
}

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ── Create Team Modal ─────────────────────────────────────────────────────────

function CreateTeamModal({ onClose, onCreated }: { onClose: () => void; onCreated: (t: Team) => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    try {
      const res = await (api as any).teams.create({ name: name.trim(), description: description.trim() })
      onCreated(res.team)
      toast({ title: 'Team workspace initialized', type: 'success' })
      onClose()
    } catch (err: any) {
      toast({ title: 'Failed to create team', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-primary flex items-center gap-2">
            <Users2 className="w-4 h-4 text-secondary" />
            Create Team Workspace
          </h2>
          <button onClick={onClose} className="text-muted hover:text-primary transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="text-xs text-secondary font-medium mb-1.5 block">Team Identifier</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Security Operations Squad"
              className="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-primary placeholder-muted focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-action-primary/20 shadow-xs"
              autoFocus
              required
            />
          </div>
          <div>
            <label className="text-xs text-secondary font-medium mb-1.5 block">Mission Description <span className="text-muted">(optional)</span></label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Define operational boundaries and delegated responsibilities..."
              className="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-primary placeholder-muted focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-action-primary/20 resize-none h-20 shadow-xs"
            />
          </div>
          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-md border border-border text-xs font-medium text-secondary hover:bg-secondary transition-colors cursor-pointer shadow-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex-1 py-2 rounded-md bg-action-primary text-action-primary-text text-xs font-medium hover:bg-action-primary-hover transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users2 className="w-4 h-4" />}
              Create Workspace
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Invite Teammate Modal ───────────────────────────────────────────────────────

function InviteTeammateModal({ onClose, onInvite, teamId }: { onClose: () => void; onInvite: (invite: PendingInvite, url: string) => void; teamId: string }) {
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviting, setInviting] = useState(false)
  const { toast } = useToast()

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true)
    try {
      const res = await (api as any).teams.invite(teamId, inviteEmail.trim(), inviteRole)
      toast({ title: 'Invitation generated', type: 'success' })
      onInvite(res.invite, res.invite_url)
      onClose()
    } catch (err: any) {
      toast({ title: 'Could not send invite', type: 'error' })
    } finally {
      setInviting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-primary flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-secondary" />
            Invite Teammate
          </h2>
          <button onClick={onClose} className="text-muted hover:text-primary transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={sendInvite} className="space-y-4">
          <div>
            <label className="text-xs text-secondary font-medium mb-1.5 block">Email Address</label>
            <input
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="operator@company.com"
              type="email"
              className="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-primary placeholder-muted focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-action-primary/20 shadow-xs"
              autoFocus
              required
            />
          </div>
          <div>
            <label className="text-xs text-secondary font-medium mb-1.5 block">Access Role</label>
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value)}
              className="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-primary focus:outline-none focus:border-border-strong shadow-xs cursor-pointer"
            >
              <option value="member">Member (Execute & Monitor)</option>
              <option value="admin">Admin (Full Fleet Permissions)</option>
              <option value="viewer">Viewer (Read-Only Metrics)</option>
            </select>
          </div>
          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-md border border-border text-xs font-medium text-secondary hover:bg-secondary transition-colors cursor-pointer shadow-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={inviting || !inviteEmail.trim()}
              className="flex-1 py-2 rounded-md bg-action-primary text-action-primary-text text-xs font-medium hover:bg-action-primary-hover transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Send Invite
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Team Detail View ──────────────────────────────────────────────────────────

function TeamDetailView({ team, onBack, currentTenantId }: { team: Team; onBack: () => void; currentTenantId: string }) {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [activity, setActivity] = useState<ActivityRun[]>([])
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])
  const [myRole, setMyRole] = useState(team.my_role)
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviting, setInviting] = useState(false)
  const [copiedLink, setCopiedLink] = useState<string | null>(null)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    Promise.all([
      (api as any).teams.get(team.id),
      (api as any).teams.activity(team.id)
    ]).then(([detail, actRes]) => {
      setMembers(detail.members || [])
      setPendingInvites(detail.pending_invites || [])
      setMyRole(detail.my_role || team.my_role)
      setActivity(actRes.runs || [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [team.id, team.my_role])

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true)
    try {
      const res = await (api as any).teams.invite(team.id, inviteEmail.trim(), inviteRole)
      toast({ title: 'Invite sent', type: 'success' })
      setPendingInvites(prev => [...prev, { ...res.invite, invite_url: res.invite_url }])
      setInviteEmail('')
    } catch (err: any) {
      toast({ title: 'Could not send invite', type: 'error' })
    } finally {
      setInviting(false)
    }
  }

  const removeMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Remove ${memberName} from the team?`)) return
    try {
      await (api as any).teams.removeMember(team.id, memberId)
      setMembers(prev => prev.filter(m => m.tenant_id !== memberId))
      toast({ title: 'Member removed', type: 'success' })
    } catch (err: any) {
      toast({ title: 'Could not remove member', type: 'error' })
    }
  }

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(url)
      setTimeout(() => setCopiedLink(null), 2000)
    })
  }

  const isOwnerOrAdmin = myRole === 'owner' || myRole === 'admin'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <button
          onClick={onBack}
          className="p-1.5 rounded-md hover:bg-secondary border border-border text-secondary hover:text-primary transition-colors cursor-pointer shadow-xs"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-primary">{team.name}</h2>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border uppercase ${roleBadge(myRole)}`}>
              {myRole}
            </span>
          </div>
          {team.description && <p className="text-xs text-muted mt-0.5">{team.description}</p>}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Members Column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-surface border border-border rounded-lg shadow-xs overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
              <h3 className="text-xs font-semibold text-primary flex items-center gap-2">
                <Users className="w-4 h-4 text-secondary" />
                Team Members ({members.length})
              </h3>
            </div>
            {loading ? (
              <div className="p-4 space-y-3 animate-pulse">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-12 bg-secondary rounded-md" />
                ))}
              </div>
            ) : members.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted text-center px-4">
                <Users className="w-6 h-6 text-muted" />
                <p className="text-xs font-semibold text-primary">No members yet</p>
                <p className="text-xs text-muted max-w-xs">
                  Invite your operators to collaborate on shared pipelines and agents.
                </p>
                {isOwnerOrAdmin && (
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-action-primary text-action-primary-text text-xs font-medium rounded-md hover:bg-action-primary-hover transition-colors mt-2 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Invite Member
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {members.map(m => (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/40 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center text-xs font-semibold font-mono text-primary shrink-0">
                      {(m.name || m.email)?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-primary truncate">{m.name || m.email}</p>
                      <p className="text-[11px] text-muted truncate">{m.email}</p>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border uppercase ${roleBadge(m.role)}`}>
                      {m.role}
                    </span>
                    {isOwnerOrAdmin && m.tenant_id !== currentTenantId && m.role !== 'owner' && (
                      <button
                        onClick={() => removeMember(m.tenant_id, m.name || m.email)}
                        className="p-1 text-muted hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Remove member"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Invites */}
          {pendingInvites.length > 0 && (
            <div className="bg-surface border border-border rounded-lg shadow-xs overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-surface">
                <h3 className="text-xs font-semibold text-primary flex items-center gap-2">
                  <Mail className="w-4 h-4 text-secondary" />
                  Pending Invitations ({pendingInvites.length})
                </h3>
              </div>
              <div className="divide-y divide-border">
                {pendingInvites.map(inv => (
                  <div key={inv.id} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors">
                    <Mail className="w-4 h-4 text-muted shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-primary truncate">{inv.invited_email}</p>
                      <p className="text-[11px] text-muted">Role: {inv.role} · Expires {new Date(inv.expires_at).toLocaleDateString()}</p>
                    </div>
                    {inv.invite_url && (
                      <button
                        onClick={() => copyLink(inv.invite_url)}
                        className="flex items-center gap-1 text-xs text-secondary hover:text-primary transition-colors px-2 py-1 rounded border border-border hover:bg-secondary cursor-pointer shadow-xs"
                      >
                        {copiedLink === inv.invite_url ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedLink === inv.invite_url ? 'Copied' : 'Copy link'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invite Form */}
          {isOwnerOrAdmin && (
            <div className="bg-surface border border-border rounded-lg p-4 shadow-xs">
              <h3 className="text-xs font-semibold text-primary flex items-center gap-2 mb-3">
                <UserPlus className="w-4 h-4 text-secondary" />
                Invite Team Member
              </h3>
              <form onSubmit={sendInvite} className="flex flex-col sm:flex-row gap-2">
                <input
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  type="email"
                  className="flex-1 bg-surface border border-border rounded-md px-3 py-2 text-xs text-primary placeholder-muted focus:outline-none focus:border-border-strong shadow-xs"
                  required
                />
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                  className="bg-surface border border-border rounded-md px-2.5 py-2 text-xs text-primary focus:outline-none focus:border-border-strong shadow-xs cursor-pointer"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button
                  type="submit"
                  disabled={inviting || !inviteEmail.trim()}
                  className="px-4 py-2 bg-action-primary text-action-primary-text text-xs font-medium rounded-md hover:bg-action-primary-hover transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {inviting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                  Invite
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Activity Feed */}
        <div className="bg-surface border border-border rounded-lg shadow-xs overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-surface">
            <h3 className="text-xs font-semibold text-primary flex items-center gap-2">
              <Activity className="w-4 h-4 text-secondary" />
              Recent Execution Activity
            </h3>
          </div>
          {loading ? (
            <div className="p-4 space-y-3 animate-pulse">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 bg-secondary rounded-md" />
              ))}
            </div>
          ) : activity.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted gap-2">
              <Activity className="w-6 h-6" />
              <p className="text-xs">No team runs recorded yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border max-h-[480px] overflow-y-auto">
              {activity.map(run => (
                <div key={run.id} className="px-4 py-2.5 hover:bg-secondary/40 transition-colors">
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5">{statusIcon(run.status)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-primary truncate">{run.workflow_name || 'Task execution'}</p>
                      <p className="text-[11px] text-muted truncate">{run.member_name || run.member_email}</p>
                      <p className="text-[10px] text-muted font-mono mt-0.5">{relativeTime(run.created_at)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showInviteModal && (
        <InviteTeammateModal
          onClose={() => setShowInviteModal(false)}
          onInvite={(invite, url) => {
            setPendingInvites(prev => [...prev, { ...invite, invite_url: url }])
          }}
          teamId={team.id}
        />
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [currentTenantId, setCurrentTenantId] = useState('')
  const { toast } = useToast()

  useEffect(() => {
    try {
      const tenantStr = localStorage.getItem('chatai_tenant')
      if (tenantStr) {
        const t = JSON.parse(tenantStr)
        setCurrentTenantId(t.id || '')
      }
    } catch {}

    loadTeams()
  }, [])

  async function loadTeams() {
    setLoading(true)
    try {
      const res = await (api as any).teams.list()
      setTeams(res.teams || [])
    } catch {
      // silently fallback
    } finally {
      setLoading(false)
    }
  }

  const handleTeamCreated = (team: Team) => {
    setTeams(prev => [team, ...prev])
  }

  const deleteTeam = async (teamId: string, teamName: string) => {
    if (!confirm(`Delete "${teamName}"? This cannot be undone.`)) return
    try {
      await (api as any).teams.delete(teamId)
      setTeams(prev => prev.filter(t => t.id !== teamId))
      if (selectedTeam?.id === teamId) setSelectedTeam(null)
      toast({ title: 'Team workspace deleted', type: 'success' })
    } catch (err: any) {
      toast({ title: 'Could not delete team', type: 'error' })
    }
  }

  if (selectedTeam) {
    return (
      <div className="min-h-screen bg-background text-primary">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <TeamDetailView
            team={selectedTeam}
            onBack={() => setSelectedTeam(null)}
            currentTenantId={currentTenantId}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-primary">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <span className="text-xs font-mono font-medium text-muted uppercase tracking-wider">Access & Governance</span>
            <h1 className="text-2xl font-bold tracking-tight text-primary mt-1">Team Workspaces</h1>
            <p className="text-xs text-secondary mt-1">
              Collaborative squad environments, shared execution memory, and granular RBAC.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-action-primary text-action-primary-text text-xs font-medium rounded-md hover:bg-action-primary-hover transition-colors shadow-xs cursor-pointer self-start"
          >
            <Plus className="w-4 h-4" />
            Create Workspace
          </button>
        </div>

        {/* Stats */}
        {teams.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-surface border border-border rounded-lg p-4 flex gap-3 items-center shadow-xs">
              <div className="w-9 h-9 bg-secondary border border-border rounded-md flex items-center justify-center">
                <Users className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold font-mono text-primary">{teams.length}</p>
                <p className="text-xs text-muted">Active Teams</p>
              </div>
            </div>
            <div className="bg-surface border border-border rounded-lg p-4 flex gap-3 items-center shadow-xs">
              <div className="w-9 h-9 bg-secondary border border-border rounded-md flex items-center justify-center">
                <Users2 className="w-4 h-4 text-secondary" />
              </div>
              <div>
                <p className="text-xl font-bold font-mono text-primary">{teams.reduce((s, t) => s + Number(t.member_count || 0), 0)}</p>
                <p className="text-xs text-muted">Total Seat Holders</p>
              </div>
            </div>
            <div className="bg-surface border border-border rounded-lg p-4 flex gap-3 items-center shadow-xs">
              <div className="w-9 h-9 bg-secondary border border-border rounded-md flex items-center justify-center">
                <Shield className="w-4 h-4 text-secondary" />
              </div>
              <div>
                <p className="text-xl font-bold font-mono text-primary">{teams.filter(t => t.my_role === 'owner').length}</p>
                <p className="text-xs text-muted">Owned Workspaces</p>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="grid md:grid-cols-2 gap-4 animate-pulse">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-40 bg-surface border border-border rounded-lg p-4" />
            ))}
          </div>
        ) : teams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center bg-surface border border-border rounded-lg p-8 shadow-xs">
            <div className="w-12 h-12 bg-secondary border border-border rounded-lg flex items-center justify-center">
              <Users2 className="w-6 h-6 text-secondary" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-sm font-semibold text-primary">No team workspaces created</h3>
              <p className="text-xs text-muted max-w-sm">
                Organize your workforce into squads to isolate shared memory context and delegate task triggers.
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-action-primary text-action-primary-text text-xs font-medium rounded-md hover:bg-action-primary-hover transition-colors mt-2 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Create Squad Workspace
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {teams.map(team => (
              <div
                key={team.id}
                className="bg-surface border border-border rounded-lg p-5 hover:border-border-strong transition-all shadow-xs"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-md bg-secondary border border-border flex items-center justify-center">
                      <span className="text-primary font-bold font-mono text-sm">{team.name[0]?.toUpperCase()}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-primary text-sm">{team.name}</h3>
                      <p className="text-xs text-muted font-mono">{team.member_count} member{Number(team.member_count) !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  {team.my_role === 'owner' && (
                    <span className="text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                      <Crown className="w-3 h-3" /> Owner
                    </span>
                  )}
                </div>

                {team.description && (
                  <p className="text-xs text-secondary mb-4 line-clamp-2">{team.description}</p>
                )}

                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border">
                  <button
                    onClick={() => setSelectedTeam(team)}
                    className="flex-1 py-1.5 bg-surface hover:bg-secondary border border-border text-primary text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    View Workspace
                    <ArrowRight className="w-3.5 h-3.5 text-secondary" />
                  </button>
                  {team.my_role === 'owner' && (
                    <button
                      onClick={() => deleteTeam(team.id, team.name)}
                      className="p-1.5 text-muted hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-md transition-colors cursor-pointer"
                      title="Delete team workspace"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateTeamModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleTeamCreated}
        />
      )}
    </div>
  )
}
