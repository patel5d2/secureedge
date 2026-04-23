import { createBrowserRouter, Navigate } from 'react-router-dom';
import AuthLayout from './layouts/AuthLayout';
import PortalLayout from './layouts/PortalLayout';
import AdminLayout from './layouts/AdminLayout';
import HelpdeskLayout from './layouts/HelpdeskLayout';

import LoginPage from './pages/auth/LoginPage';
import MfaPage from './pages/auth/MfaPage';
import AccessDeniedPage from './pages/auth/AccessDeniedPage';

import PortalHome from './pages/portal/PortalHome';
import AppDetail from './pages/portal/AppDetail';
import SessionsPage from './pages/portal/SessionsPage';
import DevicesPage from './pages/portal/DevicesPage';
import ProfilePage from './pages/portal/ProfilePage';

import AdminOverview from './pages/admin/AdminOverview';
import PoliciesList from './pages/admin/PoliciesList';
import PolicyEditor from './pages/admin/PolicyEditor';
import UsersPage from './pages/admin/UsersPage';
import UserDetail from './pages/admin/UserDetail';
import GroupsPage from './pages/admin/GroupsPage';
import ApplicationsPage from './pages/admin/ApplicationsPage';
import AuditLogPage from './pages/admin/AuditLogPage';
import SettingsPage from './pages/admin/SettingsPage';

import HelpdeskDashboard from './pages/helpdesk/HelpdeskDashboard';
import AlertsPage from './pages/helpdesk/AlertsPage';
import UserLookup from './pages/helpdesk/UserLookup';
import DeviceFleet from './pages/helpdesk/DeviceFleet';

import NotFound from './pages/NotFound';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/portal" replace />,
  },
  {
    // Access Denied renders standalone (no layout chrome, dark gradient like auth)
    path: '/access-denied',
    element: <AccessDeniedPage />,
  },
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/mfa', element: <MfaPage /> },
    ],
  },
  {
    element: <PortalLayout />,
    children: [
      { path: '/portal', element: <PortalHome /> },
      { path: '/portal/app/:id', element: <AppDetail /> },
      { path: '/portal/sessions', element: <SessionsPage /> },
      { path: '/portal/devices', element: <DevicesPage /> },
      { path: '/portal/profile', element: <ProfilePage /> },
    ],
  },
  {
    element: <AdminLayout />,
    children: [
      { path: '/admin', element: <AdminOverview /> },
      { path: '/admin/policies', element: <PoliciesList /> },
      { path: '/admin/policies/new', element: <PolicyEditor /> },
      { path: '/admin/policies/:id', element: <PolicyEditor /> },
      { path: '/admin/users', element: <UsersPage /> },
      { path: '/admin/users/:id', element: <UserDetail /> },
      { path: '/admin/groups', element: <GroupsPage /> },
      { path: '/admin/applications', element: <ApplicationsPage /> },
      { path: '/admin/audit-log', element: <AuditLogPage /> },
      { path: '/admin/settings', element: <SettingsPage /> },
    ],
  },
  {
    element: <HelpdeskLayout />,
    children: [
      { path: '/helpdesk', element: <HelpdeskDashboard /> },
      { path: '/helpdesk/alerts', element: <AlertsPage /> },
      { path: '/helpdesk/users', element: <UserLookup /> },
      { path: '/helpdesk/devices', element: <DeviceFleet /> },
    ],
  },
  {
    path: '*',
    element: <NotFound />,
  },
]);
