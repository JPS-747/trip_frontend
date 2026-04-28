import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useApiConfig } from '@/contexts/ApiConfigContext'
import Modal from '@/components/ui/Modal'
import {
    deleteVehicle,
    getVehicles,
    saveVehicle,
    updateVehicleStatus,
} from '@/services/vehicleService'
import type { VehicleRecord } from '@/services/vehicleService'

type StatusTone = 'default' | 'success' | 'error'

type FormState = {
    regNumber: string
    make: string
    model: string
    year: string
    kmPerLiter: string
    currentOdometer: string
    ratePerKm: string
    isDisabled: boolean
}

const emptyFormState: FormState = {
    regNumber: '',
    make: '',
    model: '',
    year: '',
    kmPerLiter: '',
    currentOdometer: '',
    ratePerKm: '',
    isDisabled: false,
}

const VehicleSetupPage = () => {
    const queryClient = useQueryClient()
    const { apiBaseUrl } = useApiConfig()
    const [status, setStatus] = useState<string>('Ready to manage vehicles.')
    const [statusTone, setStatusTone] = useState<StatusTone>('default')
    const [formState, setFormState] = useState<FormState>(emptyFormState)
    const [editingRegNumber, setEditingRegNumber] = useState<string | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [busyDeletingVehicle, setBusyDeletingVehicle] = useState<string | null>(null)
    const [busyTogglingVehicle, setBusyTogglingVehicle] = useState<string | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [vehiclesSortBy, setVehiclesSortBy] = useState<string>('regNumber')
    const [vehiclesSortOrder, setVehiclesSortOrder] = useState<'asc' | 'desc'>('asc')

    const {
        data: vehicles = [],
        isLoading: isVehiclesLoading,
        isError: isVehiclesError,
        error: vehiclesError,
    } = useQuery({
        queryKey: ['vehicles', apiBaseUrl],
        queryFn: () => getVehicles(apiBaseUrl),
    })

    // Sort vehicles
    const sortedVehicles = [...vehicles].sort((a, b) => {
        let aVal: any = a[vehiclesSortBy as keyof VehicleRecord]
        let bVal: any = b[vehiclesSortBy as keyof VehicleRecord]

        if (aVal == null) aVal = ''
        if (bVal == null) bVal = ''

        if (typeof aVal === 'string') {
            aVal = aVal.toLowerCase()
            bVal = (bVal as string).toLowerCase()
        }

        if (aVal < bVal) return vehiclesSortOrder === 'asc' ? -1 : 1
        if (aVal > bVal) return vehiclesSortOrder === 'asc' ? 1 : -1
        return 0
    })

    const updateStatus = (message: string, tone: StatusTone = 'default') => {
        setStatus(message)
        setStatusTone(tone)
    }

    const handleSortByColumn = (columnName: string) => {
        if (vehiclesSortBy === columnName) {
            // Toggle order if same column clicked
            setVehiclesSortOrder(vehiclesSortOrder === 'asc' ? 'desc' : 'asc')
        } else {
            // Set new column, default to ascending
            setVehiclesSortBy(columnName)
            setVehiclesSortOrder('asc')
        }
    }

    const getSortIndicator = (columnName: string) => {
        if (vehiclesSortBy !== columnName) return ''
        return vehiclesSortOrder === 'asc' ? ' ↑' : ' ↓'
    }

    const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = event.target
        setFormState((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }))
    }

    const resetForm = () => {
        setFormState(emptyFormState)
        setEditingRegNumber(null)
    }

    const handleCloseModal = () => {
        resetForm()
        setIsModalOpen(false)
    }

    const handleOpenCreateModal = () => {
        resetForm()
        setIsModalOpen(true)
        updateStatus('Adding a new vehicle.')
        setStatusTone('default')
    }

    const handleEditVehicle = (vehicleRecord: VehicleRecord) => {
        setFormState({
            regNumber: vehicleRecord.regNumber,
            make: vehicleRecord.make,
            model: vehicleRecord.model,
            year: vehicleRecord.year ? vehicleRecord.year.toString() : '',
            kmPerLiter: vehicleRecord.kmPerLiter.toString(),
            currentOdometer: vehicleRecord.currentOdometer ? vehicleRecord.currentOdometer.toString() : '',
            ratePerKm: vehicleRecord.ratePerKm ? vehicleRecord.ratePerKm.toString() : '',
            isDisabled: Boolean(vehicleRecord.isDisabled),
        })
        setEditingRegNumber(vehicleRecord.regNumber)
        updateStatus(`Editing "${vehicleRecord.regNumber}".`)
        setStatusTone('default')
        setIsModalOpen(true)
    }

    const handleFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        const regNumber = formState.regNumber.trim()
        const make = formState.make.trim()
        const model = formState.model.trim()
        const kmlValue = Number.parseFloat(formState.kmPerLiter)
        const year = formState.year ? Number.parseInt(formState.year, 10) : undefined
        const odometerValue = formState.currentOdometer ? Number.parseFloat(formState.currentOdometer) : undefined
        const rateValue = formState.ratePerKm ? Number.parseFloat(formState.ratePerKm) : undefined

        if (!regNumber || !make || !model) {
            updateStatus('Please provide registration number, make, and model.', 'error')
            return
        }

        if (!Number.isFinite(kmlValue)) {
            updateStatus('Please provide a valid KM per liter value.', 'error')
            return
        }

        try {
            setIsSaving(true)
            updateStatus(`Saving "${regNumber}"…`)
            await saveVehicle(
                {
                    regNumber,
                    make,
                    model,
                    year: year || null,
                    kmPerLiter: kmlValue,
                    currentOdometer: odometerValue || null,
                    ratePerKm: rateValue || null,
                    isDisabled: formState.isDisabled,
                },
                apiBaseUrl,
            )
            updateStatus(`Saved "${regNumber}".`, 'success')
            await queryClient.invalidateQueries({ queryKey: ['vehicles', apiBaseUrl] })
            handleCloseModal()
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to save vehicle.'
            updateStatus(message, 'error')
        } finally {
            setIsSaving(false)
        }
    }

    const handleDeleteVehicle = async (vehicleRecord: VehicleRecord) => {
        const regNumber = vehicleRecord.regNumber
        const shouldDelete = window.confirm(
            `Delete "${regNumber}"? This action cannot be undone.`,
        )
        if (!shouldDelete) return

        try {
            setBusyDeletingVehicle(regNumber)
            updateStatus(`Deleting "${regNumber}"…`)
            await deleteVehicle(regNumber, apiBaseUrl)
            updateStatus(`Deleted "${regNumber}".`, 'success')
            await queryClient.invalidateQueries({ queryKey: ['vehicles', apiBaseUrl] })
            if (editingRegNumber === regNumber) {
                handleCloseModal()
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to delete vehicle.'
            updateStatus(message, 'error')
        } finally {
            setBusyDeletingVehicle(null)
        }
    }

    const handleToggleVehicleStatus = async (vehicleRecord: VehicleRecord) => {
        const regNumber = vehicleRecord.regNumber
        const nextDisabledState = !vehicleRecord.isDisabled
        try {
            setBusyTogglingVehicle(regNumber)
            updateStatus(
                `${nextDisabledState ? 'Disabling' : 'Enabling'} "${regNumber}"…`,
            )
            await updateVehicleStatus(regNumber, nextDisabledState, apiBaseUrl)
            updateStatus(
                `${nextDisabledState ? 'Disabled' : 'Enabled'} "${regNumber}".`,
                'success',
            )
            await queryClient.invalidateQueries({ queryKey: ['vehicles', apiBaseUrl] })
            if (editingRegNumber === regNumber) {
                setFormState((prev) => ({ ...prev, isDisabled: nextDisabledState }))
            }
        } catch (error) {
            const message =
                error instanceof Error ? error.message : 'Failed to update vehicle status.'
            updateStatus(message, 'error')
        } finally {
            setBusyTogglingVehicle(null)
        }
    }

    return (
        <div className="page-content">
            <section className="panel">
                <h2>Vehicle actions</h2>
                <p className="subtitle">Add or manage vehicle details and efficiency ratings.</p>
                <div className="action-row">
                    <button className="button" type="button" onClick={handleOpenCreateModal}>
                        Add vehicle
                    </button>
                </div>
                <p
                    className="status-text"
                    style={{
                        marginTop: 16,
                        color:
                            statusTone === 'error'
                                ? 'var(--danger)'
                                : statusTone === 'success'
                                    ? 'var(--accent)'
                                    : 'var(--text-muted)',
                    }}
                >
                    {status}
                </p>
            </section>

            <section className="panel">
                <h2>Vehicles</h2>
                <p className="subtitle">
                    {isVehiclesLoading && 'Loading vehicles from the API…'}
                    {isVehiclesError && `Failed to load vehicles: ${(vehiclesError as Error)?.message ?? 'Unknown error'}`}
                    {!isVehiclesLoading && !isVehiclesError && `Showing ${sortedVehicles.length} vehicle(s).`}
                </p>
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSortByColumn('regNumber')}>
                                    Registration{getSortIndicator('regNumber')}
                                </th>
                                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSortByColumn('make')}>
                                    Make{getSortIndicator('make')}
                                </th>
                                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSortByColumn('model')}>
                                    Model{getSortIndicator('model')}
                                </th>
                                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSortByColumn('year')}>
                                    Year{getSortIndicator('year')}
                                </th>
                                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSortByColumn('kmPerLiter')}>
                                    KM/L{getSortIndicator('kmPerLiter')}
                                </th>
                                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSortByColumn('currentOdometer')}>
                                    Current Odometer{getSortIndicator('currentOdometer')}
                                </th>
                                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSortByColumn('ratePerKm')}>
                                    Rate/KM{getSortIndicator('ratePerKm')}
                                </th>
                                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSortByColumn('isDisabled')}>
                                    Status{getSortIndicator('isDisabled')}
                                </th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isVehiclesLoading && (
                                <tr>
                                    <td colSpan={9} style={{ textAlign: 'center', padding: '32px 0' }}>
                                        Loading…
                                    </td>
                                </tr>
                            )}
                            {isVehiclesError && (
                                <tr>
                                    <td colSpan={9} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--danger)' }}>
                                        Unable to load vehicles.
                                    </td>
                                </tr>
                            )}
                            {!isVehiclesLoading && !isVehiclesError && sortedVehicles.length === 0 && (
                                <tr>
                                    <td colSpan={9} style={{ textAlign: 'center', padding: '32px 0' }}>
                                        No vehicles yet. Add a record to get started.
                                    </td>
                                </tr>
                            )}
                            {!isVehiclesLoading && !isVehiclesError &&
                                sortedVehicles.map((vehicle) => {
                                    const yearText = vehicle.year ? vehicle.year.toString() : '—'
                                    const kmlText =
                                        vehicle.kmPerLiter > 0
                                            ? `${vehicle.kmPerLiter.toFixed(2)} km/l`
                                            : '—'
                                    const odometerText =
                                        vehicle.currentOdometer && vehicle.currentOdometer > 0
                                            ? `${vehicle.currentOdometer.toFixed(1)} km`
                                            : '—'
                                    const rateText =
                                        vehicle.ratePerKm && vehicle.ratePerKm > 0
                                            ? `R${vehicle.ratePerKm.toFixed(2)}`
                                            : '—'
                                    return (
                                        <tr key={vehicle.regNumber} style={vehicle.isDisabled ? { opacity: 0.7 } : undefined}>
                                            <td>{vehicle.regNumber}</td>
                                            <td>{vehicle.make}</td>
                                            <td>{vehicle.model}</td>
                                            <td>{yearText}</td>
                                            <td>{kmlText}</td>
                                            <td>{odometerText}</td>
                                            <td>{rateText}</td>
                                            <td>
                                                <span
                                                    style={{
                                                        display: 'inline-flex',
                                                        padding: '2px 8px',
                                                        borderRadius: 999,
                                                        background: vehicle.isDisabled
                                                            ? 'var(--danger-muted, rgba(220, 38, 38, 0.12))'
                                                            : 'var(--accent-muted, rgba(34, 197, 94, 0.15))',
                                                        color: vehicle.isDisabled ? 'var(--danger)' : 'var(--accent)',
                                                        fontSize: 12,
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    {vehicle.isDisabled ? 'Disabled' : 'Active'}
                                                </span>
                                            </td>
                                            <td className="action-row" style={{ gap: 8 }}>
                                                <button
                                                    className="button secondary"
                                                    type="button"
                                                    onClick={() => handleEditVehicle(vehicle)}
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    className="button secondary"
                                                    type="button"
                                                    onClick={() => handleDeleteVehicle(vehicle)}
                                                    disabled={busyDeletingVehicle === vehicle.regNumber}
                                                >
                                                    {busyDeletingVehicle === vehicle.regNumber ? 'Deleting…' : 'Delete'}
                                                </button>
                                                <button
                                                    className="button secondary"
                                                    type="button"
                                                    onClick={() => handleToggleVehicleStatus(vehicle)}
                                                    disabled={busyTogglingVehicle === vehicle.regNumber}
                                                >
                                                    {busyTogglingVehicle === vehicle.regNumber
                                                        ? vehicle.isDisabled
                                                            ? 'Enabling…'
                                                            : 'Disabling…'
                                                        : vehicle.isDisabled
                                                            ? 'Enable'
                                                            : 'Disable'}
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                        </tbody>
                    </table>
                </div>
            </section>

            <Modal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title={editingRegNumber ? `Edit ${editingRegNumber}` : 'Add vehicle'}
            >
                <form className="form-grid" onSubmit={handleFormSubmit}>
                    <label>
                        Registration number
                        <input
                            name="regNumber"
                            placeholder="ABC 123 GP"
                            value={formState.regNumber}
                            onChange={handleInputChange}
                            required
                            disabled={editingRegNumber !== null}
                        />
                    </label>
                    <label>
                        Make
                        <input
                            name="make"
                            placeholder="Toyota"
                            value={formState.make}
                            onChange={handleInputChange}
                            required
                        />
                    </label>
                    <label>
                        Model
                        <input
                            name="model"
                            placeholder="Corolla"
                            value={formState.model}
                            onChange={handleInputChange}
                            required
                        />
                    </label>
                    <label>
                        Year (optional)
                        <input
                            name="year"
                            type="number"
                            min={1900}
                            max={2100}
                            placeholder="2020"
                            value={formState.year}
                            onChange={handleInputChange}
                        />
                    </label>
                    <label>
                        KM per liter
                        <input
                            name="kmPerLiter"
                            type="number"
                            min={0}
                            step={0.1}
                            placeholder="7.5"
                            value={formState.kmPerLiter}
                            onChange={handleInputChange}
                            required
                        />
                    </label>
                    <label>
                        Current odometer (optional)
                        <input
                            name="currentOdometer"
                            type="number"
                            min={0}
                            step={0.1}
                            placeholder="0"
                            value={formState.currentOdometer}
                            onChange={handleInputChange}
                        />
                    </label>
                    <label>
                        Rate per km (optional)
                        <input
                            name="ratePerKm"
                            type="number"
                            min={0}
                            step={0.01}
                            placeholder="4.50"
                            value={formState.ratePerKm}
                            onChange={handleInputChange}
                        />
                    </label>
                    <label className="checkbox" style={{ alignSelf: 'end' }}>
                        <input
                            type="checkbox"
                            name="isDisabled"
                            checked={formState.isDisabled}
                            onChange={handleInputChange}
                        />{' '}
                        Disabled
                    </label>
                    <div className="action-row" style={{ gridColumn: '1 / -1' }}>
                        <button className="button" type="submit" disabled={isSaving}>
                            {isSaving ? 'Saving…' : editingRegNumber ? 'Update vehicle' : 'Save vehicle'}
                        </button>
                        <button
                            className="button secondary"
                            type="button"
                            onClick={handleCloseModal}
                            disabled={isSaving}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}

export default VehicleSetupPage
