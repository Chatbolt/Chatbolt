'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Terminal,
  Shield,
  Sparkles,
  ArrowRight,
  Code2,
  Users,
  Layers,
  Cpu,
  Github,
  Check
} from 'lucide-react'
import { getSession } from '@/lib/api'

export default function Navbar() {
  const router = useRouter()
  const [scrolled, setScrolled] = useState(false)
  const [session, setSession] = useState<any>(null)

  useEffect(() => {
    getSession().then(setSession).catch(() => {})
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
      scrolled
        ? 'bg-[#09090b]/80 backdrop-blur-xl border-b border-white/[0.08] py-3.5 shadow-lg shadow-black/20'
        : 'bg-transparent py-5 border-b border-transparent'
    }`}>
      <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
        
        {/* Brand Logo & Version Pill */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5 group no-underline">
            {/* Chatbolt Three-Pillar Mark */}
            <svg
              width="22" height="22"
              viewBox="0 0 48 48"
              fill="none"
              aria-hidden="true"
              className="group-hover:opacity-80 transition-opacity shrink-0"
            >
              <rect x="6"  y="18" width="10" height="20" fill="#F8FAFC"/>
              <rect x="19" y="10" width="10" height="28" fill="#F8FAFC"/>
              <rect x="32" y="18" width="10" height="20" fill="#F8FAFC"/>
              <rect x="6"  y="40" width="36" height="2"  fill="#00DFB8"/>
            </svg>
            <span className="text-base font-bold tracking-tight text-white flex items-center gap-1">
              Chatbolt
            </span>
          </Link>

          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/[0.04] border border-white/10 text-[11px] font-mono text-zinc-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Open Core v1.6
          </span>
        </div>

        {/* Center Nav Links */}
        <div className="hidden md:flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-full p-1">
          <Link
            href="/#teams"
            className="px-3.5 py-1.5 rounded-full text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-all no-underline"
          >
            Agent Teams
          </Link>
          <Link
            href="/#architecture"
            className="px-3.5 py-1.5 rounded-full text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-all no-underline"
          >
            Architecture
          </Link>
          <Link
            href="/pricing"
            className="px-3.5 py-1.5 rounded-full text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-all no-underline"
          >
            BYOK Pricing
          </Link>
          <Link
            href="/docs"
            className="px-3.5 py-1.5 rounded-full text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-all no-underline"
          >
            Docs
          </Link>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-3">
          <Link
            href="/onboarding"
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/5 transition-all no-underline"
          >
            Setup Guide
          </Link>

          <Link
            href="/dashboard/terminal"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white text-zinc-950 hover:bg-zinc-200 font-bold text-xs rounded-lg shadow-sm transition-all hover:scale-[1.02] active:scale-95 no-underline"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Open Workspace</span>
            <ArrowRight className="w-3 h-3 opacity-70" />
          </Link>
        </div>

      </div>
    </nav>
  )
}
