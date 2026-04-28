import { Outlet, useLocation } from 'react-router-dom'
import SidebarNav from './SidebarNav'
import TopBar from './TopBar'
import { findNavItemByPath } from '@/config/navigation'

const normalizePath = (pathname: string) => {
    if (pathname === '/') return pathname
    return pathname.replace(/\/$/, '')
}

const AppLayout = () => {
    const location = useLocation()
    const activeNavItem = findNavItemByPath(normalizePath(location.pathname))

    return (
        <div className="app-shell">
            <aside className="app-sidebar">
                <div className="brand">
                    <span>Trippen</span>
                    <strong>Operations</strong>
                </div>
                <SidebarNav />
                <footer className="app-footer" style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                    <div className="footer-content" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <p>&copy; 2026 Trippen Operations</p>
                    </div>
                </footer>
            </aside>

            <div style={{ position: 'relative', gridColumn: 2, gridRow: 1 }}>
                <TopBar />
                <main className="app-main">
                    <div className="page-stack">
                        <header className="page-header">
                            <h1>{activeNavItem?.label ?? 'Dashboard'}</h1>
                            <p>{activeNavItem?.description ?? 'Keep tabs on mileage, clients, holidays, and seeds.'}</p>
                        </header>
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    )
}

export default AppLayout
