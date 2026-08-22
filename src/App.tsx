import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import { useData } from '@/store/data';
import { setKeepAwake, useTimer } from '@/store/timer';
import { AppShell } from '@/components/layout/AppShell';
import { Toaster } from '@/components/ui/Toaster';
import { LoadingScreen } from '@/components/ui/States';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { guardFor } from '@/components/layout/nav';
import { ROLE_RANK, type Role } from '@/types';

import Landing from '@/pages/Landing';
import SignIn from '@/pages/auth/SignIn';
import SignUp from '@/pages/auth/SignUp';
import Onboarding from '@/pages/onboarding/Onboarding';
import Dashboard from '@/pages/Dashboard';

const FitStart = lazy(() => import('@/pages/onboarding/FitStart'));
const Program = lazy(() => import('@/pages/Program'));
const WorkoutToday = lazy(() => import('@/pages/WorkoutToday'));
const Walk = lazy(() => import('@/pages/Walk'));
const LiveWorkout = lazy(() => import('@/pages/LiveWorkout'));
const WorkoutComplete = lazy(() => import('@/pages/WorkoutComplete'));
const Goals = lazy(() => import('@/pages/Goals'));
const Progress = lazy(() => import('@/pages/Progress'));
const CalendarPage = lazy(() => import('@/pages/CalendarPage'));
const Recovery = lazy(() => import('@/pages/Recovery'));
const BodyMap = lazy(() => import('@/pages/BodyMap'));
const Nutrition = lazy(() => import('@/pages/Nutrition'));
const Habits = lazy(() => import('@/pages/Habits'));
const Exercises = lazy(() => import('@/pages/Exercises'));
const ExerciseDetail = lazy(() => import('@/pages/ExerciseDetail'));
const Timers = lazy(() => import('@/pages/Timers'));
const Challenges = lazy(() => import('@/pages/Challenges'));
const Achievements = lazy(() => import('@/pages/Achievements'));
const Records = lazy(() => import('@/pages/Records'));
const Coach = lazy(() => import('@/pages/Coach'));
const WeeklyReview = lazy(() => import('@/pages/WeeklyReview'));
const MonthlyReport = lazy(() => import('@/pages/MonthlyReport'));
const Friends = lazy(() => import('@/pages/Friends'));
const Pricing = lazy(() => import('@/pages/Pricing'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const Settings = lazy(() => import('@/pages/Settings'));
const More = lazy(() => import('@/pages/More'));
const TrainerDashboard = lazy(() => import('@/pages/trainer/TrainerDashboard'));
const ClientDetail = lazy(() => import('@/pages/trainer/ClientDetail'));
const Attendance = lazy(() => import('@/pages/admin/Attendance'));
const Members = lazy(() => import('@/pages/admin/Members'));
const Equipment = lazy(() => import('@/pages/admin/Equipment'));
const GymAnalytics = lazy(() => import('@/pages/admin/GymAnalytics'));
const AuditLogPage = lazy(() => import('@/pages/admin/AuditLogPage'));
const NotFound = lazy(() => import('@/pages/NotFound'));

export default function App() {
  const { status, profile, boot } = useAuth();
  const loadData = useData((s) => s.load);
  const resetData = useData((s) => s.reset);
  const dataLoaded = useData((s) => s.loaded);
  const dataUserId = useData((s) => s.userId);

  useEffect(() => { void boot(); }, [boot]);

  useEffect(() => {
    if (status === 'authed' && profile && dataUserId !== profile.id) {
      void loadData(profile.id, profile.role);
    }
    if (status === 'anon' && dataUserId) resetData();
  }, [status, profile, dataUserId, loadData, resetData]);

  useThemeSync();
  useMotionPreference();
  useTimerPreferences();

  if (status === 'booting') return <LoadingScreen />;

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingScreen label="Loading" />}>
        <Routes>
          <Route path="/welcome" element={<PublicOnly><Landing /></PublicOnly>} />
          <Route path="/signin" element={<PublicOnly><SignIn /></PublicOnly>} />
          <Route path="/signup" element={<PublicOnly><SignUp /></PublicOnly>} />

          <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
          <Route path="/assessment" element={<RequireAuth><FitStart /></RequireAuth>} />
          <Route path="/workout/live" element={<RequireReady loaded={dataLoaded}><LiveWorkout /></RequireReady>} />
          <Route path="/workout/complete/:sessionId" element={<RequireReady loaded={dataLoaded}><WorkoutComplete /></RequireReady>} />

          <Route element={<RequireReady loaded={dataLoaded}><AppShell /></RequireReady>}>
            <Route index element={<Dashboard />} />
            <Route path="/workout" element={<WorkoutToday />} />
            <Route path="/walk" element={<Walk />} />
            <Route path="/program" element={<Program />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/recovery" element={<Recovery />} />
            <Route path="/body" element={<BodyMap />} />
            <Route path="/nutrition" element={<Nutrition />} />
            <Route path="/habits" element={<Habits />} />
            <Route path="/exercises" element={<Exercises />} />
            <Route path="/exercises/:slug" element={<ExerciseDetail />} />
            <Route path="/timers" element={<Timers />} />
            <Route path="/challenges" element={<Challenges />} />
            <Route path="/achievements" element={<Achievements />} />
            <Route path="/records" element={<Records />} />
            <Route path="/coach" element={<Coach />} />
            <Route path="/review" element={<WeeklyReview />} />
            <Route path="/report" element={<MonthlyReport />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/more" element={<More />} />

            <Route path="/trainer" element={<RequireRole role="trainer"><TrainerDashboard /></RequireRole>} />
            <Route path="/trainer/:clientId" element={<RequireRole role="trainer"><ClientDetail /></RequireRole>} />
            <Route path="/admin/attendance" element={<RequireRole role="staff"><Attendance /></RequireRole>} />
            <Route path="/admin/members" element={<RequireRole role="staff"><Members /></RequireRole>} />
            <Route path="/admin/equipment" element={<RequireRole role="manager"><Equipment /></RequireRole>} />
            <Route path="/admin/analytics" element={<RequireRole role="manager"><GymAnalytics /></RequireRole>} />
            <Route path="/admin/audit" element={<RequireRole role="admin"><AuditLogPage /></RequireRole>} />

            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
      <Toaster />
    </ErrorBoundary>
  );
}

/* ---------------- route guards ---------------- */

function PublicOnly({ children }: { children: React.ReactNode }) {
  const status = useAuth((s) => s.status);
  if (status === 'authed') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const status = useAuth((s) => s.status);
  const location = useLocation();
  if (status !== 'authed') return <Navigate to="/welcome" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

/** Authenticated, data loaded, and past onboarding. */
function RequireReady({ children, loaded }: { children: React.ReactNode; loaded: boolean }) {
  const { status, profile } = useAuth();
  const location = useLocation();
  const error = useData((s) => s.error);

  if (status !== 'authed' || !profile) return <Navigate to="/welcome" replace state={{ from: location.pathname }} />;
  if (!loaded && !error) return <LoadingScreen label="Loading your training data" />;
  if (!profile.onboarded) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function RequireRole({ role, children }: { role: Role; children: React.ReactNode }) {
  const profile = useAuth((s) => s.profile);
  const location = useLocation();
  const needed = guardFor(location.pathname) ?? role;
  if (!profile || ROLE_RANK[profile.role] < ROLE_RANK[needed]) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <h1 className="text-xl font-bold">You do not have access to this area</h1>
        <p className="text-sm text-ink-3 mt-2">
          This section is limited to {needed} accounts and above. If you believe this is a mistake, contact your gym administrator.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}

/* ---------------- side effects ---------------- */

function useThemeSync() {
  const theme = useData((s) => s.preferences?.theme ?? 'dark');
  useEffect(() => {
    const root = document.documentElement;
    const apply = (dark: boolean) => root.classList.toggle('dark', dark);
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      apply(mq.matches);
      const handler = (e: MediaQueryListEvent) => apply(e.matches);
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
    apply(theme === 'dark');
  }, [theme]);
}

/** Applies the user's explicit reduced-motion choice on top of the OS setting. */
function useMotionPreference() {
  const reduced = useData((s) => s.preferences?.reduced_motion ?? false);
  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', reduced);
  }, [reduced]);
}

function useTimerPreferences() {
  const prefs = useData((s) => s.preferences);
  useEffect(() => {
    if (!prefs) return;
    useTimer.getState().setSound(prefs.workout.sound);
    useTimer.getState().setVibrate(prefs.workout.vibrate);
    setKeepAwake(prefs.workout.keep_awake);
  }, [prefs]);
}
