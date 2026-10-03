'use client'

import { useEffect, useState } from 'react'
import { api, getSession, saveSession } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { 
  Bell, 
  Mail, 
  Clock, 
  Save, 
  Settings, 
  ShieldCheck, 
  Inbox,
  AlertCircle
} from 'lucide-react'

type PreferenceType = 'in_app' | 'email_immediate' | 'email_digest'

export default function PreferencesPage() {
  const { success: toastSuccess, error: toastError } = useToast()
  const [tenant, setTenant] = useState<any>(null)
  const [pref, setPref] = useState<PreferenceType>('in_app')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getSession().then(s => {
      if (s?.tenant) {
        setTenant(s.tenant)
        setPref((s.tenant.notification_preferences as PreferenceType) || 'in_app')
      }
    })
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!tenant) return

    setSaving(true)
    try {
      const updatedProfile = await api.auth.updateProfile({
        name: tenant.name,
        user_details: tenant.user_details,
        user_purpose: tenant.user_purpose,
        notification_preferences: pref
      })

      setTenant(updatedProfile.tenant)
      saveSession('', updatedProfile.tenant)
      toastSuccess('Notification preferences saved successfully')
      window.dispatchEvent(new Event('storage'))
    } catch (err: any) {
      toastError('Failed to save preferences', err.message || 'An error occurred.')
    } finally {
      setSaving(false)
    }
  }

  const options = [
    {
      id: 'in_app' as PreferenceType,
      title: 'In-app toasts only',
      desc: 'Show in-app notification toasts in the terminal console when tasks finish.',
      icon: Bell,
      badge: 'Default'
    },
    {
      id: 'email_immediate' as PreferenceType,
      title: 'Immediate email on long runs',
      desc: 'Send an email notification for background processes running longer than 2 minutes.',
      icon: Mail,
      badge: 'Real-time'
    },
    {
      id: 'email_digest' as PreferenceType,
      title: 'Daily digest at 6:00 PM',
      desc: 'Receive a consolidated summary email of all executed tasks and agent outcomes.',
      icon: Clock,
      badge: 'Daily'
    }
  ]

  return (
    <div className="flex flex-col h-full bg-background text-primary font-sans">
      {/* Sub-header Navigation */}
      <div className="h-14 border-b border-border bg-surface flex items-center justify-between px-6 shrink-0 shadow-xs">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-xs font-semibold text-primary">
            <Settings size={14} className="text-secondary" /> Personal Preferences
          </div>
          <div className="h-4 w-px bg-border" />
          <span className="text-xs font-medium text-primary border-b-2 border-primary pb-3.5 mt-3.5">
            Notifications & Alerts
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
          
          <div className="space-y-1 border-b border-border pb-6">
            <span className="text-xs font-mono font-medium text-muted uppercase tracking-wider">Alert Routing</span>
            <h1 className="text-2xl font-bold tracking-tight text-primary mt-1">Notification Preferences</h1>
            <p className="text-xs text-secondary mt-1">
              Configure how and when Chatbolt notifies you about task events, long-running processes, and daily summaries.
            </p>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            <div className="bg-surface border border-border p-6 rounded-lg shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-primary">Delivery Channels</h3>
                  <p className="text-xs text-muted">Select your primary alert frequency</p>
                </div>
                <Inbox size={16} className="text-secondary" />
              </div>

              <div className="grid grid-cols-1 gap-3">
                {options.map((opt) => {
                  const Icon = opt.icon
                  const isSelected = pref === opt.id
                  return (
                    <label
                      key={opt.id}
                      onClick={() => setPref(opt.id)}
                      className={`relative flex items-start gap-3.5 p-4 rounded-lg border transition-all cursor-pointer ${
                        isSelected 
                          ? 'bg-surface border-border-strong ring-1 ring-border-strong shadow-xs' 
                          : 'bg-surface border-border hover:bg-secondary/40'
                      }`}
                    >
                      <div className="flex items-center h-5 mt-0.5">
                        <input
                          type="radio"
                          name="notification_pref"
                          checked={isSelected}
                          onChange={() => setPref(opt.id)}
                          className="sr-only"
                        />
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                          isSelected ? 'border-primary' : 'border-border'
                        }`}>
                          {isSelected && (
                            <div className="w-2 h-2 rounded-full bg-primary" />
                          )}
                        </div>
                      </div>

                      <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 border ${
                        isSelected 
                          ? 'bg-secondary border-border text-primary' 
                          : 'bg-surface border-border/60 text-muted'
                      }`}>
                        <Icon size={15} />
                      </div>

                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-primary">{opt.title}</span>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                            isSelected 
                              ? 'bg-sky-50 text-sky-800 border-sky-200' 
                              : 'bg-gray-100 text-gray-700 border-gray-200'
                          }`}>
                            {opt.badge}
                          </span>
                        </div>
                        <p className="text-xs text-secondary leading-relaxed mt-0.5">
                          {opt.desc}
                        </p>
                      </div>
                    </label>
                  )
                })}
              </div>

              {pref === 'email_digest' && (
                <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-md">
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 leading-normal">
                    Daily digest email requires configured SMTP settings. Ensure SMTP is verified under System Settings.
                  </p>
                </div>
              )}

              <div className="p-3.5 bg-secondary/40 border border-border rounded-md flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-primary">Target Delivery Email</div>
                  <div className="text-xs text-muted font-mono mt-0.5">
                    {tenant?.email || 'Loading organization address...'}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button 
                  className="flex items-center gap-1.5 px-4 py-2 bg-action-primary text-action-primary-text hover:bg-action-primary-hover rounded-md shadow-xs transition-all text-xs font-medium cursor-pointer disabled:opacity-50" 
                  type="submit" 
                  disabled={saving || !tenant}
                >
                  {saving ? 'Saving...' : <><Save size={13} /> Save Preferences</>}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
