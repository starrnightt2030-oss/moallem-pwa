import { NavLink, Outlet } from 'react-router-dom'
import { LogOut, Moon, Sun, School } from 'lucide-react'
import { STUDENT_NAV } from './nav'
import { useAuth } from '@/store/auth'
import { useSettings } from '@/store/settings'
import { useUi, applyTheme } from '@/store/ui'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui'
import { useEffect } from 'react'

export function StudentShell() {
  const { student, signOut } = useAuth()
  const { settings } = useSettings()
  const { theme, setTheme } = useUi()

  useEffect(() => { applyTheme(theme) }, [theme])

  return (
    <div className="min-h-dvh bg-bg">
      <header className="app-header sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line glass px-4">
        {settings.logo_url ? (
          <img src={settings.logo_url} alt="" className="size-9 rounded-xl object-cover" />
        ) : (
          <span className="grid size-9 place-items-center rounded-xl bg-[var(--brand)] text-white"><School className="size-5" /></span>
        )}
        <div className="min-w-0">
          <p className="truncate text-[14px] font-extrabold leading-tight text-ink">{settings.app_name}</p>
          <p className="num truncate text-[11px] text-muted">{student?.code}</p>
        </div>
        <div className="mr-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="المظهر">
            {theme === 'dark' ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => signOut()} aria-label="خروج">
            <LogOut className="size-[18px]" />
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-3 pb-24 pt-4 sm:px-5">
        <Outlet />
      </main>

      <nav className="bottom-nav safe-b fixed inset-x-0 bottom-0 z-30 flex border-t border-line glass">
        {STUDENT_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/portal'}
            className={({ isActive }) =>
              cn('tap flex flex-1 flex-col items-center gap-1 py-2.5 text-[10.5px] font-semibold transition',
                isActive ? 'text-[var(--brand)]' : 'text-muted')
            }
          >
            {({ isActive }) => (
              <>
                <span className={cn('rounded-lg px-3 py-1 transition', isActive && 'bg-[color-mix(in_oklab,var(--brand)_14%,transparent)]')}>
                  <item.icon className="size-[19px]" />
                </span>
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
