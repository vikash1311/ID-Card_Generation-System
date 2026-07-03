import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth }               from './hooks/useAuth.jsx'
import { SubmissionsProvider }                 from './hooks/useSubmissions.jsx'
import { FormConfigsProvider }                 from './hooks/useFormConfigs.jsx'
import { OrganizationsProvider }               from './hooks/useOrganizations.jsx'
import { CardTemplatesProvider }               from './hooks/useCardtemplates.jsx'
import { NotificationsProvider }               from './hooks/useNotifications.jsx'
import Navbar         from './components/Navbar.jsx'
import Home           from './pages/Home.jsx'
import Dashboard      from './pages/Dashboard.jsx'
import AddTemplate    from './pages/AddTemplate.jsx'
import DetailsForm    from './pages/DetailsForm.jsx'
import Admin          from './pages/Admin.jsx'
import AllTemplates   from './pages/AllTemplates.jsx'
import Organizations  from './pages/Organizations.jsx'
import IDCardBuilder  from './pages/Idcardbuilder.jsx'
import Success        from './pages/Success.jsx'
import About          from './pages/About.jsx'
import OrgDashboard   from './pages/OrgDashboard.jsx'

function Spinner() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div style={{ width:40, height:40, border:'3px solid var(--border)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin .7s linear infinite' }}/>
    </div>
  )
}

function ProtectedAdmin({ children }) {
  const { user, role, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/" replace />
  if (role === 'org') return <Navigate to="/org/dashboard" replace />
  return children
}

function ProtectedOrg({ children }) {
  const { user, role, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/" replace />
  if (role === 'admin') return <Navigate to="/dashboard" replace />
  return children
}

function AuthenticatedProviders({ children }) {
  return (
    <SubmissionsProvider>
      <FormConfigsProvider>
        <OrganizationsProvider>
          <CardTemplatesProvider>
            {children}
          </CardTemplatesProvider>
        </OrganizationsProvider>
      </FormConfigsProvider>
    </SubmissionsProvider>
  )
}

function AppRoutes() {
  const { user, role, loading } = useAuth()
  const { pathname } = useLocation()
  const hideNavbar = pathname.startsWith('/form/') ||
                     pathname === '/success' ||
                     pathname.startsWith('/org/')

  if (loading) return <Spinner />

  return (
    <AuthenticatedProviders>
      {!hideNavbar && <Navbar />}
      <Routes>
        {/* Public */}
        <Route path="/" element={
          !user ? <Home /> :
          role === 'org' ? <Navigate to="/org/dashboard" replace /> :
          <Navigate to="/dashboard" replace />
        }/>
        <Route path="/form/:urlId" element={<DetailsForm />} />
        <Route path="/success"     element={<Success />} />
        <Route path="/about"       element={<About />} />

        {/* Admin only */}
        <Route path="/dashboard"    element={<ProtectedAdmin><Dashboard /></ProtectedAdmin>} />
        <Route path="/add-template" element={<ProtectedAdmin><AddTemplate /></ProtectedAdmin>} />
        <Route path="/admin"        element={<ProtectedAdmin><Admin /></ProtectedAdmin>} />
        <Route path="/templates"    element={<ProtectedAdmin><AllTemplates /></ProtectedAdmin>} />
        <Route path="/organizations"element={<ProtectedAdmin><Organizations /></ProtectedAdmin>} />
        <Route path="/card-builder" element={<ProtectedAdmin><IDCardBuilder /></ProtectedAdmin>} />

        {/* Org only */}
        <Route path="/org/dashboard" element={<ProtectedOrg><OrgDashboard /></ProtectedOrg>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthenticatedProviders>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppRoutes />
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: { fontFamily:'Instrument Sans,sans-serif', fontSize:13, fontWeight:600 },
              success: { iconTheme: { primary:'#00c48c', secondary:'#fff' } },
              error:   { iconTheme: { primary:'#ef4444', secondary:'#fff' } },
            }}
          />
        </BrowserRouter>
      </NotificationsProvider>
    </AuthProvider>
  )
}