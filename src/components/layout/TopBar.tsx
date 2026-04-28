import { useTheme } from '@/contexts/ThemeContext'

const TopBar = () => {
    const { theme, toggleTheme } = useTheme()

    return (
        <div className="top-bar">
            <div className="top-bar-spacer" />
            <button
                className="theme-toggle"
                onClick={toggleTheme}
                aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                title={`${theme === 'light' ? 'Dark' : 'Light'} mode`}
            >
                {theme === 'light' ? (
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                ) : (
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                )}
            </button>
        </div>
    )
}

export default TopBar
