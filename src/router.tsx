import { createBrowserRouter } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import DashboardPage from './pages/DashboardPage'
import TripsPage from './pages/TripsPage'
import ClientSetupPage from './pages/ClientSetupPage'
import HolidaysPage from './pages/HolidaysPage'
import HolidaySetupPage from './pages/HolidaySetupPage'
import VehicleSetupPage from './pages/VehicleSetupPage'
import SeedDataPage from './pages/SeedDataPage'
import NotFoundPage from './pages/NotFoundPage'

export const router = createBrowserRouter([
    {
        path: '/',
        element: <AppLayout />,
        children: [
            { index: true, element: <DashboardPage /> },
            { path: 'trips', element: <TripsPage /> },
            { path: 'clients', element: <ClientSetupPage /> },
            { path: 'holidays', element: <HolidaysPage /> },
            { path: 'holidays-setup', element: <HolidaySetupPage /> },
            { path: 'vehicles-setup', element: <VehicleSetupPage /> },
            { path: 'seed', element: <SeedDataPage /> },
            { path: '*', element: <NotFoundPage /> },
        ],
    },
])
