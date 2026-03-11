'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { logout } from '@/app/login/actions'

const links = [
  { href: '/', label: 'Deals' },
  { href: '/', param: 'investors', label: 'Investors' },
  { href: '/', param: 'share', label: 'Share Lists' },
  { href: '/history', label: 'History' },
]

export function Nav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentTab = searchParams.get('tab') || ''

  if (pathname === '/login' || pathname === '/signup') return null

  function isActive(link: (typeof links)[number]) {
    if (link.param) return pathname === '/' && currentTab === link.param
    if (link.href === '/') return pathname === '/' && !currentTab
    return pathname.startsWith(link.href)
  }

  function getHref(link: (typeof links)[number]) {
    if (link.param) return `/?tab=${link.param}`
    return link.href
  }

  return (
    <nav className="border-b border-border bg-surface sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-6 flex items-center justify-between h-14">
        <div className="flex items-center gap-1">
          <span className="font-bold text-foreground mr-4 tracking-tight">Deal Sharer</span>
          {links.map((link) => (
            <Link
              key={link.label}
              href={getHref(link)}
              className={`text-sm px-3 py-1.5 rounded-md ${
                isActive(link)
                  ? 'text-accent font-medium bg-accent-light'
                  : 'text-secondary hover:text-foreground'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
        <form action={logout}>
          <button type="submit" className="text-sm text-secondary hover:text-foreground">
            Log out
          </button>
        </form>
      </div>
    </nav>
  )
}
