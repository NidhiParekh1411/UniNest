import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import Shell from './components/Shell.jsx';
import SiteLayout from './components/SiteLayout.jsx';
import { Skeleton } from './components/ui.jsx';

import Landing from './pages/Landing.jsx';
import About from './pages/About.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Assistant from './pages/Assistant.jsx';
import Timetable from './pages/Timetable.jsx';
import Attendance from './pages/Attendance.jsx';
import Results from './pages/Results.jsx';
import Assignments from './pages/Assignments.jsx';
import Library from './pages/Library.jsx';
import Notices from './pages/Notices.jsx';
import QuestionBanks from './pages/QuestionBanks.jsx';
import People from './pages/People.jsx';
import SubjectsAdmin from './pages/SubjectsAdmin.jsx';

function Booting() {
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 'var(--s5)' }}>
      <div className="stack" style={{ width: 260, gap: 'var(--s3)' }}>
        <Skeleton height={36} width={36} style={{ borderRadius: 12 }} />
        <Skeleton height={13} width="70%" />
        <Skeleton height={11} width="45%" />
      </div>
    </div>
  );
}

// Screens that only make sense for one role redirect rather than render an
// empty page — the server would refuse the data anyway.
function RoleRoute({ allow, children }) {
  const { user } = useAuth();
  if (!allow.includes(user.role)) return <Navigate to="/app" replace />;
  return children;
}

// The public site is reachable signed in or out; only /app requires a session.
function Protected({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// Somebody already signed in has no use for the sign-in form.
function SignedOutOnly({ children }) {
  const { user } = useAuth();
  if (user) return <Navigate to="/app" replace />;
  return children;
}

export default function App() {
  const { loading } = useAuth();

  if (loading) return <Booting />;

  return (
    <Routes>
      {/* ------------------------------------------------------ public site */}
      <Route path="/" element={<SiteLayout><Landing /></SiteLayout>} />
      <Route path="/about" element={<SiteLayout><About /></SiteLayout>} />

      {/* ---------------------------------------------------------- sign-in */}
      <Route path="/login" element={<SignedOutOnly><Login portal="student" /></SignedOutOnly>} />
      <Route path="/staff" element={<SignedOutOnly><Login portal="staff" /></SignedOutOnly>} />

      {/* -------------------------------------------------------- the app */}
      <Route
        path="/app/*"
        element={(
          <Protected>
            <Shell>
              <Routes>
                <Route index element={<Dashboard />} />
                <Route path="assistant" element={<Assistant />} />
                <Route path="timetable" element={<Timetable />} />
                <Route path="attendance" element={<Attendance />} />
                <Route path="results" element={<Results />} />
                <Route path="assignments" element={<Assignments />} />
                <Route path="library" element={<Library />} />
                <Route path="notices" element={<Notices />} />
                <Route path="question-banks" element={<RoleRoute allow={['faculty', 'admin']}><QuestionBanks /></RoleRoute>} />
                <Route path="people" element={<RoleRoute allow={['admin']}><People /></RoleRoute>} />
                <Route path="subjects" element={<RoleRoute allow={['admin']}><SubjectsAdmin /></RoleRoute>} />
                <Route path="*" element={<Navigate to="/app" replace />} />
              </Routes>
            </Shell>
          </Protected>
        )}
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
