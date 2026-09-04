import {
  LayoutDashboard, GraduationCap, BookOpen, Users, CalendarDays, ClipboardCheck,
  Wallet, FolderKanban, Bell, FolderOpen, BarChart3, Settings, School, Home,
  MessageSquare, ReceiptText, CalendarCheck,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  primary?: boolean
}

export const ADMIN_NAV: NavItem[] = [
  { to: '/', label: 'الرئيسية', icon: LayoutDashboard, primary: true },
  { to: '/students', label: 'الطلاب', icon: GraduationCap, primary: true },
  { to: '/attendance', label: 'الحضور', icon: ClipboardCheck, primary: true },
  { to: '/finance', label: 'الحسابات', icon: Wallet, primary: true },
  { to: '/schedule', label: 'جدول الحصص', icon: CalendarDays },
  { to: '/subjects', label: 'المواد', icon: BookOpen },
  { to: '/groups', label: 'المجموعات والسنوات', icon: Users },
  { to: '/projects', label: 'المشاريع', icon: FolderKanban },
  { to: '/messages', label: 'الرسائل', icon: MessageSquare },
  { to: '/files', label: 'الملفات', icon: FolderOpen },
  { to: '/reports', label: 'التقارير', icon: BarChart3 },
  { to: '/settings', label: 'الإعدادات', icon: Settings },
]

export const STUDENT_NAV: NavItem[] = [
  { to: '/portal', label: 'الرئيسية', icon: Home, primary: true },
  { to: '/portal/finance', label: 'المستحقات', icon: ReceiptText, primary: true },
  { to: '/portal/attendance', label: 'الحصص', icon: CalendarCheck, primary: true },
  { to: '/portal/messages', label: 'الرسائل', icon: MessageSquare, primary: true },
  { to: '/portal/project', label: 'المشروع', icon: FolderKanban, primary: true },
]

export { School, Bell, Settings }
