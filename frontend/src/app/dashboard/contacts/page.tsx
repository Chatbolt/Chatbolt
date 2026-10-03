'use client'
import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { 
  Users, Search, Download, Mail, Phone, MessageSquare,
  MoreHorizontal, UserPlus, Clock, ExternalLink, Activity, Database,
  X, Building2, ChevronLeft, ChevronRight, Edit3,
  Globe, RefreshCw, Check
} from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  lead: 'bg-amber-50 text-amber-800 border-amber-200',
  qualified: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  customer: 'bg-sky-50 text-sky-800 border-sky-200',
  churned: 'bg-rose-50 text-rose-800 border-rose-200',
  archived: 'bg-gray-100 text-gray-700 border-gray-200',
}

const SOURCE_ICONS: Record<string, any> = {
  website: Globe,
  whatsapp: MessageSquare,
  api: Database,
  manual: Users,
  import: Download,
  chat: MessageSquare,
  other: ExternalLink,
}

type Contact = {
  id: string
  name: string
  email?: string
  phone?: string
  company?: string
  title?: string
  source: string
  status: string
  notes?: string
  interaction_count?: number
  created_at: string
}

type Stats = {
  total: string
  leads: string
  qualified: string
  customers: string
  new_this_week: string
}

export default function ContactsPage() {
  const { success: toastSuccess, error: toastError } = useToast()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editContact, setEditContact] = useState<Contact | null>(null)
  const [actionMenuId, setActionMenuId] = useState<string | null>(null)
  const limit = 20

  const [form, setForm] = useState({
    name: '', email: '', phone: '', company: '', title: '',
    source: 'manual', status: 'lead', notes: ''
  })

  const loadContacts = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.contacts.list({ search: search || undefined, status: statusFilter || undefined, page, limit })
      setContacts(res.contacts || [])
      setTotal(res.total || 0)
      setStats(res.stats || null)
    } catch (err: any) {
      toastError('Failed to load contacts', err.message)
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, page])

  useEffect(() => { loadContacts() }, [loadContacts])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.contacts.create(form)
      toastSuccess('Contact created successfully')
      setShowAddModal(false)
      setForm({ name: '', email: '', phone: '', company: '', title: '', source: 'manual', status: 'lead', notes: '' })
      loadContacts()
    } catch (err: any) {
      toastError('Failed to create contact', err.message)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editContact) return
    try {
      await api.contacts.update(editContact.id, form)
      toastSuccess('Contact updated')
      setEditContact(null)
      loadContacts()
    } catch (err: any) {
      toastError('Failed to update contact', err.message)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Archive this contact?')) return
    try {
      await api.contacts.delete(id)
      toastSuccess('Contact archived')
      setActionMenuId(null)
      loadContacts()
    } catch (err: any) {
      toastError('Failed to archive contact', err.message)
    }
  }

  const openEdit = (c: Contact) => {
    setForm({
      name: c.name, email: c.email || '', phone: c.phone || '',
      company: c.company || '', title: c.title || '',
      source: c.source, status: c.status, notes: c.notes || ''
    })
    setEditContact(c)
    setActionMenuId(null)
  }

  const handleExport = async () => {
    try {
      const { contacts: all } = await api.contacts.exportAll()
      const header = 'Name,Email,Phone,Company,Title,Source,Status,Created\n'
      const rows = all.map(c =>
        `"${c.name}","${c.email || ''}","${c.phone || ''}","${c.company || ''}","${c.title || ''}",${c.source},${c.status},"${new Date(c.created_at).toLocaleDateString()}"`
      ).join('\n')
      const blob = new Blob([header + rows], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'contacts.csv'; a.click()
      URL.revokeObjectURL(url)
      toastSuccess('Contacts exported')
    } catch (err: any) {
      toastError('Export failed', err.message)
    }
  }

  const statCards = [
    { label: 'Total Contacts', value: stats?.total || '0', icon: Users, color: 'text-primary' },
    { label: 'Identified Leads', value: stats?.leads || '0', icon: Activity, color: 'text-amber-700' },
    { label: 'Qualified Accounts', value: stats?.qualified || '0', icon: Check, color: 'text-emerald-700' },
    { label: 'New This Week', value: stats?.new_this_week || '0', icon: UserPlus, color: 'text-indigo-700' },
  ]

  const totalPages = Math.ceil(total / limit)

  const ModalContent = ({ onSubmit, title }: { onSubmit: (e: React.FormEvent) => void; title: string }) => (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-xl p-6 max-w-lg w-full shadow-xl relative">
        <button onClick={() => { setShowAddModal(false); setEditContact(null) }} className="absolute top-4 right-4 text-muted hover:text-primary transition-colors cursor-pointer">
          <X size={16} />
        </button>
        <h2 className="text-base font-bold text-primary mb-4">{title}</h2>
        <form onSubmit={onSubmit} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <label className="text-xs font-medium text-secondary">Full Name *</label>
              <input required className="w-full bg-surface border border-border rounded-md px-3 py-1.5 text-xs text-primary focus:border-border-strong outline-none shadow-xs" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="John Smith" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-secondary">Email Address</label>
              <input type="email" className="w-full bg-surface border border-border rounded-md px-3 py-1.5 text-xs text-primary focus:border-border-strong outline-none shadow-xs" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="john@company.com" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-secondary">Phone Number</label>
              <input className="w-full bg-surface border border-border rounded-md px-3 py-1.5 text-xs text-primary focus:border-border-strong outline-none shadow-xs" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1 (555) 0123" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-secondary">Company</label>
              <input className="w-full bg-surface border border-border rounded-md px-3 py-1.5 text-xs text-primary focus:border-border-strong outline-none shadow-xs" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="Acme Logistics" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-secondary">Title / Role</label>
              <input className="w-full bg-surface border border-border rounded-md px-3 py-1.5 text-xs text-primary focus:border-border-strong outline-none shadow-xs" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Director of Ops" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-secondary">Lead Source</label>
              <select className="w-full bg-surface border border-border rounded-md px-3 py-1.5 text-xs text-primary focus:border-border-strong outline-none shadow-xs" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
                {['manual','website','whatsapp','api','import','chat','other'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-secondary">Lifecycle Status</label>
              <select className="w-full bg-surface border border-border rounded-md px-3 py-1.5 text-xs text-primary focus:border-border-strong outline-none shadow-xs" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {['lead','qualified','customer','churned','archived'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-xs font-medium text-secondary">Context & Notes</label>
              <textarea rows={2} className="w-full bg-surface border border-border rounded-md px-3 py-1.5 text-xs text-primary focus:border-border-strong outline-none resize-none shadow-xs" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional details or constraints..." />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => { setShowAddModal(false); setEditContact(null) }} className="px-3 py-1.5 border border-border bg-surface text-secondary hover:bg-secondary text-xs font-medium rounded-md cursor-pointer shadow-xs">
              Cancel
            </button>
            <button type="submit" className="px-4 py-1.5 bg-action-primary text-action-primary-text hover:bg-action-primary-hover font-medium rounded-md text-xs transition-all shadow-xs cursor-pointer">
              {title.includes('Create') ? 'Create Contact' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-full bg-background text-primary overflow-y-auto" onClick={() => setActionMenuId(null)}>
      
      {/* Header bar */}
      <div className="h-14 border-b border-border bg-surface flex items-center justify-between px-6 shrink-0 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-primary">
            <Database size={14} className="text-secondary" /> CRM & Entity Registry
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            {(['', 'lead', 'qualified', 'customer'] as const).map(s => (
              <button 
                key={s} 
                onClick={() => { setStatusFilter(s); setPage(1) }}
                className={`text-xs font-medium px-2 py-1 rounded transition-colors cursor-pointer ${
                  statusFilter === s 
                  ? 'bg-action-primary text-action-primary-text shadow-xs' 
                  : 'text-secondary hover:text-primary'
                }`}
              >
                {s === '' ? 'All Contacts' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleExport} 
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border rounded-md text-xs font-medium text-secondary hover:text-primary hover:bg-secondary transition-all shadow-xs cursor-pointer"
          >
            <Download size={13} /> Export CSV
          </button>
          <button 
            onClick={() => { setShowAddModal(true); setEditContact(null); setForm({ name: '', email: '', phone: '', company: '', title: '', source: 'manual', status: 'lead', notes: '' }) }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-action-primary text-action-primary-text hover:bg-action-primary-hover rounded-md text-xs font-medium transition-all shadow-xs cursor-pointer"
          >
            <UserPlus size={13} /> Add Contact
          </button>
        </div>
      </div>

      <div className="flex-1 max-w-6xl mx-auto w-full px-6 py-8 space-y-6">
        
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((s, i) => (
            <div key={i} className="bg-surface border border-border rounded-lg p-4 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted font-medium">{s.label}</span>
                <s.icon size={15} className={s.color} />
              </div>
              <div className="text-2xl font-bold font-mono text-primary mt-2">{loading ? '...' : s.value}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="bg-surface border border-border rounded-lg p-3 shadow-xs">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                className="w-full pl-9 pr-3 py-1.5 bg-surface border border-border rounded-md text-xs text-primary outline-none focus:border-border-strong transition-all shadow-xs placeholder:text-muted"
                placeholder="Search contacts by name, email, or company..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
              />
            </div>
            <button 
              onClick={loadContacts} 
              className="p-1.5 bg-surface border border-border rounded-md text-secondary hover:text-primary hover:bg-secondary transition-all shadow-xs cursor-pointer"
              title="Refresh contacts"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-surface border border-border rounded-lg shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  {['Contact', 'Company', 'Contact Info', 'Source', 'Status', 'Interactions', 'Added', ''].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-left font-semibold text-secondary">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-muted">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-secondary mb-1" />
                    <span>Loading registry...</span>
                  </td></tr>
                ) : contacts.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-muted">
                    No contacts found. <button onClick={() => setShowAddModal(true)} className="text-primary font-medium hover:underline ml-1">Add a new record →</button>
                  </td></tr>
                ) : contacts.map((c) => {
                  const SrcIcon = SOURCE_ICONS[c.source] || Globe
                  return (
                    <tr key={c.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 bg-secondary border border-border rounded-md flex items-center justify-center text-xs font-bold font-mono text-primary shrink-0">
                            {c.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <div className="font-semibold text-primary">{c.name}</div>
                            {c.title && <div className="text-[11px] text-muted">{c.title}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {c.company ? (
                          <div className="flex items-center gap-1.5 text-secondary">
                            <Building2 size={12} className="text-muted" /> {c.company}
                          </div>
                        ) : <span className="text-muted font-mono">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          {c.email && <div className="flex items-center gap-1 text-secondary"><Mail size={11} className="text-muted" />{c.email}</div>}
                          {c.phone && <div className="flex items-center gap-1 text-secondary"><Phone size={11} className="text-muted" />{c.phone}</div>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-muted capitalize">
                          <SrcIcon size={12} className="text-muted" />
                          <span>{c.source}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border capitalize ${STATUS_COLORS[c.status] || STATUS_COLORS.lead}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted font-mono">{c.interaction_count || 0}</td>
                      <td className="px-4 py-3 text-muted font-mono">
                        {new Date(c.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 relative" onClick={e => e.stopPropagation()}>
                        <button 
                          onClick={() => setActionMenuId(actionMenuId === c.id ? null : c.id)}
                          className="p-1 text-muted hover:text-primary transition-colors rounded hover:bg-secondary cursor-pointer"
                        >
                          <MoreHorizontal size={14} />
                        </button>
                        {actionMenuId === c.id && (
                          <div className="absolute right-4 top-8 z-10 bg-surface border border-border rounded-md shadow-lg overflow-hidden min-w-[130px]">
                            <button 
                              onClick={() => openEdit(c)} 
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-secondary hover:text-primary hover:bg-secondary transition-all cursor-pointer"
                            >
                              <Edit3 size={12} /> Edit Details
                            </button>
                            <button 
                              onClick={() => handleDelete(c.id)} 
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 transition-all cursor-pointer"
                            >
                              <X size={12} /> Archive
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="border-t border-border px-4 py-3 flex items-center justify-between bg-surface">
              <div className="text-xs text-muted font-mono">
                {total} total records · Page {page} of {totalPages}
              </div>
              <div className="flex items-center gap-1.5">
                <button 
                  disabled={page <= 1} 
                  onClick={() => setPage(p => p - 1)}
                  className="p-1.5 bg-surface border border-border rounded-md text-secondary disabled:opacity-30 hover:text-primary hover:bg-secondary transition-all cursor-pointer shadow-xs"
                >
                  <ChevronLeft size={13} />
                </button>
                <button 
                  disabled={page >= totalPages} 
                  onClick={() => setPage(p => p + 1)}
                  className="p-1.5 bg-surface border border-border rounded-md text-secondary disabled:opacity-30 hover:text-primary hover:bg-secondary transition-all cursor-pointer shadow-xs"
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Modals */}
      {showAddModal && <ModalContent onSubmit={handleCreate} title="Add Contact Record" />}
      {editContact && <ModalContent onSubmit={handleUpdate} title="Edit Contact Record" />}
    </div>
  )
}
