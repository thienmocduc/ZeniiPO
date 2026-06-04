'use client'

/**
 * IdentityBind — patches the v1 topbar identity chips with the REAL logged-in
 * user + tenant, overriding the static demo template ("ANIMA Care Global",
 * "Chairman · CHR-001") and the v1 demo role-switcher script.
 *
 * Runs after mount and re-applies once on a short delay so it wins over the
 * inline v1 script that sets the demo identity on load. Fully defensive: if the
 * fetch fails or nodes are missing, the static markup is left intact.
 */

import { useEffect } from 'react'

const ROLE_LABEL: Record<string, string> = {
  chr: 'Chairman', ceo: 'CEO', cfo: 'CFO', coo: 'COO',
  cto: 'CTO', cmo: 'CMO', clo: 'CLO', emp: 'Member',
}

export function IdentityBind() {
  useEffect(() => {
    let cancelled = false

    const setText = (sel: string, val: string) => {
      if (!val) return
      const el = document.querySelector<HTMLElement>(sel)
      if (el) el.textContent = val
    }

    async function apply() {
      try {
        const res = await fetch('/api/settings', { credentials: 'same-origin' })
        if (!res.ok || cancelled) return
        const j = await res.json()
        const d = (j.data ?? j) as {
          auth?: { email?: string }
          profile?: { full_name?: string; role?: string }
          tenant?: { name?: string; plan?: string }
        }
        if (cancelled) return
        const name = d.profile?.full_name || d.auth?.email || ''
        const role = d.profile?.role ?? ''
        const roleLabel = ROLE_LABEL[role] ?? (role ? role.toUpperCase() : '')
        const tName = d.tenant?.name ?? ''
        const plan = d.tenant?.plan ?? 'free'

        // Identity chip (top-right)
        setText('#roleName', name)
        setText('#roleLabel', roleLabel + (tName ? ` · ${tName}` : ''))
        if (name) setText('#roleAv', name.trim()[0].toUpperCase())

        // Tenant switcher chip (top-left)
        setText('.entity-switch .labels b', tName)
        setText('.entity-switch .labels span', `${plan} tenant`)
        if (tName) setText('.entity-switch .icon', tName.trim()[0].toUpperCase())
      } catch {
        /* leave static markup intact */
      }
    }

    apply()
    const t = setTimeout(apply, 400) // beat the v1 demo role script
    return () => { cancelled = true; clearTimeout(t) }
  }, [])

  return null
}
