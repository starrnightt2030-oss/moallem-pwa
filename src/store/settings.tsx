import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { AppSettings } from '@/lib/database.types'

export const DEFAULT_SETTINGS: AppSettings = {
  id: 1,
  app_name: 'منصّة المعلّم',
  short_name: 'المعلّم',
  tagline: 'إدارة الدروس والطلاب',
  teacher_name: '',
  teacher_phone: '',
  teacher_email: '',
  teacher_address: '',
  logo_url: null,
  icon_url: null,
  avatar_url: null,
  primary_color: '#2563eb',
  accent_color: '#0d9488',
  theme_mode: 'system',
  currency: 'EGP',
  currency_symbol: 'ج.م',
  default_sessions_per_cycle: 4,
  absence_counts_in_cycle: true,
  charge_on_cycle_start: true,
  student_can_view_history: false,
  student_can_view_attendance: true,
  student_can_view_files: true,
  report_header: '',
  report_footer: '',
  updated_at: new Date().toISOString(),
}

const Ctx = createContext<{ settings: AppSettings; reload: () => void }>({
  settings: DEFAULT_SETTINGS,
  reload: () => {},
})

/** تحويل لون HEX إلى مشتقاته لتطبيق الهوية البصرية على المتغيرات */
function applyBrand(primary: string, accent: string) {
  const root = document.documentElement
  root.style.setProperty('--brand', primary)
  root.style.setProperty('--accent', accent)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta && !root.classList.contains('dark')) meta.setAttribute('content', primary)
}

/** تحديث بيان التطبيق (manifest) ديناميكيًا من الإعدادات */
function applyManifest(s: AppSettings) {
  try {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
    if (!link) return
    const base = location.origin
    const icons = [
      { src: `${base}/icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${base}/icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `${base}/icons/maskable-192.png`, sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: `${base}/icons/maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ]
    if (s.icon_url) icons.unshift({ src: s.icon_url, sizes: '512x512', type: 'image/png', purpose: 'any' })
    const manifest = {
      id: '/',
      name: s.app_name,
      short_name: s.short_name,
      description: s.tagline ?? '',
      lang: 'ar',
      dir: 'rtl',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: '#0b1220',
      theme_color: s.primary_color,
      icons,
    }
    const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' })
    link.href = URL.createObjectURL(blob)
  } catch {
    /* تجاهل — البيان الثابت يبقى فعّالًا */
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const { data } = useQuery({
    queryKey: ['app_settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings').select('*').eq('id', 1).maybeSingle()
      if (error || !data) {
        const { data: pub } = await supabase.from('public_branding').select('*').maybeSingle()
        return { ...DEFAULT_SETTINGS, ...(pub ?? {}) } as AppSettings
      }
      return data as AppSettings
    },
    staleTime: 60_000,
    retry: 1,
  })

  const settings = data ?? DEFAULT_SETTINGS

  useEffect(() => {
    applyBrand(settings.primary_color, settings.accent_color)
    applyManifest(settings)
    document.title = settings.app_name
  }, [settings.primary_color, settings.accent_color, settings.app_name, settings.icon_url, settings.short_name])

  return (
    <Ctx.Provider value={{ settings, reload: () => qc.invalidateQueries({ queryKey: ['app_settings'] }) }}>
      {children}
    </Ctx.Provider>
  )
}

export const useSettings = () => useContext(Ctx)
export const useCurrency = () => useContext(Ctx).settings.currency_symbol
