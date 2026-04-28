import type { ReactNode } from 'react'

interface StatCardProps {
    label: string
    value: ReactNode
    helper?: string
}

const StatCard = ({ label, value, helper }: StatCardProps) => (
    <div className="stat-card">
        <span>{label}</span>
        <strong>{value}</strong>
        {helper ? <p className="note">{helper}</p> : null}
    </div>
)

export default StatCard
