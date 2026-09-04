import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import { AdminShell } from '@/components/layout/AdminShell'
import { StudentShell } from '@/components/layout/StudentShell'
import { PageLoader } from '@/components/ui'
import { isConfigured } from '@/lib/supabase'
import LoginPage from '@/features/auth/LoginPage'
import SetupNotice from '@/features/auth/SetupNotice'

const Dashboard      = lazy(() => import('@/features/dashboard/DashboardPage'))
const StudentsPage   = lazy(() => import('@/features/students/StudentsPage'))
const StudentProfile = lazy(() => import('@/features/students/StudentProfilePage'))
const SubjectsPage   = lazy(() => import('@/features/subjects/SubjectsPage'))
const GroupsPage     = lazy(() => import('@/features/groups/GroupsPage'))
const SchedulePage   = lazy(() => import('@/features/schedule/SchedulePage'))
const AttendancePage = lazy(() => import('@/features/attendance/AttendancePage'))
const FinancePage    = lazy(() => import('@/features/finance/FinancePage'))
const ProjectsPage   = lazy(() => import('@/features/projects/ProjectsPage'))
const ProjectDetail  = lazy(() => import('@/features/projects/ProjectDetailPage'))
const MessagesPage   = lazy(() => import('@/features/messages/MessagesPage'))
const FilesPage      = lazy(() => import('@/features/files/FilesPage'))
const ReportsPage    = lazy(() => import('@/features/reports/ReportsPage'))
const StudentReport  = lazy(() => import('@/features/reports/StudentReportPage'))
const SettingsPage   = lazy(() => import('@/features/settings/SettingsPage'))

const PortalHome     = lazy(() => import('@/features/portal/PortalHome'))
const PortalFinance  = lazy(() => import('@/features/portal/PortalFinance'))
const PortalAttend   = lazy(() => import('@/features/portal/PortalAttendance'))
const PortalMessages = lazy(() => import('@/features/portal/PortalMessages'))
const PortalProject  = lazy(() => import('@/features/portal/PortalProject'))

export default function App() {
  const { session, profile, loading, isAdmin, isStudent, signOut } = useAuth()

  if (!isConfigured) return <SetupNotice />
  if (loading) return <PageLoader label="جارٍ التحقق من الجلسة…" />
  if (!session) return <LoginPage />

  if (!profile) {
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div className="max-w-sm">
          <p className="text-lg font-bold text-ink">لم يتم ربط هذا الحساب ببيانات بعد</p>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
            الحساب موجود لكن لم تُحدَّد صلاحياته. لو كنت المدرّس، شغّل في محرّر SQL بلوحة Supabase:
          </p>
          <pre className="num mt-2 overflow-x-auto rounded-lg bg-surface-2 p-3 text-[12px]" dir="ltr">
            select public.make_admin('{session.user.email}');
          </pre>
          <button
            onClick={() => signOut()}
            className="tap mt-4 rounded-xl bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white"
          >
            تسجيل الخروج والعودة لشاشة الدخول
          </button>
        </div>
      </div>
    )
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {isAdmin && (
          <Route element={<AdminShell />}>
            <Route index element={<Dashboard />} />
            <Route path="students" element={<StudentsPage />} />
            <Route path="students/:id" element={<StudentProfile />} />
            <Route path="subjects" element={<SubjectsPage />} />
            <Route path="groups" element={<GroupsPage />} />
            <Route path="schedule" element={<SchedulePage />} />
            <Route path="attendance" element={<AttendancePage />} />
            <Route path="finance" element={<FinancePage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route path="files" element={<FilesPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="reports/student/:id" element={<StudentReport />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="settings/:tab" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        )}

        {isStudent && (
          <Route path="/portal" element={<StudentShell />}>
            <Route index element={<PortalHome />} />
            <Route path="finance" element={<PortalFinance />} />
            <Route path="attendance" element={<PortalAttend />} />
            <Route path="messages" element={<PortalMessages />} />
            <Route path="project" element={<PortalProject />} />
          </Route>
        )}
        {isStudent && <Route path="*" element={<Navigate to="/portal" replace />} />}
      </Routes>
    </Suspense>
  )
}
