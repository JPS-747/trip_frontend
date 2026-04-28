import { Link } from 'react-router-dom'

const NotFoundPage = () => (
    <section className="panel">
        <h2>Page not found</h2>
        <p className="subtitle">Select a page from the sidebar or head back to the dashboard.</p>
        <Link className="button" to="/">
            Back to dashboard
        </Link>
    </section>
)

export default NotFoundPage
