import { AppLayout } from './components/layout/AppLayout';
import { AdminCenterPage } from './pages/AdminCenterPage';
import { AdminUsagePage } from './pages/AdminUsagePage';
import { HomeDashboard } from './pages/HomeDashboard';
import { useEffect, useState } from 'react';
import { trackUsageEvent } from './lib/usageTracking';

function getRouteName() {
  if (typeof window === 'undefined') {
    return 'home';
  }

  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  const hash = window.location.hash.replace(/^#\/?/, '/').replace(/\/+$/, '');

  if (pathname === '/admin' || pathname.startsWith('/admin?')) {
    return 'admin-center';
  }

  if (pathname === '/admin/usage' || hash === '/admin/usage') {
    return 'admin-usage';
  }

  return 'home';
}

export default function App() {
  const [routeName, setRouteName] = useState(getRouteName);

  useEffect(() => {
    const handleRouteChange = () => setRouteName(getRouteName());

    window.addEventListener('hashchange', handleRouteChange);
    window.addEventListener('popstate', handleRouteChange);

    return () => {
      window.removeEventListener('hashchange', handleRouteChange);
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, []);

  useEffect(() => {
    const label =
      routeName === 'admin-center' ? 'Centro de Administración' : routeName === 'admin-usage' ? 'Uso de la intranet' : 'Inicio';
    trackUsageEvent({
      kind: 'pageview',
      label,
      page: label,
      route: routeName,
      section: label,
    });
  }, [routeName]);

  return (
    <AppLayout>
      {routeName === 'admin-center' ? (
        <AdminCenterPage />
      ) : routeName === 'admin-usage' ? (
        <AdminUsagePage />
      ) : (
        <HomeDashboard />
      )}
    </AppLayout>
  );
}
