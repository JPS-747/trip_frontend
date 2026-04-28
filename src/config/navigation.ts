export type NavItem = {
    label: string
    path: string
    description: string
}

export const NAV_ITEMS: NavItem[] = [
    {
        label: 'Dashboard',
        path: '/',
        description: 'Trip overview, actions, and odometer controls',
    },
    {
        label: 'Trips list',
        path: '/trips',
        description: 'Filters, pagination, and exports for recorded trips',
    },
    {
        label: 'Client setup',
        path: '/clients',
        description: 'Manage saved clients, metadata, and imports',
    },
    {
        label: 'Vehicles',
        path: '/vehicles-setup',
        description: 'Manage vehicle details and efficiency ratings',
    },
    {
        label: 'Public holidays',
        path: '/holidays',
        description: 'Curate holiday calendars and imports',
    },
    {
        label: 'Seed data',
        path: '/seed',
        description: 'Generate sample data and automation scenarios',
    },
]

export const findNavItemByPath = (pathname: string): NavItem | undefined =>
    NAV_ITEMS.find((item) => item.path === pathname)
