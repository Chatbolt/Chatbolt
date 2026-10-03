'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getSession, api, OPEN_SOURCE_DEFAULT_SESSION } from '@/lib/api'
import Link from 'next/link'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import { 
  Clock, Bot, Menu, X,
  FolderOpen, Search, Bell, Settings, FolderPlus,
  Sliders, Database, Laptop, ChevronDown, PanelLeft, LayoutList, Plus, Zap,
  SquarePen, Target, LayoutGrid, Library, ShieldCheck, XCircle, AlertCircle,
  Loader2, Check, Sun, Moon, Activity, Brain, Sparkles
} from 'lucide-react'
import SettingsModal from '@/components/dashboard/SettingsModal'
import PersonalAgentDrawer from '@/components/dashboard/PersonalAgentDrawer'
import PersonalAgentOnboardingModal from '@/components/dashboard/PersonalAgentOnboardingModal'
import BackgroundDigestModal from '@/components/dashboard/BackgroundDigestModal'

type MenuItem = {
  name: string
  href: string
  icon: any
  isPrimary?: boolean
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </ToastProvider>
  )
}

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { success: toastSuccess, info: toastInfo, error: toastError } = useToast()
  
  const [isDark, setIsDark] = useState(false)
  const [session, setSession] = useState<any>(null)
  const [isAuthChecking, setIsAuthChecking] = useState(true)
  const [activeRuns, setActiveRuns] = useState<any[]>([])
  const [showTerminalBadge, setShowTerminalBadge] = useState(false)
  const [lastCompletedCount, setLastCompletedCount] = useState<number | null>(null)
  const [hasConnectedIntegrations, setHasConnectedIntegrations] = useState(true)

  // Initialize and persist theme (A & B Combination)
  useEffect(() => {
    const saved = localStorage.getItem('chatbolt-theme')
    if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setIsDark(true)
      document.documentElement.classList.add('dark')
    } else {
      setIsDark(false)
      document.documentElement.classList.remove('dark')
    }
  }, [])

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('chatbolt-theme', 'light')
      setIsDark(false)
      toastInfo('Mode Switched', 'Active Surface: Direction B (Light Architectural Paper)')
    } else {
      document.documentElement.classList.add('dark')
      localStorage.setItem('chatbolt-theme', 'dark')
      setIsDark(true)
      toastInfo('Mode Switched', 'Active Surface: Direction A (Refined Dark Mineral Console)')
    }
  }

  // Interactive states
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false)
  const [selectedModel, setSelectedModel] = useState('Chatbolt 1.6 Lite')
  
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState([
    { id: 'n1', text: 'FinOps Cost Optimization Complete', time: '2m ago', active: true },
    { id: 'n2', text: 'Web Crawler scraped 12 accounts', time: '1h ago', active: true },
    { id: 'n3', text: 'Personalization memory auto-synced', time: '3h ago', active: false }
  ])

  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [showCreateProjModal, setShowCreateProjModal] = useState(false)
  const [newProjName, setNewProjName] = useState('')
  const [newProjDesc, setNewProjDesc] = useState('')
  
  // Personal Assistant State
  const [personalAgent, setPersonalAgent] = useState<any>(null)
  const [memoriesCount, setMemoriesCount] = useState(0)
  const [isPersonalAgentDrawerOpen, setIsPersonalAgentDrawerOpen] = useState(false)
  const [isPersonalAgentOnboardingOpen, setIsPersonalAgentOnboardingOpen] = useState(false)
  const [isDigestModalOpen, setIsDigestModalOpen] = useState(false)

  // Search Overlay
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    setIsAuthChecking(true)
    getSession().then(s => {
      setSession(s || OPEN_SOURCE_DEFAULT_SESSION)
      setIsAuthChecking(false)
    }).catch(() => {
      setSession(OPEN_SOURCE_DEFAULT_SESSION)
      setIsAuthChecking(false)
    })
  }, [])

  // Load persistent personal agent identity & memory count
  useEffect(() => {
    async function loadPersonalAgent() {
      try {
        const res = await api.personalAgent.getProfile()
        if (res.success && res.agent) {
          setPersonalAgent(res.agent)
          setMemoriesCount(res.memoriesCount || 0)
        }
      } catch (err) {
        console.warn('Failed to load personal assistant profile:', err)
      }
    }
    loadPersonalAgent()
  }, [])

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        if (pathname === '/dashboard/terminal') return
        e.preventDefault()
        setShowSearchModal(prev => !prev)
        setIsNotificationsOpen(false)
        setIsModelDropdownOpen(false)
      }
      if (e.key === 'Escape') {
        setShowSearchModal(false)
        setIsNotificationsOpen(false)
        setIsModelDropdownOpen(false)
        setShowCreateProjModal(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [pathname])

  // Fetch recent tasks dynamically to show in sidebar under "All tasks"
  useEffect(() => {
    async function loadRecentTasks() {
      try {
        const res = await api.workflows.listRuns({ limit: 10 })
        const runs = res.runs || []
        setActiveRuns(runs.slice(0, 4))

        const completedRuns = runs.filter((r: any) => 
          r.status === 'completed' || r.status === 'COMPLETED' || r.status === 'failed' || r.status === 'FAILED'
        )
        const currentCompletedCount = completedRuns.length

        if (pathname !== '/dashboard/terminal') {
          if (lastCompletedCount !== null && currentCompletedCount > lastCompletedCount) {
            setShowTerminalBadge(true)
          }
        }
        setLastCompletedCount(currentCompletedCount)
      } catch (err) {
        console.warn('Failed to load recent runs for sidebar:', err)
      }
    }
    if (session) {
      loadRecentTasks()
      const interval = setInterval(loadRecentTasks, 15000)
      return () => clearInterval(interval)
    }
  }, [session, pathname, lastCompletedCount])

  // Clear badge when actively viewing terminal
  useEffect(() => {
    if (pathname === '/dashboard/terminal') {
      setShowTerminalBadge(false)
    }
  }, [pathname])

  // BroadcastChannel for cross-tab events
  useEffect(() => {
    if (typeof window === 'undefined') return
    const bc = new BroadcastChannel('chatbolt-tasks')
    const handleMessage = (e: MessageEvent) => {
      if (e.data.type === 'task:completed' || e.data.type === 'task:failed') {
        if (pathname !== '/dashboard/terminal') {
          setShowTerminalBadge(true)
        }
      }
    }
    bc.addEventListener('message', handleMessage)
    return () => {
      bc.removeEventListener('message', handleMessage)
      bc.close()
    }
  }, [pathname])

  // Poll integrations
  useEffect(() => {
    async function checkIntegrations() {
      try {
        const res = await api.integrations.list()
        const list = res.integrations || []
        const hasConnected = list.some((item: any) => item.connected === true)
        setHasConnectedIntegrations(hasConnected)
      } catch (err) {
        console.warn('Failed to check integration status:', err)
      }
    }
    if (session) {
      checkIntegrations()
      const interval = setInterval(checkIntegrations, 20000)
      return () => clearInterval(interval)
    }
  }, [session])

  const [billingUsage, setBillingUsage] = useState<any>(null)

  useEffect(() => {
    async function checkBillingUsage() {
      try {
        const usage = await api.billing.usage()
        setBillingUsage(usage)
      } catch (err) {
        console.warn('Failed to load billing usage for layout:', err)
      }
    }
    if (session) {
      checkBillingUsage()
      const interval = setInterval(checkBillingUsage, 30000)
      return () => clearInterval(interval)
    }
  }, [session])

  if (isAuthChecking || !session) return (
    <div className="h-screen w-full flex bg-background text-primary antialiased overflow-hidden font-sans select-none animate-pulse">
      <aside className="w-[68px] md:w-64 border-r border-border bg-surface flex flex-col justify-between p-4 space-y-4">
        <div className="space-y-4">
          <div className="h-8 bg-surface-subtle rounded-md w-32" />
          <div className="space-y-2">
            <div className="h-9 bg-surface-subtle rounded-md" />
            <div className="h-9 bg-surface-subtle rounded-md" />
            <div className="h-9 bg-surface-subtle rounded-md" />
          </div>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-surface flex items-center justify-between px-6">
          <div className="h-6 bg-surface-subtle rounded-md w-40" />
          <div className="h-7 bg-surface-subtle rounded-full w-7" />
        </header>
        <div className="flex-1 p-6 space-y-4 bg-background">
          <div className="h-8 bg-surface-subtle rounded-md w-[30%]" />
          <div className="h-32 bg-surface rounded-md border border-border" />
          <div className="h-64 bg-surface rounded-md border border-border" />
        </div>
      </div>
    </div>
  )

  const userEmail = session.tenant?.email || session.user?.email || 'user@chatbolt.io'

  const menuItems: MenuItem[] = [
    { name: 'Personal Assistant', href: '/dashboard/assistant', icon: Sparkles },
    { name: 'New task', href: '/dashboard/terminal', icon: SquarePen, isPrimary: true },
    { name: 'Agents', href: '/dashboard/agents', icon: Bot },
    { name: 'Observability', href: '/dashboard/observability', icon: Activity },
    { name: 'Memory', href: '/dashboard/memory', icon: Brain },
    { name: 'Plugins', href: '/dashboard/plugins', icon: LayoutGrid },
    { name: 'Scheduled', href: '/dashboard/scheduled', icon: Clock },
    { name: 'Library', href: '/dashboard/workspace', icon: Library },
  ]

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const wsRes = await api.workspaces.list()
      const wsList = wsRes.workspaces || []
      if (wsList.length === 0) throw new Error('No active workspace context found.')
      
      await api.workspaces.createProject(wsList[0].id, {
        name: newProjName,
        description: newProjDesc,
        status: 'active'
      })
      toastSuccess('Project Created', `Created workspace project: "${newProjName}"`)
      setShowCreateProjModal(false)
      setNewProjName('')
      setNewProjDesc('')
      
      if (pathname === '/dashboard/workspace') {
        window.location.reload()
      } else {
        router.push('/dashboard/workspace')
      }
    } catch (err: any) {
      toastError('Creation Failed', err.message || 'Failed to create workspace project.')
    }
  }

  const handleSelectModel = (modelName: string) => {
    setSelectedModel(modelName)
    setIsModelDropdownOpen(false)
    toastSuccess('Engine Calibrated', `Active LLM gateway routed to: ${modelName}`)
  }

  const handleClearNotifications = () => {
    setNotifications([])
    toastInfo('Inbox Wiped', 'System activity alerts cleared.')
  }

  const handleDismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    toastSuccess('Index Search Completed', `Filtered runs for query: "${searchQuery}"`)
    setShowSearchModal(false)
    router.push(`/dashboard/workspace?search=${encodeURIComponent(searchQuery)}`)
    setSearchQuery('')
  }

  const activeNotifCount = notifications.length

  return (
    <div className="flex h-screen bg-background text-primary antialiased overflow-hidden font-sans select-none">

      {/* Mobile Sidebar backdrop */}
      {isMobileSidebarOpen && (
        <div 
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 md:hidden animate-in fade-in duration-200"
        />
      )}

      {/* SIDEBAR */}
      <aside 
        className={`${
          isSidebarCollapsed ? 'md:w-[68px]' : 'md:w-64'
        } w-64 border-r border-border flex flex-col shrink-0 bg-surface justify-between transition-transform duration-300 md:transition-all overflow-x-hidden
        fixed md:relative top-0 bottom-0 left-0 h-full z-40 md:translate-x-0 ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex flex-col min-h-0 flex-1">
          
          {/* Top Logo and Sidebar Toggles */}
          <div className="h-14 flex items-center justify-between px-4 border-b border-border shrink-0 bg-surface">
            <Link href="/dashboard/terminal" className="flex items-center gap-2.5 no-underline group shrink-0">
              <div className="w-7 h-7 bg-action-primary rounded-[6px] flex items-center justify-center text-white shadow-xs">
                <Zap size={14} className="text-white fill-white" />
              </div>
              {!isSidebarCollapsed && (
                <div className="flex flex-col">
                  <span className="text-xs font-bold tracking-tight text-primary">
                    Chatbolt
                  </span>
                  <span className="text-[10px] text-muted font-medium">Ops Console</span>
                </div>
              )}
            </Link>
            
            {!isSidebarCollapsed && (
              <div className="flex items-center gap-1.5 animate-in fade-in duration-300">
                <button 
                  onClick={() => setShowSearchModal(true)}
                  className="flex items-center gap-1 px-1.5 py-1 text-secondary hover:text-primary rounded-[5px] hover:bg-surface-subtle transition-colors cursor-pointer"
                  title="Search (⌘K)"
                >
                  <Search size={13} />
                  <kbd className="text-[9px] font-semibold text-muted bg-surface-subtle border border-border rounded px-1">⌘K</kbd>
                </button>
                <button 
                  onClick={() => setIsSidebarCollapsed(true)}
                  className="p-1 text-secondary hover:text-primary rounded-[5px] hover:bg-surface-subtle transition-colors cursor-pointer"
                  title="Collapse Sidebar"
                >
                  <PanelLeft size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Navigation Menu */}
          <nav className="p-3 space-y-1">
            {menuItems.map(item => {
              const isActive = pathname === item.href
              if (item.isPrimary) {
                const isTerminalItem = item.href === '/dashboard/terminal'
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsMobileSidebarOpen(false)}
                    className={`flex items-center ${
                      isSidebarCollapsed ? 'justify-center p-2' : 'gap-2.5 px-3 py-2'
                    } bg-action-primary hover:bg-action-primary-hover text-white rounded-[6px] text-xs font-semibold transition-all no-underline w-full shadow-xs`}
                    title={isSidebarCollapsed ? item.name : undefined}
                  >
                    <div className="relative flex items-center">
                      <item.icon size={14} className="text-white shrink-0" />
                      {isTerminalItem && showTerminalBadge && isSidebarCollapsed && (
                        <div className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-signal-blue rounded-full animate-pulse" />
                      )}
                    </div>
                    {!isSidebarCollapsed && (
                      <div className="flex items-center justify-between w-full">
                        <span>{item.name}</span>
                        {isTerminalItem && showTerminalBadge && (
                          <div className="w-1.5 h-1.5 bg-signal-blue rounded-full animate-pulse" />
                        )}
                      </div>
                    )}
                  </Link>
                )
              }

              const isPluginsItem = item.name === 'Plugins'
              const showPluginsBadge = isPluginsItem && !hasConnectedIntegrations

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsMobileSidebarOpen(false)}
                  className={`group flex items-center ${
                    isSidebarCollapsed ? 'justify-center p-2' : 'gap-2.5 px-3 py-2'
                  } rounded-[6px] text-xs font-medium transition-all no-underline ${
                    isActive
                      ? 'text-primary font-semibold bg-surface-subtle border border-border'
                      : 'text-secondary hover:text-primary hover:bg-surface-subtle'
                  }`}
                  title={isSidebarCollapsed ? item.name : undefined}
                >
                  <div className="relative flex items-center shrink-0">
                    <item.icon
                      size={14}
                      className={`${isActive ? 'text-primary' : 'text-secondary group-hover:text-primary'} shrink-0`}
                    />
                    {showPluginsBadge && isSidebarCollapsed && (
                      <div className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                    )}
                  </div>
                  {!isSidebarCollapsed && (
                    <div className="flex items-center justify-between w-full">
                      <span>{item.name}</span>
                      {showPluginsBadge && (
                        <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                      )}
                    </div>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Projects Header & List */}
          <div className="px-3 py-2 space-y-2 flex-1 overflow-y-auto custom-scrollbar border-t border-border-subtle mt-1">
            <div className="flex items-center justify-between min-h-[16px]">
              {!isSidebarCollapsed ? (
                <span className="text-[11px] font-semibold text-secondary">Projects</span>
              ) : (
                <div className="w-full h-[1px] bg-border-subtle my-1" />
              )}
              <button 
                onClick={() => setShowCreateProjModal(true)}
                className="p-1 text-secondary hover:text-primary hover:bg-surface-subtle rounded transition-colors cursor-pointer"
                title="Create Project"
              >
                <Plus size={13} />
              </button>
            </div>

            {/* New project option */}
            {!isSidebarCollapsed ? (
              <button 
                onClick={() => setShowCreateProjModal(true)}
                className="flex items-center gap-2 text-xs font-medium text-secondary hover:text-primary transition-all px-2 py-1.5 rounded-[5px] hover:bg-surface-subtle w-full text-left bg-transparent border-none outline-none cursor-pointer"
              >
                <FolderPlus size={14} className="text-muted shrink-0" />
                <span>New project</span>
              </button>
            ) : (
              <button 
                onClick={() => setShowCreateProjModal(true)}
                className="flex justify-center p-1.5 text-secondary hover:text-primary w-full bg-transparent border-none outline-none cursor-pointer"
                title="New Project"
              >
                <FolderPlus size={14} />
              </button>
            )}

            {/* All tasks list */}
            {!isSidebarCollapsed && (
              <div className="pt-3 space-y-1.5 border-t border-border-subtle">
                <div className="flex items-center justify-between text-[11px] font-semibold text-secondary">
                  <span>Recent Tasks</span>
                  <button onClick={() => router.push('/dashboard/workspace')} className="text-secondary hover:text-primary cursor-pointer">
                    <LayoutList size={11} />
                  </button>
                </div>
                
                <div className="space-y-0.5 pt-1">
                  {activeRuns.length === 0 ? (
                    <div className="text-[11px] text-muted italic px-2 py-1">No tasks logged.</div>
                  ) : (
                    activeRuns.map(run => {
                      const isDone = ['completed', 'success'].includes((run.status || '').toLowerCase())
                      const isFail = ['failed', 'error'].includes((run.status || '').toLowerCase())
                      return (
                        <Link 
                          key={run.id}
                          href="/dashboard/workspace"
                          className="flex items-center gap-2 text-xs font-medium text-secondary hover:text-primary truncate no-underline py-1 px-2 rounded hover:bg-surface-subtle transition-all"
                        >
                          {isDone ? (
                            <Check size={12} className="text-emerald-600 shrink-0" />
                          ) : isFail ? (
                            <XCircle size={12} className="text-red-600 shrink-0" />
                          ) : (
                            <Loader2 size={12} className="text-sky-600 animate-spin shrink-0" />
                          )}
                          <span className="truncate">{run.workflow_name || 'Autonomous Task'}</span>
                        </Link>
                      )
                    })
                  )}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Bottom Sidebar Profile */}
        <div className="p-3 border-t border-border bg-surface-subtle flex flex-col gap-2.5 shrink-0">
          {!isSidebarCollapsed && (
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2 min-w-0">
                <div 
                  onClick={() => setIsSettingsOpen(true)}
                  className="w-6 h-6 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-[11px] font-bold text-emerald-800 cursor-pointer shrink-0"
                >
                  {userEmail?.substring(0, 1).toUpperCase() || 'A'}
                </div>
                <p className="text-xs font-medium text-primary truncate">{userEmail || 'User'}</p>
              </div>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white border border-border text-secondary">
                {session?.tenant?.plan || 'Free'}
              </span>
            </div>
          )}
          {isSidebarCollapsed && (
            <div 
              onClick={() => setIsSettingsOpen(true)}
              className="w-7 h-7 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-xs font-bold text-emerald-800 cursor-pointer mx-auto"
              title={session?.tenant?.plan || 'Free'}
            >
              {userEmail?.substring(0, 1).toUpperCase() || 'A'}
            </div>
          )}
          <div className={`flex ${isSidebarCollapsed ? 'flex-col gap-2 items-center' : 'items-center justify-between'}`}>
            <div className="flex gap-1">
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-1.5 text-secondary hover:text-primary rounded hover:bg-surface transition-all cursor-pointer"
                title="Personalization settings"
              >
                <Sliders size={13} />
              </button>
              <button 
                onClick={() => router.push('/dashboard/workspace')}
                className="p-1.5 text-secondary hover:text-primary rounded hover:bg-surface transition-all cursor-pointer"
                title="Database library"
              >
                <Database size={13} />
              </button>
              <button 
                onClick={() => router.push('/dashboard/playground')}
                className="p-1.5 text-secondary hover:text-primary rounded hover:bg-surface transition-all cursor-pointer"
                title="Assistant playground"
              >
                <Laptop size={13} />
              </button>
            </div>
          </div>
        </div>

      </aside>

      {/* MAIN BODY PANEL */}
      <main className="flex-1 flex flex-col min-w-0 relative overflow-hidden bg-background">
        
        {/* Top Header Bar */}
        <header className="h-14 shrink-0 border-b border-border bg-surface/95 backdrop-blur-xs flex items-center justify-between px-6 z-20 relative">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-1.5 text-secondary hover:text-primary rounded md:hidden transition-colors cursor-pointer"
              title="Open Sidebar"
            >
              <Menu size={16} />
            </button>
            {isSidebarCollapsed && (
              <button 
                onClick={() => setIsSidebarCollapsed(false)}
                className="p-1.5 text-secondary hover:text-primary rounded hidden md:block transition-colors cursor-pointer"
                title="Expand Sidebar"
              >
                <PanelLeft size={16} />
              </button>
            )}
            
            {/* Model dropdown */}
            <div className="relative">
              <div 
                onClick={() => {
                  setIsModelDropdownOpen(!isModelDropdownOpen)
                  setIsNotificationsOpen(false)
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-border rounded-[6px] text-xs font-semibold text-primary hover:border-slate-400 cursor-pointer transition-all select-none shadow-xs"
              >
                <span>{selectedModel}</span>
                <ChevronDown size={12} className="text-secondary" />
              </div>

              {/* Model Dropdown Menu */}
              {isModelDropdownOpen && (
                <div className="absolute top-full left-0 mt-1.5 w-52 bg-white border border-border rounded-[6px] p-1 shadow-lg flex flex-col gap-0.5 animate-in fade-in duration-100 z-50">
                  {['Chatbolt 1.6 Lite', 'Chatbolt 2.0 Ultra (Pro)', 'Chatbolt Coder Pro'].map(m => (
                    <button
                      key={m}
                      onClick={() => handleSelectModel(m)}
                      className={`w-full text-left px-3 py-1.5 rounded-[4px] text-xs font-medium transition-all cursor-pointer ${
                        selectedModel === m ? 'bg-surface-subtle text-primary font-semibold' : 'text-secondary hover:text-primary hover:bg-surface-subtle'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Center plan text */}
          <div className="hidden md:flex items-center gap-2 text-xs font-medium text-secondary">
            <span>Free plan</span>
            <span className="text-border">|</span>
            <Link href="/dashboard/billing" className="text-sky-700 hover:text-sky-900 font-semibold no-underline">Upgrade</Link>
          </div>

          {/* Top Right user controllers */}
          <div className="flex items-center gap-2.5">
            {/* Always-On Activity Digest Pill */}
            <button
              onClick={() => setIsDigestModalOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 rounded-[6px] text-xs font-semibold text-emerald-600 dark:text-emerald-400 transition-all cursor-pointer shadow-xs"
              title="What is your assistant doing right now / what did it do while you were away"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Always-On</span>
            </button>

            {/* Personal Assistant Companion Pill */}
            <button
              onClick={() => setIsPersonalAgentDrawerOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-surface-subtle hover:bg-surface border border-border rounded-[6px] text-xs font-semibold text-primary transition-all cursor-pointer shadow-xs group"
              title="Open Personal Assistant & Inspectable Memory"
            >
              <span className="text-action-primary text-xs">✨</span>
              <span className="font-bold tracking-tight">{personalAgent?.name || 'Aria'}</span>
              <span className="hidden sm:inline-block px-1.5 py-0.2 rounded text-[9px] font-mono font-normal bg-surface border border-border-subtle text-muted">
                {memoriesCount > 0 ? `${memoriesCount} facts` : 'Companion'}
              </span>
            </button>

            {/* Theme Toggle Button (A & B Combination) */}
            <button
              onClick={toggleTheme}
              className="p-1.5 text-secondary hover:text-primary rounded-[6px] hover:bg-surface-subtle transition-all cursor-pointer"
              title={isDark ? "Switch to Light Mode (Direction B: Architectural Paper)" : "Switch to Dark Console (Direction A: Refined Mineral)"}
            >
              {isDark ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} className="text-secondary" />}
            </button>

            {/* Notification Bell Dropdown */}
            <div className="relative">
              <button 
                onClick={() => {
                  setIsNotificationsOpen(!isNotificationsOpen)
                  setIsModelDropdownOpen(false)
                }}
                className="p-1.5 text-secondary hover:text-primary rounded-[6px] hover:bg-surface-subtle transition-all relative cursor-pointer"
                title="System Notifications"
              >
                <Bell size={16} />
                {activeNotifCount > 0 && (
                  <div className="absolute top-1 right-1 w-2 h-2 bg-sky-600 rounded-full" />
                )}
              </button>

              {/* Notification Center */}
              {isNotificationsOpen && (
                <div className="absolute top-full right-0 mt-1.5 w-76 bg-white border border-border rounded-[6px] p-4 shadow-xl space-y-3 animate-in fade-in duration-100 z-50">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <span className="text-xs font-semibold text-primary">System Alerts</span>
                    {activeNotifCount > 0 && (
                      <button 
                        onClick={handleClearNotifications}
                        className="text-[11px] font-medium text-secondary hover:text-primary bg-transparent border-none outline-none cursor-pointer"
                      >
                        Clear all
                      </button>
                    )}
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar">
                    {notifications.length === 0 ? (
                      <div className="text-xs text-muted italic py-4 text-center">No active alerts.</div>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} className="flex items-start justify-between gap-3 bg-surface-subtle border border-border-subtle p-2.5 rounded-[5px]">
                          <div className="space-y-0.5 min-w-0">
                            <p className="text-xs text-primary font-medium leading-normal">{n.text}</p>
                            <span className="text-[10px] text-muted font-medium">{n.time}</span>
                          </div>
                          <button 
                            onClick={() => handleDismissNotification(n.id)}
                            className="p-0.5 text-muted hover:text-primary bg-transparent border-none outline-none cursor-pointer shrink-0"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Credits pill */}
            <div 
              onClick={() => toastInfo('Credits Limit', 'Account loaded with 300 credits. Renewed monthly.')}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-border rounded-[6px] text-xs font-semibold text-primary hover:border-slate-400 cursor-pointer transition-all shadow-xs"
              title="View Compute Credits"
            >
              <Zap size={12} className="text-amber-600 fill-amber-500" />
              <span className="tabular-nums">300</span>
            </div>

            {/* User avatar */}
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="w-7 h-7 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-xs font-bold text-emerald-800 hover:scale-105 transition-transform cursor-pointer"
              title="User Account settings"
            >
              {userEmail?.substring(0, 1).toUpperCase() || 'A'}
            </button>
          </div>
        </header>

        {/* Warning Banner */}
        {billingUsage?.tasks && billingUsage.tasks.limit > 0 && (pathname === '/dashboard/terminal' || pathname === '/dashboard') && (
          (() => {
            const current = billingUsage.tasks.current
            const limit = billingUsage.tasks.limit
            const percentage = (current / limit) * 100
            if (percentage >= 100) {
              return (
                <div className="bg-red-50 border-b border-red-200 text-red-800 px-4 py-2 text-center text-xs font-semibold flex items-center justify-center gap-2 shrink-0 animate-in slide-in-from-top duration-300">
                  <AlertCircle size={14} className="text-red-600" />
                  <span>You've reached your monthly task limit ({current} of {limit}). Upgrade to Pro to continue.</span>
                  <Link href="/dashboard/settings/billing" className="text-sky-700 hover:underline font-bold ml-1">Upgrade</Link>
                </div>
              )
            }
            if (percentage >= 80) {
              return (
                <div className="bg-amber-50 border-b border-amber-200 text-amber-800 px-4 py-2 text-center text-xs font-semibold flex items-center justify-center gap-2 shrink-0 animate-in slide-in-from-top duration-300">
                  <AlertCircle size={14} className="text-amber-600" />
                  <span>You've used {current} of {limit} free tasks this month.</span>
                  <Link href="/dashboard/settings/billing" className="text-sky-700 hover:underline font-bold ml-1">Upgrade</Link>
                </div>
              )
            }
            return null
          })()
        )}

        {/* Canvas content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar relative bg-background">
          {children}
        </div>

      </main>

      {/* Global Command Palette */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="absolute inset-0" onClick={() => setShowSearchModal(false)} />
          <form
            onSubmit={handleSearchSubmit}
            className="bg-white border border-border rounded-[8px] max-w-lg w-full relative z-10 shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden"
          >
            {/* Search Input */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border bg-surface-subtle">
              <Search size={15} className="text-secondary shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search tasks, agents, files, artifacts…"
                className="flex-1 bg-transparent text-xs text-primary outline-none placeholder-muted font-medium"
                autoFocus
              />
              <kbd className="px-1.5 py-0.5 text-[10px] font-semibold bg-white border border-border rounded text-muted">ESC</kbd>
            </div>

            {/* Quick Navigation */}
            <div className="p-2 space-y-0.5">
              <div className="text-[11px] font-semibold text-secondary px-3 py-1">Quick Navigate</div>
              {[
                { label: 'New Task', sub: 'Open terminal', href: '/dashboard/terminal', icon: SquarePen },
                { label: 'Outcomes', sub: 'View task history', href: '/dashboard/outcomes', icon: Target },
                { label: 'Agents', sub: 'Manage agents', href: '/dashboard/agents', icon: Bot },
                { label: 'Plugins', sub: 'Browse integrations', href: '/dashboard/plugins', icon: LayoutGrid },
                { label: 'Scheduled', sub: 'Cron & triggers', href: '/dashboard/scheduled', icon: Clock },
                { label: 'Library', sub: 'Files & workspace', href: '/dashboard/workspace', icon: Library },
              ].map(item => (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => { router.push(item.href); setShowSearchModal(false) }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-[5px] hover:bg-surface-subtle transition-all text-left group cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-[5px] bg-surface-subtle border border-border flex items-center justify-center shrink-0">
                    <item.icon size={13} className="text-secondary group-hover:text-primary transition-colors" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-primary">{item.label}</p>
                    <p className="text-[11px] text-muted">{item.sub}</p>
                  </div>
                  <ChevronDown size={12} className="text-muted ml-auto -rotate-90 group-hover:text-primary transition-colors" />
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="border-t border-border px-4 py-2.5 flex items-center justify-between bg-surface-subtle">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-[11px] text-muted">
                  <kbd className="px-1.5 py-0.5 bg-white border border-border rounded font-semibold">↵</kbd>
                  <span>search</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-muted">
                  <kbd className="px-1.5 py-0.5 bg-white border border-border rounded font-semibold">esc</kbd>
                  <span>close</span>
                </div>
              </div>
              <button
                type="submit"
                className="px-3 py-1.5 bg-action-primary text-white rounded-[5px] text-xs font-semibold hover:bg-action-primary-hover transition-colors cursor-pointer"
              >
                Search Records
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: CREATE PROJECT */}
      {showCreateProjModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="absolute inset-0" onClick={() => setShowCreateProjModal(false)} />
          <form onSubmit={handleCreateProject} className="bg-white border border-border rounded-[8px] max-w-md w-full p-6 relative z-10 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-xs font-bold text-primary">Create Workspace Project</span>
              <button type="button" onClick={() => setShowCreateProjModal(false)} className="text-secondary hover:text-primary transition-colors bg-transparent border-none outline-none cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-primary">Project Name</label>
                <input 
                  type="text" 
                  value={newProjName}
                  onChange={e => setNewProjName(e.target.value)}
                  placeholder="Competitor Research Q3..."
                  className="w-full bg-white border border-border rounded-[6px] px-3 py-2 text-xs text-primary outline-none focus:border-sky-600 placeholder-muted"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-primary">Description</label>
                <textarea 
                  value={newProjDesc}
                  onChange={e => setNewProjDesc(e.target.value)}
                  placeholder="Track competitors and generate enrichment models..."
                  className="w-full h-20 bg-white border border-border rounded-[6px] px-3 py-2 text-xs text-primary outline-none focus:border-sky-600 placeholder-muted resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button type="button" onClick={() => setShowCreateProjModal(false)} className="px-3.5 py-1.5 bg-surface-subtle border border-border rounded-[6px] text-xs font-semibold text-secondary hover:text-primary cursor-pointer">
                Cancel
              </button>
              <button type="submit" className="px-3.5 py-1.5 bg-action-primary text-white rounded-[6px] text-xs font-semibold hover:bg-action-primary-hover cursor-pointer">
                Create Project
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Settings Personalization Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        userEmail={userEmail}
      />

      {/* Personal Assistant Companion Drawer */}
      <PersonalAgentDrawer
        isOpen={isPersonalAgentDrawerOpen}
        onClose={() => setIsPersonalAgentDrawerOpen(false)}
        onOpenOnboarding={() => {
          setIsPersonalAgentDrawerOpen(false)
          setIsPersonalAgentOnboardingOpen(true)
        }}
        agent={personalAgent}
        onAgentUpdated={agent => {
          setPersonalAgent(agent)
          api.personalAgent.getMemories().then(r => setMemoriesCount(r.total || 0)).catch(() => {})
        }}
      />

      {/* Personal Assistant Onboarding Modal */}
      <PersonalAgentOnboardingModal
        isOpen={isPersonalAgentOnboardingOpen}
        onClose={() => setIsPersonalAgentOnboardingOpen(false)}
        initialName={personalAgent?.name || 'Aria'}
        onCompleted={agent => {
          setPersonalAgent(agent)
          api.personalAgent.getMemories().then(r => setMemoriesCount(r.total || 0)).catch(() => {})
        }}
      />

      {/* Always-On Activity & Executive Digest Modal */}
      <BackgroundDigestModal
        isOpen={isDigestModalOpen}
        onClose={() => setIsDigestModalOpen(false)}
        agentName={personalAgent?.name || 'Aria'}
      />
    </div>
  )
}
