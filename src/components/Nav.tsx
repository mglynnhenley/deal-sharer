'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/login/actions'

const links = [
  { href: '/deals', label: 'Deals' },
  { href: '/investors', label: 'Investors' },
  { href: '/share', label: 'Share Lists' },
  { href: '/history', label: 'History' },
]

export function Nav() {
  const pathname = usePathname()

  if (pathname === '/login') return null

  return (
    <nav className="border-b bg-white">
      <div className="max-w-4xl mx-auto px-6 flex items-center justify-between h-14">
        <div className="flex items-center gap-6">
          <span className="font-bold">Deal Sharer</span>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm ${
                pathname.startsWith(link.href)
                  ? 'text-black font-medium'
                  : 'text-gray-500 hover:text-black'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
        <form action={logout}>
          <button type="submit" className="text-sm text-gray-500 hover:text-black">
            Log out
          </button>
        </form>
      </div>
    </nav>
  )
}
