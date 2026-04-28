import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from '@/config/navigation'
import clsx from 'clsx'

const SidebarNav = () => (
    <nav>
        <ul className="nav-list">
            {NAV_ITEMS.map((item) => (
                <li key={item.path}>
                    <NavLink
                        to={item.path}
                        className={({ isActive }) => clsx('nav-link', { active: isActive })}
                        end={item.path === '/'}
                    >
                        <svg viewBox="0 0 24 24" aria-hidden>
                            <path
                                fill="currentColor"
                                d="M12 3c5 0 9 4 9 9s-4 9-9 9-9-4-9-9 4-9 9-9Zm0 2a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm0 3a1 1 0 0 1 1 1v5.25l3.25 1.94a1 1 0 0 1-1 1.73l-3.75-2.25a1 1 0 0 1-.5-.86V9a1 1 0 0 1 1-1Z"
                            />
                        </svg>
                        <div>
                            <div>{item.label}</div>
                            <p className="note" style={{ margin: 0 }}>{item.description}</p>
                        </div>
                    </NavLink>
                </li>
            ))}
        </ul>
    </nav>
)

export default SidebarNav
