'use client'

import React, { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import {
  CreditCard,
  ArrowUpRight,
  Zap,
  RefreshCw,
  CheckCircle2,
  Sparkles,
  Check,
  ToggleLeft,
  ToggleRight,
  Shield,
  Key,
  Lock,
  ExternalLink
} from 'lucide-react'

export default function BillingSettingsPage() {
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast()
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly')
  
  const [subData, setSubData] = useState<any>(null)
  const [usageData, setUsageData] = useState<any>(null)
  const [entitlementsData, setEntitlementsData] = useState<any>(null)
  const [overageEnabled, setOverageEnabled] = useState(false)
  const [showNudge, setShowNudge] = useState(false)
  
  // Digital license activation modal state
  const [licenseInput, setLicenseInput] = useState('')
  const [showLicenseModal, setShowLicenseModal] = useState(false)
  const [licenseActivating, setLicenseActivating] = useState(false)

  const loadBillingInfo = async () => {
    setLoading(true)
    try {
      const [sub, usage, ent, nudgeRes] = await Promise.all([
        api.billing.subscription().catch(() => null),
        api.billing.usage().catch(() => null),
        api.billing.entitlements().catch(() => null),
        api.billing.checkAnnualNudge().catch(() => ({ eligible: false }))
      ])

      setSubData(sub)
      setOverageEnabled(sub?.subscription?.overage_enabled || false)
      setUsageData(usage)
      setEntitlementsData(ent)
      setShowNudge(nudgeRes?.eligible || false)
    } catch (err: any) {
      toastError('Failed to load billing information', err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBillingInfo()
  }, [])

  const handleManageSubscription = async () => {
    setActionLoading(true)
    try {
      const res = await api.billing.portal()
      if (res && res.url) {
        window.location.href = res.url
      } else {
        toastError('Failed to redirect', 'Stripe portal url not returned.')
      }
    } catch (err: any) {
      toastError('Error opening Stripe billing portal', err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleUpgrade = async (plan: string) => {
    setActionLoading(true)
    try {
      const res = await api.billing.checkout(plan, billingInterval)
      if (res && res.url) {
        window.location.href = res.url
      } else {
        toastError('Checkout error', 'Stripe checkout url not returned.')
      }
    } catch (err: any) {
      toastError('Failed to create checkout session', err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleToggleOverage = async () => {
    setActionLoading(true)
    try {
      const targetState = !overageEnabled
      const res = await api.billing.toggleOverage(targetState)
      setOverageEnabled(res.overage_enabled)
      toastSuccess('Overage Settings Updated', `Pay-as-you-go overages are now ${res.overage_enabled ? 'enabled' : 'disabled'}.`)
    } catch (err: any) {
      toastError('Failed to update overage settings', err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleDismissNudge = async () => {
    try {
      await api.billing.dismissAnnualNudge()
      setShowNudge(false)
      toastInfo('Nudge Dismissed', 'You can upgrade to an annual plan anytime.')
    } catch (err: any) {
      toastError('Failed to dismiss nudge', err.message)
    }
  }

  const handleActivateDigitalLicense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!licenseInput.trim()) return

    setLicenseActivating(true)
    try {
      const res = await api.billing.activateLicense(licenseInput.trim())
      toastSuccess('Enterprise License Activated', res.message || 'Enterprise capabilities unlocked.')
      setShowLicenseModal(false)
      setLicenseInput('')
      await loadBillingInfo()
    } catch (err: any) {
      toastError('License Activation Failed', err.message)
    } finally {
      setLicenseActivating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 p-8 bg-background text-primary flex flex-col items-center justify-center min-h-[500px]">
        <div className="animate-spin text-secondary mb-3">
          <RefreshCw size={24} />
        </div>
        <p className="text-xs text-muted font-mono">Verifying server-side entitlements & billing state...</p>
      </div>
    )
  }

  const planName = (entitlementsData?.plan || subData?.plan || 'free').toUpperCase()
  const tasksUsed = usageData?.tasks?.current || 0
  const tasksLimit = usageData?.tasks?.limit || 20
  const isFree = planName === 'FREE' || planName === 'NONE'
  const isEnterprise = planName === 'ENTERPRISE' || entitlementsData?.isEnterpriseLicensed
  const nextBilling = subData?.subscription?.current_period_end 
    ? new Date(subData.subscription.current_period_end).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : (isEnterprise && entitlementsData?.source === 'digital_key' ? 'Perpetual / Commercial Key' : 'N/A')

  const taskPercent = tasksLimit > 0 ? Math.min(100, Math.round((tasksUsed / tasksLimit) * 100)) : 0

  const tiers = [
    {
      id: 'free',
      name: 'Free',
      priceMonthly: 0,
      priceAnnual: 0,
      description: 'Test autonomous agent workflows with standard tools.',
      features: [
        '20 tasks / month',
        '2 connected integrations',
        '1 team seat',
        '2 active automations',
        'Concurrency limit: 3 agents',
        'Community support'
      ],
      current: planName === 'FREE'
    },
    {
      id: 'pro',
      name: 'Pro',
      priceMonthly: 29,
      priceAnnual: 290,
      description: 'For teams automating high-value recurring business operations.',
      features: [
        '500 tasks / month',
        'Unlimited standard integrations',
        '1 team seat',
        '20 active automations',
        'Concurrency limit: 8 agents',
        'ReAct reasoning engine access',
        'Pay-as-you-go task overages'
      ],
      highlight: true,
      current: planName === 'PRO'
    },
    {
      id: 'team',
      name: 'Team',
      priceMonthly: 99,
      priceAnnual: 990,
      description: 'Collaborative autonomous squads with TeamLead coordination.',
      features: [
        '2,000 tasks / month',
        'Unlimited integrations',
        '10 team seats',
        'Unlimited automations',
        'Concurrency limit: 20 agents',
        'Multi-agent Squads (Mktg/Tech/Ops)',
        'Team-scoped Shared Memory',
        'Human-in-the-loop intervention'
      ],
      current: planName === 'TEAM'
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      priceMonthly: 499,
      priceAnnual: 4990,
      description: 'Full organizational orchestration, custom SLAs, and governance.',
      features: [
        'Unlimited tasks & automations',
        'Unlimited team seats',
        'Concurrency limit: 50+ agents',
        'Cross-Team Company DAGs',
        'Automated 5-Whys Post-Mortems',
        '4-Tier Autonomy Matrix Gate',
        'SOC2 / HIPAA / GDPR audit export',
        'Bring-your-own LLM keys & models',
        'Air-gapped digital license option'
      ],
      badge: 'Commercial',
      current: planName === 'ENTERPRISE'
    }
  ]

  return (
    <div className="flex-1 p-6 bg-background text-primary overflow-y-auto space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border pb-6 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
              Stripe Verified Billing
            </span>
            <span className="text-xs text-muted font-mono">Server Gated</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Billing & Entitlements</h1>
          <p className="text-xs text-secondary mt-1">Manage subscription tiers, seats, quotas, and enterprise licenses.</p>
        </div>
        
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowLicenseModal(true)}
            className="px-3 py-2 bg-surface hover:bg-secondary border border-border text-primary text-xs font-medium rounded-md transition-all flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <Key size={14} className="text-secondary" />
            <span>Enter License Key</span>
          </button>
          
          {subData?.subscription?.stripe_customer_id && (
            <button
              onClick={handleManageSubscription}
              disabled={actionLoading}
              className="px-3.5 py-2 bg-action-primary hover:bg-action-primary-hover text-action-primary-text text-xs font-medium rounded-md transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <CreditCard size={14} />
              <span>Stripe Portal</span>
              <ExternalLink size={12} />
            </button>
          )}

          <button
            onClick={loadBillingInfo}
            className="p-2 text-secondary hover:text-primary rounded-md bg-surface border border-border hover:bg-secondary transition-all shadow-xs cursor-pointer"
            title="Refresh billing status"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Annual Nudge Banner */}
      {showNudge && (
        <div className="p-4 rounded-lg bg-surface border border-emerald-300 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold">
              <Sparkles size={14} />
              <span>Annual Switch Discount Available</span>
            </div>
            <h3 className="text-sm font-bold text-primary">Save 20% on Annual Pro</h3>
            <p className="text-xs text-secondary">Lock in your autonomous workflow capacity and save $58 every year with annual billing.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleDismissNudge}
              className="px-3 py-1.5 bg-surface hover:bg-secondary text-secondary text-xs font-medium rounded-md border border-border transition-all cursor-pointer"
            >
              Dismiss
            </button>
            <button
              onClick={() => handleUpgrade('pro')}
              disabled={actionLoading}
              className="px-3 py-1.5 bg-action-primary text-action-primary-text hover:bg-action-primary-hover text-xs font-medium rounded-md flex items-center gap-1 shadow-xs cursor-pointer"
            >
              Switch to Annual <ArrowUpRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Overview Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Current Plan Card */}
        <div className="bg-surface border border-border rounded-lg p-5 flex flex-col justify-between space-y-4 shadow-xs">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted">Active Subscription</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                isEnterprise 
                  ? 'bg-indigo-50 text-indigo-800 border border-indigo-200' 
                  : planName === 'TEAM' 
                  ? 'bg-sky-50 text-sky-800 border border-sky-200'
                  : planName === 'PRO'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-gray-100 text-gray-700 border border-gray-200'
              }`}>
                {planName}
              </span>
            </div>
            
            <div className="text-xl font-bold text-primary">
              {planName === 'ENTERPRISE' ? 'Simulated Company Enterprise' : planName === 'TEAM' ? 'Team Workforce Squad' : planName === 'PRO' ? 'Professional Automation' : 'Free Sandbox Tier'}
            </div>
            
            <p className="text-xs text-secondary">
              Source: <strong className="text-primary capitalize">{entitlementsData?.source?.replace('_', ' ') || 'Default'}</strong>
            </p>
          </div>

          <div className="space-y-2 pt-3 border-t border-border">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">Subscription Status</span>
              <span className="text-emerald-700 font-semibold capitalize flex items-center gap-1">
                <CheckCircle2 size={12} />
                {subData?.subscription?.status || 'Active'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">Renewal / Cycle Date</span>
              <span className="text-primary font-mono">{nextBilling}</span>
            </div>
          </div>
        </div>

        {/* Resource Usage Card */}
        <div className="bg-surface border border-border rounded-lg p-5 md:col-span-2 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">Monthly Task Quotas</span>
            <span className="text-xs text-muted font-mono">Auto-resets per billing cycle</span>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-primary flex items-center gap-1.5">
                  <Zap size={14} className="text-secondary" />
                  Tasks Executed This Month
                </span>
                <span className="text-secondary font-mono">
                  {tasksUsed} / {tasksLimit === -1 ? '∞ Unlimited' : tasksLimit}
                </span>
              </div>
              <div className="h-2 bg-gray-100 border border-border rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    taskPercent >= 100 ? 'bg-rose-500' : taskPercent >= 80 ? 'bg-amber-500' : 'bg-emerald-600'
                  }`}
                  style={{ width: `${tasksLimit === -1 ? 0 : taskPercent}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-border">
              <div className="bg-secondary/40 border border-border p-2.5 rounded-md">
                <p className="text-[10px] font-medium text-muted">Integrations</p>
                <p className="text-base font-bold font-mono text-primary mt-0.5">
                  {usageData?.integrations?.current || 0} / {usageData?.integrations?.limit === -1 ? '∞' : (usageData?.integrations?.limit || 2)}
                </p>
              </div>
              <div className="bg-secondary/40 border border-border p-2.5 rounded-md">
                <p className="text-[10px] font-medium text-muted">Team Seats</p>
                <p className="text-base font-bold font-mono text-primary mt-0.5">
                  {usageData?.team_members?.current || 0} / {usageData?.team_members?.limit === -1 ? '∞' : (usageData?.team_members?.limit || 1)}
                </p>
              </div>
              <div className="bg-secondary/40 border border-border p-2.5 rounded-md">
                <p className="text-[10px] font-medium text-muted">Automations</p>
                <p className="text-base font-bold font-mono text-primary mt-0.5">
                  {usageData?.automations?.current || 0} / {usageData?.automations?.limit === -1 ? '∞' : (usageData?.automations?.limit || 2)}
                </p>
              </div>
              <div className="bg-secondary/40 border border-border p-2.5 rounded-md">
                <p className="text-[10px] font-medium text-muted">API Invocations</p>
                <p className="text-base font-bold font-mono text-primary mt-0.5">
                  {usageData?.api_calls?.current || 0} / {usageData?.api_calls?.limit === -1 ? '∞' : (usageData?.api_calls?.limit || 0)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Entitlements */}
      <div className="bg-surface border border-border rounded-lg p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-secondary" />
            <h2 className="text-sm font-semibold text-primary">Server-Side Feature Entitlements</h2>
          </div>
          <span className="text-xs text-muted font-mono">
            Verified {entitlementsData?.verifiedAt ? new Date(entitlementsData.verifiedAt).toLocaleTimeString() : 'Live'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { key: 'company_orchestration', label: 'Cross-Team Company DAGs', tier: 'Enterprise' },
            { key: 'sla_post_mortem', label: '5-Whys Incident Post-Mortems', tier: 'Enterprise' },
            { key: 'team_workforce', label: 'Multi-Agent Teams & TeamLead', tier: 'Team / Ent' },
            { key: 'team_shared_memory', label: 'Team Shared Memory Persistence', tier: 'Team / Ent' },
            { key: 'high_concurrency_pool', label: 'High-Concurrency Agent Pools (20+)', tier: 'Team / Ent' },
            { key: 'soc2_audit_export', label: 'SOC2 & Compliance Audit Export', tier: 'Enterprise' }
          ].map(feat => {
            const isUnlocked = entitlementsData?.features?.[feat.key] || false
            return (
              <div
                key={feat.key}
                className={`p-3 rounded-md border flex items-center justify-between ${
                  isUnlocked
                    ? 'bg-emerald-50/40 border-emerald-200 text-primary'
                    : 'bg-secondary/30 border-border text-muted'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {isUnlocked ? (
                    <CheckCircle2 size={15} className="text-emerald-700 shrink-0" />
                  ) : (
                    <Lock size={15} className="text-muted shrink-0" />
                  )}
                  <div>
                    <div className="text-xs font-semibold text-primary">{feat.label}</div>
                    <div className="text-[10px] text-muted">Requires {feat.tier}</div>
                  </div>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  isUnlocked ? 'bg-emerald-100 text-emerald-800' : 'bg-secondary text-muted border border-border'
                }`}>
                  {isUnlocked ? 'Unlocked' : 'Locked'}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Plan Tiers */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border pb-3 gap-3">
          <div>
            <h2 className="text-sm font-semibold text-primary">Subscription Tiers</h2>
            <p className="text-xs text-muted">Transparent pricing scaled to your automation workload.</p>
          </div>

          {/* Interval Toggle */}
          <div className="flex items-center p-0.5 bg-secondary border border-border rounded-md shadow-xs self-start">
            <button
              onClick={() => setBillingInterval('monthly')}
              className={`px-3 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
                billingInterval === 'monthly'
                  ? 'bg-surface text-primary shadow-xs'
                  : 'text-muted hover:text-primary'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingInterval('annual')}
              className={`px-3 py-1 rounded text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                billingInterval === 'annual'
                  ? 'bg-action-primary text-action-primary-text shadow-xs'
                  : 'text-muted hover:text-primary'
              }`}
            >
              <span>Annual</span>
              <span className="text-[10px] font-semibold opacity-90">-20%</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {tiers.map(tier => {
            const price = billingInterval === 'annual' ? tier.priceAnnual : tier.priceMonthly
            const isCurrent = tier.current

            return (
              <div
                key={tier.id}
                className={`bg-surface border rounded-lg p-5 flex flex-col justify-between transition-all shadow-xs relative ${
                  tier.highlight
                    ? 'border-border-strong ring-1 ring-border-strong'
                    : isCurrent
                    ? 'border-border bg-secondary/20'
                    : 'border-border'
                }`}
              >
                {tier.highlight && (
                  <div className="absolute top-0 right-0 px-2 py-0.5 bg-action-primary text-action-primary-text text-[10px] font-medium rounded-bl-md shadow-xs">
                    Recommended
                  </div>
                )}
                {tier.badge && (
                  <div className="absolute top-0 right-0 px-2 py-0.5 bg-indigo-700 text-white text-[10px] font-medium rounded-bl-md">
                    {tier.badge}
                  </div>
                )}

                <div className="space-y-4 flex-1">
                  <div>
                    <h3 className="text-base font-bold text-primary">{tier.name}</h3>
                    <p className="text-xs text-muted mt-0.5 leading-relaxed">{tier.description}</p>
                  </div>

                  <div className="py-2.5 border-y border-border">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold font-mono text-primary">${price}</span>
                      <span className="text-xs text-muted">
                        {tier.id === 'free' ? '/ forever' : billingInterval === 'annual' ? '/ year' : '/ month'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {tier.features.map(f => (
                      <div key={f} className="flex items-start gap-2 text-xs text-secondary">
                        <Check size={13} className="text-emerald-700 mt-0.5 shrink-0" />
                        <span className="leading-tight">{f}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-5">
                  {isCurrent ? (
                    <div className="w-full py-2 bg-secondary text-secondary text-xs font-semibold rounded-md text-center border border-border">
                      Current Plan
                    </div>
                  ) : tier.id === 'free' ? (
                    <div className="w-full py-2 bg-secondary/40 text-muted text-xs font-semibold rounded-md text-center">
                      Included
                    </div>
                  ) : (
                    <button
                      onClick={() => handleUpgrade(tier.id)}
                      disabled={actionLoading}
                      className={`w-full py-2 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                        tier.highlight
                          ? 'bg-action-primary hover:bg-action-primary-hover text-action-primary-text'
                          : 'bg-surface hover:bg-secondary text-primary border border-border'
                      }`}
                    >
                      <span>Upgrade to {tier.name}</span>
                      <ArrowUpRight size={13} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Pay-as-you-go Overages */}
      {!isFree && (
        <div className="bg-surface border border-border rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-primary flex items-center gap-2">
              <span>Pay-as-you-go Task Overages</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">Opt-in</span>
            </h3>
            <p className="text-xs text-secondary max-w-2xl">
              Prevent operational disruptions when your team exceeds monthly quotas. 
              Extra tasks are billed at a flat rate of <strong className="text-primary font-medium">$0.05 per task</strong> added directly to your upcoming Stripe invoice.
            </p>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            {subData?.subscription?.overage_tasks_this_month > 0 && (
              <div className="text-right">
                <div className="text-[10px] text-muted">Unbilled Overages</div>
                <div className="text-sm font-bold font-mono text-primary">
                  {subData.subscription.overage_tasks_this_month} (${(subData.subscription.overage_tasks_this_month * 0.05).toFixed(2)})
                </div>
              </div>
            )}
            <button
              onClick={handleToggleOverage}
              disabled={actionLoading}
              className="p-1 text-secondary hover:text-primary transition-all cursor-pointer"
            >
              {overageEnabled ? (
                <ToggleRight className="text-emerald-700" size={34} />
              ) : (
                <ToggleLeft className="text-muted" size={34} />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Enterprise Key Modal */}
      {showLicenseModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 text-primary">
                <Key size={18} className="text-secondary" />
                <h3 className="text-base font-bold">Activate Enterprise License Key</h3>
              </div>
              <button
                onClick={() => setShowLicenseModal(false)}
                className="text-muted hover:text-primary text-xs cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-secondary leading-relaxed">
              If your organization has purchased an on-premise or air-gapped commercial license, enter your cryptographically signed license key (<code className="bg-secondary px-1 py-0.5 rounded text-primary">CB-ENT-V1...</code>) below.
            </p>

            <form onSubmit={handleActivateDigitalLicense} className="space-y-4">
              <textarea
                value={licenseInput}
                onChange={e => setLicenseInput(e.target.value)}
                placeholder="CB-ENT-V1.eyJ0ZW5hbnRJZCI6...abc1234"
                rows={4}
                className="w-full p-3 bg-surface border border-border rounded-md text-xs font-mono text-primary placeholder-muted focus:outline-none focus:border-border-strong transition-all resize-none shadow-xs"
              />

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLicenseModal(false)}
                  className="px-4 py-2 bg-surface hover:bg-secondary text-secondary text-xs font-medium rounded-md border border-border cursor-pointer shadow-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={licenseActivating || !licenseInput.trim()}
                  className="px-4 py-2 bg-action-primary hover:bg-action-primary-hover text-action-primary-text text-xs font-medium rounded-md transition-all cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  {licenseActivating ? 'Verifying HMAC...' : 'Activate License'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
