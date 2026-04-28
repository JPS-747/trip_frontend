import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { seedSampleData, type SeedRequest } from '@/services/seedService'
import { clearTrips } from '@/services/tripService'
import { clearClients } from '@/services/clientService'
import { clearHolidays } from '@/services/holidayService'
import { getVehicles, type VehicleRecord } from '@/services/vehicleService'
import { useApiConfig } from '@/contexts/ApiConfigContext'
import Modal from '@/components/ui/Modal'
import SeedingProgressPopup from '@/components/ui/SeedingProgressPopup'
import { Loader } from '@/components/ui/Loader'

const settingsCardStyle = {
    borderRadius: '0.5rem',
    padding: '1.25rem',
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--text-primary)',
}

const SeedDataPage = () => {
    const { apiBaseUrl } = useApiConfig()
    const queryClient = useQueryClient()

    const [isLoading, setIsLoading] = useState(false)
    const [isClearing, setIsClearing] = useState(false)
    const [isClearingClients, setIsClearingClients] = useState(false)
    const [isClearingHolidays, setIsClearingHolidays] = useState(false)
    const [isClearModalOpen, setIsClearModalOpen] = useState(false)
    const [isProgressPopupOpen, setIsProgressPopupOpen] = useState(false)
    const [clearDateRange, setClearDateRange] = useState({ startDate: '', endDate: '' })
    const [selectedVehicles, setSelectedVehicles] = useState<string[]>([])

    const { data: vehiclesResponse, isLoading: vehiclesLoading } = useQuery<VehicleRecord[]>({
        queryKey: ['vehicles', apiBaseUrl],
        queryFn: () => getVehicles(apiBaseUrl),
    })

    const activeVehicles = (vehiclesResponse ?? []).filter((vehicle) => !vehicle.isDisabled)

    const seedMutation = useMutation({
        mutationFn: async (formData: FormData) => {
            const payload: SeedRequest = {
                startDate: (formData.get('startDate') as string) || null,
                endDate: (formData.get('endDate') as string) || null,
                weekdayMinTripsPerDay: parseInt(formData.get('weekdayMinTripsPerDay') as string, 10) ?? 0,
                weekdayMaxTripsPerDay: parseInt(formData.get('weekdayMaxTripsPerDay') as string, 10) ?? 7,
                weekdayAvgDistancePerMonth: formData.get('weekdayAvgDistancePerMonth')
                    ? parseFloat(formData.get('weekdayAvgDistancePerMonth') as string)
                    : null,
                saturdayMinTripsPerDay: parseInt(formData.get('saturdayMinTripsPerDay') as string, 10) ?? 0,
                saturdayMaxTripsPerDay: parseInt(formData.get('saturdayMaxTripsPerDay') as string, 10) ?? 2,
                saturdayAvgDistancePerMonth: formData.get('saturdayAvgDistancePerMonth')
                    ? parseFloat(formData.get('saturdayAvgDistancePerMonth') as string)
                    : null,
                sundayMinTripsPerDay: parseInt(formData.get('sundayMinTripsPerDay') as string, 10) ?? 0,
                sundayMaxTripsPerDay: parseInt(formData.get('sundayMaxTripsPerDay') as string, 10) ?? 1,
                sundayAvgDistancePerMonth: formData.get('sundayAvgDistancePerMonth')
                    ? parseFloat(formData.get('sundayAvgDistancePerMonth') as string)
                    : null,
                holidayMinTripsPerDay: parseInt(formData.get('holidayMinTripsPerDay') as string, 10) ?? 0,
                holidayMaxTripsPerDay: parseInt(formData.get('holidayMaxTripsPerDay') as string, 10) ?? 3,
                holidayAvgDistancePerMonth: formData.get('holidayAvgDistancePerMonth')
                    ? parseFloat(formData.get('holidayAvgDistancePerMonth') as string)
                    : null,
                useSeasonalMultiplier: formData.get('useSeasonalMultiplier') === 'on',
                seasonalPeakMonth: parseFloat(formData.get('seasonalPeakMonth') as string) ?? 5.5,
                seasonalSpread: parseFloat(formData.get('seasonalSpread') as string) ?? 1.8,
                selectedVehicles: selectedVehicles.length > 0 ? selectedVehicles : null,
            }

            return seedSampleData(payload, apiBaseUrl)
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['trips', apiBaseUrl] })
            await queryClient.invalidateQueries({ queryKey: ['trips-summary', apiBaseUrl] })
            await queryClient.invalidateQueries({ queryKey: ['clients', apiBaseUrl] })
            setIsLoading(false)
            // Progress popup will auto-close on completion
        },
        onError: (error: Error) => {
            alert(`Error seeding data: ${error.message}`)
            setIsLoading(false)
            setIsProgressPopupOpen(false)
        },
    })

    const handleVehicleToggle = (event: ChangeEvent<HTMLInputElement>) => {
        const regNumber = event.target.value
        setSelectedVehicles((prev) =>
            event.target.checked ? [...prev, regNumber] : prev.filter((v) => v !== regNumber),
        )
    }

    const handleSelectAllVehicles = () => {
        const allVehicleReg = activeVehicles.map((v) => v.regNumber)
        setSelectedVehicles(selectedVehicles.length === activeVehicles.length ? [] : allVehicleReg)
    }

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setIsLoading(true)
        setIsProgressPopupOpen(true)
        const formData = new FormData(event.currentTarget)
        seedMutation.mutate(formData)
    }

    const handleClearTrips = async () => {
        const message = clearDateRange.startDate || clearDateRange.endDate
            ? `Clear trips from ${clearDateRange.startDate || 'any date'} to ${clearDateRange.endDate || 'any date'}? This action cannot be undone.`
            : 'Clear all trips? This action cannot be undone.'

        const confirmed = window.confirm(message)
        if (!confirmed) return
        try {
            setIsClearing(true)
            await clearTrips(apiBaseUrl, clearDateRange.startDate || undefined, clearDateRange.endDate || undefined)
            await queryClient.invalidateQueries({ queryKey: ['trips', apiBaseUrl] })
            alert('Trips cleared successfully.')
            setIsClearModalOpen(false)
            setClearDateRange({ startDate: '', endDate: '' })
        } catch (error) {
            const errMessage = error instanceof Error ? error.message : 'Failed to clear trips.'
            alert(`Error: ${errMessage}`)
        } finally {
            setIsClearing(false)
        }
    }

    const handleClearClients = async () => {
        const confirmed = window.confirm('Clear all clients? This action cannot be undone.')
        if (!confirmed) return
        try {
            setIsClearingClients(true)
            await clearClients(apiBaseUrl)
            queryClient.invalidateQueries({ queryKey: ['clients', apiBaseUrl] })
            alert('All clients cleared.')
        } catch (error) {
            const errMessage = error instanceof Error ? error.message : 'Failed to clear clients.'
            alert(`Error: ${errMessage}`)
        } finally {
            setIsClearingClients(false)
        }
    }

    const handleClearHolidays = async () => {
        const confirmed = window.confirm('Clear all public holidays? This action cannot be undone.')
        if (!confirmed) return
        try {
            setIsClearingHolidays(true)
            await clearHolidays(apiBaseUrl)
            queryClient.invalidateQueries({ queryKey: ['holidays', apiBaseUrl] })
            alert('All public holidays cleared.')
        } catch (error) {
            const errMessage = error instanceof Error ? error.message : 'Failed to clear holidays.'
            alert(`Error: ${errMessage}`)
        } finally {
            setIsClearingHolidays(false)
        }
    }

    return (
        <div className="page-content">
            {isLoading && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                    }}
                >
                    <div
                        style={{
                            backgroundColor: 'var(--bg-primary)',
                            borderRadius: '0.5rem',
                            padding: '2rem',
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                        }}
                    >
                        <Loader message="Seeding sample data..." />
                    </div>
                </div>
            )}

            <section className="panel">
                <h2>Seed Sample Data</h2>
                <p className="subtitle">Configure settings to generate realistic sample data for testing.</p>

                <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '2rem' }}>
                    <div style={settingsCardStyle}>
                        <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Select Vehicles</h3>
                        {vehiclesLoading && <p style={{ color: 'var(--text-muted)' }}>Loading vehicles...</p>}
                        {!vehiclesLoading && activeVehicles.length === 0 && (
                            <p style={{ color: 'var(--text-muted)' }}>No active vehicles available.</p>
                        )}
                        {!vehiclesLoading && activeVehicles.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label className="checkbox-field" style={{ marginBottom: '0.5rem', fontWeight: 600 }}>
                                    <input
                                        type="checkbox"
                                        checked={selectedVehicles.length === activeVehicles.length}
                                        onChange={handleSelectAllVehicles}
                                        disabled={isLoading}

                                    />
                                    Select All ({activeVehicles.length})
                                </label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginLeft: '1.5rem' }}>
                                    {activeVehicles.map((vehicle) => (
                                        <label key={vehicle.regNumber} className="checkbox-field">
                                            <input
                                                type="checkbox"
                                                value={vehicle.regNumber}
                                                checked={selectedVehicles.includes(vehicle.regNumber)}
                                                onChange={handleVehicleToggle}
                                                disabled={isLoading}

                                            />
                                            {vehicle.regNumber} · {vehicle.make} {vehicle.model}
                                            {vehicle.year && ` (${vehicle.year})`}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                        <p style={{ margin: '1rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            Selected: {selectedVehicles.length} vehicle{selectedVehicles.length !== 1 ? 's' : ''}
                        </p>
                    </div>

                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                            gap: '1.5rem',
                        }}
                    >
                        <div style={settingsCardStyle}>
                            <h4 style={{ marginTop: 0, marginBottom: '1rem' }}>Date Range</h4>
                            <div className="form-grid" style={{ gap: '1rem' }}>
                                <label>
                                    Start date
                                    <input type="date" name="startDate" defaultValue="2018-03-01" disabled={isLoading} />
                                </label>
                                <label>
                                    End date
                                    <input type="date" name="endDate" defaultValue="2019-02-28" disabled={isLoading} />
                                </label>
                            </div>
                        </div>

                        <div style={settingsCardStyle}>
                            <h4 style={{ marginTop: 0, marginBottom: '1rem' }}>Seasonal Variation</h4>
                            <div className="form-grid" style={{ gap: '1rem' }}>
                                <label className="checkbox-field">
                                    <input
                                        name="useSeasonalMultiplier"
                                        type="checkbox"
                                        defaultChecked
                                        disabled={isLoading}
                                    />
                                    Apply seasonal multiplier
                                </label>
                                <label>
                                    Peak month (0-11)
                                    <input
                                        name="seasonalPeakMonth"
                                        type="number"
                                        min={0}
                                        max={11}
                                        step={0.1}
                                        defaultValue={5.5}
                                        disabled={isLoading}
                                    />
                                </label>
                                <label>
                                    Spread
                                    <input
                                        name="seasonalSpread"
                                        type="number"
                                        min={0.1}
                                        max={6}
                                        step={0.1}
                                        defaultValue={1.8}
                                        disabled={isLoading}
                                    />
                                </label>
                            </div>
                        </div>

                        <div style={settingsCardStyle}>
                            <h4 style={{ marginTop: 0, marginBottom: '1rem' }}>Weekdays</h4>
                            <div className="form-grid" style={{ gap: '1rem' }}>
                                <label>
                                    Min trips/day
                                    <input
                                        name="weekdayMinTripsPerDay"
                                        type="number"
                                        min={0}
                                        max={50}
                                        defaultValue={0}
                                        disabled={isLoading}
                                    />
                                </label>
                                <label>
                                    Max trips/day
                                    <input
                                        name="weekdayMaxTripsPerDay"
                                        type="number"
                                        min={0}
                                        max={50}
                                        defaultValue={4}
                                        disabled={isLoading}
                                    />
                                </label>
                                <label>
                                    Avg distance / month (km)
                                    <input
                                        name="weekdayAvgDistancePerMonth"
                                        type="number"
                                        min={0}
                                        step={1}
                                        defaultValue={2800}
                                        disabled={isLoading}
                                    />
                                </label>
                            </div>
                        </div>

                        <div style={settingsCardStyle}>
                            <h4 style={{ marginTop: 0, marginBottom: '1rem' }}>Saturdays</h4>
                            <div className="form-grid" style={{ gap: '1rem' }}>
                                <label>
                                    Min trips/day
                                    <input
                                        name="saturdayMinTripsPerDay"
                                        type="number"
                                        min={0}
                                        max={50}
                                        defaultValue={0}
                                        disabled={isLoading}
                                    />
                                </label>
                                <label>
                                    Max trips/day
                                    <input
                                        name="saturdayMaxTripsPerDay"
                                        type="number"
                                        min={0}
                                        max={50}
                                        defaultValue={1}
                                        disabled={isLoading}
                                    />
                                </label>
                                <label>
                                    Avg distance / month (km)
                                    <input
                                        name="saturdayAvgDistancePerMonth"
                                        type="number"
                                        min={0}
                                        step={1}
                                        defaultValue={120}
                                        disabled={isLoading}
                                    />
                                </label>
                            </div>
                        </div>

                        <div style={settingsCardStyle}>
                            <h4 style={{ marginTop: 0, marginBottom: '1rem' }}>Sundays</h4>
                            <div className="form-grid" style={{ gap: '1rem' }}>
                                <label>
                                    Min trips/day
                                    <input
                                        name="sundayMinTripsPerDay"
                                        type="number"
                                        min={0}
                                        max={50}
                                        defaultValue={0}
                                        disabled={isLoading}
                                    />
                                </label>
                                <label>
                                    Max trips/day
                                    <input
                                        name="sundayMaxTripsPerDay"
                                        type="number"
                                        min={0}
                                        max={50}
                                        defaultValue={1}
                                        disabled={isLoading}
                                    />
                                </label>
                                <label>
                                    Avg distance / month (km)
                                    <input
                                        name="sundayAvgDistancePerMonth"
                                        type="number"
                                        min={0}
                                        step={1}
                                        defaultValue={120}
                                        disabled={isLoading}
                                    />
                                </label>
                            </div>
                        </div>

                        <div style={settingsCardStyle}>
                            <h4 style={{ marginTop: 0, marginBottom: '1rem' }}>Holidays</h4>
                            <div className="form-grid" style={{ gap: '1rem' }}>
                                <label>
                                    Min trips/day
                                    <input
                                        name="holidayMinTripsPerDay"
                                        type="number"
                                        min={0}
                                        max={50}
                                        defaultValue={0}
                                        disabled={isLoading}
                                    />
                                </label>
                                <label>
                                    Max trips/day
                                    <input
                                        name="holidayMaxTripsPerDay"
                                        type="number"
                                        min={0}
                                        max={50}
                                        defaultValue={1}
                                        disabled={isLoading}
                                    />
                                </label>
                                <label>
                                    Avg distance / month (km)
                                    <input
                                        name="holidayAvgDistancePerMonth"
                                        type="number"
                                        min={0}
                                        step={1}
                                        defaultValue={120}
                                        disabled={isLoading}
                                    />
                                </label>
                            </div>
                        </div>
                    </div>

                    <div
                        style={{
                            display: 'flex',
                            gap: '1rem',
                            flexWrap: 'wrap',
                            paddingTop: '1rem',
                            borderTop: '1px solid var(--border)',
                        }}
                    >
                        <button className="button secondary" type="submit" disabled={isLoading}>
                            {isLoading ? 'Seeding...' : 'Seed sample data'}
                        </button>
                        <button
                            className="button ghost"
                            type="button"
                            onClick={() => setIsClearModalOpen(true)}
                            disabled={isClearing}
                        >
                            {isClearing ? 'Clearing…' : 'Clear trips'}
                        </button>
                        <button
                            className="button ghost"
                            type="button"
                            onClick={handleClearClients}
                            disabled={isClearingClients}
                        >
                            {isClearingClients ? 'Clearing…' : 'Clear clients'}
                        </button>
                        <button
                            className="button ghost"
                            type="button"
                            onClick={handleClearHolidays}
                            disabled={isClearingHolidays}
                        >
                            {isClearingHolidays ? 'Clearing…' : 'Clear holidays'}
                        </button>
                    </div>
                </form>
            </section>

            <Modal isOpen={isClearModalOpen} onClose={() => setIsClearModalOpen(false)} title="Clear Trips">
                <form
                    onSubmit={(e) => {
                        e.preventDefault()
                        handleClearTrips()
                    }}
                    style={{ display: 'grid', gap: '1rem' }}
                >
                    <p>Specify a date range to clear trips from. Leave fields empty to clear all trips.</p>
                    <label>
                        Start Date (optional)
                        <input
                            type="date"
                            value={clearDateRange.startDate}
                            onChange={(e) => setClearDateRange((prev) => ({ ...prev, startDate: e.target.value }))}
                        />
                    </label>
                    <label>
                        End Date (optional)
                        <input
                            type="date"
                            value={clearDateRange.endDate}
                            onChange={(e) => setClearDateRange((prev) => ({ ...prev, endDate: e.target.value }))}
                        />
                    </label>
                    <p style={{ fontSize: '0.875rem', opacity: 0.7 }}>
                        {clearDateRange.startDate || clearDateRange.endDate
                            ? `Will clear trips from ${clearDateRange.startDate || 'any date'} to ${clearDateRange.endDate || 'any date'}`
                            : 'Will clear ALL trips from the database'}
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button
                            type="button"
                            className="button secondary"
                            onClick={() => {
                                setIsClearModalOpen(false)
                                setClearDateRange({ startDate: '', endDate: '' })
                            }}
                        >
                            Cancel
                        </button>
                        <button type="submit" className="button" disabled={isClearing}>
                            {isClearing ? 'Clearing…' : 'Clear Trips'}
                        </button>
                    </div>
                </form>
            </Modal>

            <SeedingProgressPopup
                isOpen={isProgressPopupOpen}
                onClose={() => setIsProgressPopupOpen(false)}
                apiBaseUrl={apiBaseUrl}
            />
        </div>
    )
}

export default SeedDataPage
