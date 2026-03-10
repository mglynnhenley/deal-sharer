'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { logout } from '@/app/login/actions'

const links = [
  { href: '/', param: 'deals', label: 'Deals' },
  { href: '/', param: 'investors', label: 'Investors' },
  { href: '/share', label: 'Share Lists' },
  { href: '/history', label: 'History' },
]

export function Nav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentTab = searchParams.get('tab') || 'deals'

  if (pathname === '/login') return null

  function isActive(link: typeof links[number]) {
    if (link.param) {
      return pathname === '/' && currentTab === link.param
    }
    return pathname.startsWith(link.href)
  }

  function getHref(link: typeof links[number]) {
    if (link.param) return `/?tab=${link.param}`
    return link.href
  }

  return (
    <nav className="border-b border-border bg-surface">
      <div className="max-w-4xl mx-auto px-6 flex items-center justify-between h-14">
        <div className="flex items-center gap-6">
          <span className="font-bold text-foreground">Deal Sharer</span>
          {links.map((link) => (
            <Link
              key={link.label}
              href={getHref(link)}
              className={`text-sm ${
                isActive(link)
                  ? 'text-foreground font-medium'
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
