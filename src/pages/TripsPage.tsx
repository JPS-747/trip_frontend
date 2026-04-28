import { useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useApiConfig } from '@/contexts/ApiConfigContext'
import Modal from '@/components/ui/Modal'
import {
    clearTrips,
    createTrip,
    defaultTripQueryState,
    deleteTrip,
    getTrips,
    updateTrip,
} from '@/services/tripService'
import type { TripListResponse, TripQueryState, TripRecord } from '@/services/tripService'
import { getClients } from '@/services/clientService'
import type { ClientRecord } from '@/services/clientService'
import { getVehicles } from '@/services/vehicleService'
import type { VehicleRecord } from '@/services/vehicleService'

type StatusTone = 'default' | 'success' | 'error'

type FiltersFormState = {
    client: string
    dayType: string
    tripType: string
    sortBy: string
    sortOrder: 'asc' | 'desc'
}

const defaultFiltersFormState: FiltersFormState = {
    client: '',
    dayType: '',
    tripType: '',
    sortBy: 'date',
    sortOrder: 'asc',
}

type TripEditorFormState = {
    date: string
    client: string
    city: string
    distanceKm: string
    tripType: string
    isPrivateTrip: boolean
    vehicleRegNumber: string
}

const emptyTripEditorFormState: TripEditorFormState = {
    date: '',
    client: '',
    city: '',
    distanceKm: '',
    tripType: '1',
    isPrivateTrip: false,
    vehicleRegNumber: '',
}

type TripCreateFormState = {
    date: string
    client: string
    city: string
    distanceKm: string
    tripType: string
    isPrivateTrip: boolean
    vehicleRegNumber: string
}

const emptyTripCreateFormState: TripCreateFormState = {
    date: '',
    client: '',
    city: '',
    distanceKm: '',
    tripType: '1',
    isPrivateTrip: false,
    vehicleRegNumber: '',
}

const TripsPage = () => {
    const queryClient = useQueryClient()
    const { apiBaseUrl } = useApiConfig()

    const [filters, setFilters] = useState<TripQueryState>(defaultTripQueryState)
    const [_formState, setFormState] = useState<FiltersFormState>(defaultFiltersFormState)
    const [editingTrip, setEditingTrip] = useState<TripRecord | null>(null)
    const [editorState, setEditorState] = useState<TripEditorFormState>(emptyTripEditorFormState)
    const [_status, setStatus] = useState('Ready to browse trips.')
    const [_statusTone, setStatusTone] = useState<StatusTone>('default')
    const [isClearing, setIsClearing] = useState(false)
    const [isClearModalOpen, setIsClearModalOpen] = useState(false)
    const [clearDateRange, setClearDateRange] = useState({ startDate: '', endDate: '' })
    const [isUpdatingTrip, setIsUpdatingTrip] = useState(false)
    const [deletingTripId, setDeletingTripId] = useState<number | null>(null)
    const [isEditorModalOpen, setIsEditorModalOpen] = useState(false)
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [createState, setCreateState] = useState<TripCreateFormState>(emptyTripCreateFormState)
    const [isCreatingTrip, setIsCreatingTrip] = useState(false)

    const { data, isLoading, isError, error, isFetching } = useQuery<TripListResponse>({
        queryKey: ['trips', apiBaseUrl, filters],
        queryFn: () => getTrips(filters, apiBaseUrl),
        placeholderData: (previousData) => previousData,
    })

    const trips: TripRecord[] = data?.items ?? []

    const { data: clientsResponse } = useQuery({
        queryKey: ['clients', apiBaseUrl],
        queryFn: () => getClients(apiBaseUrl, 1, 1000),
    })

    const clients: ClientRecord[] = clientsResponse?.items ?? []
    const enabledClients = clients.filter((c) => !c.isDisabled)

    const { data: vehiclesResponse } = useQuery({
        queryKey: ['vehicles', apiBaseUrl],
        queryFn: () => getVehicles(apiBaseUrl),
    })

    const vehicles: VehicleRecord[] = vehiclesResponse ?? []
    const enabledVehicles = vehicles.filter((v) => !v.isDisabled)

    const updateStatus = (message: string, tone: StatusTone = 'default') => {
        setStatus(message)
        setStatusTone(tone)
    }

    const handlePageChange = (direction: 'previous' | 'next') => {
        if (!data) return
        setFilters((prev) => {
            const nextPage = direction === 'previous' ? prev.page - 1 : prev.page + 1
            const clampedPage = Math.max(1, Math.min(nextPage, data.totalPages || 1))
            if (clampedPage === prev.page) {
                return prev
            }
            return { ...prev, page: clampedPage }
        })
    }

    const handleSortByColumn = (columnName: string) => {
        // Reset to page 1 when sorting changes
        setFilters((prev) => {
            if (prev.sortBy === columnName) {
                // Toggle order if same column clicked
                return {
                    ...prev,
                    page: 1,
                    sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc',
                }
            } else {
                // Set new column, default to ascending
                return {
                    ...prev,
                    page: 1,
                    sortBy: columnName,
                    sortOrder: 'asc',
                }
            }
        })
    }

    const getSortIndicator = (columnName: string) => {
        if (filters.sortBy !== columnName) return ''
        return filters.sortOrder === 'asc' ? ' ↑' : ' ↓'
    }

    const handleClearTrips = async () => {
        const message = clearDateRange.startDate || clearDateRange.endDate
            ? `Clear trips from ${clearDateRange.startDate || 'any date'} to ${clearDateRange.endDate || 'any date'}? This action cannot be undone.`
            : 'Clear all trips? This action cannot be undone.'

        const confirmed = window.confirm(message)
        if (!confirmed) return
        try {
            setIsClearing(true)
            updateStatus('Clearing trips…')
            await clearTrips(apiBaseUrl, clearDateRange.startDate || undefined, clearDateRange.endDate || undefined)
            updateStatus('Trips cleared successfully.', 'success')
            await queryClient.invalidateQueries({ queryKey: ['trips', apiBaseUrl] })
            await queryClient.invalidateQueries({ queryKey: ['vehicles', apiBaseUrl] })
            setFilters(defaultTripQueryState)
            setFormState(defaultFiltersFormState)
            setIsClearModalOpen(false)
            setClearDateRange({ startDate: '', endDate: '' })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to clear trips.'
            updateStatus(message, 'error')
        } finally {
            setIsClearing(false)
        }
    }

    const handleExportTrips = async () => {
        try {
            updateStatus('Exporting all trips…')

            // Fetch all trips by getting a large page size
            const allTripsResponse = await getTrips(
                {
                    ...filters,
                    page: 1,
                    pageSize: 10000, // Fetch up to 10,000 trips at once
                },
                apiBaseUrl,
            )

            const allTrips = allTripsResponse.items

            if (!allTrips || allTrips.length === 0) {
                updateStatus('No trips to export.', 'error')
                return
            }

            // Create CSV headers
            const headers = [
                'Date',
                'Vehicle',
                'Client',
                'City',
                'Distance',
                'Trip Type',
                'Total Distance',
                'Odometer',
                'Private',
                'Day Type',
            ]

            // Create CSV rows
            const rows = allTrips.map((trip) => [
                trip.date,
                trip.vehicleRegNumber || '',
                trip.client || '',
                trip.city || '',
                trip.distanceKm,
                getTripTypeLabel(trip.tripType),
                trip.totalDistanceKm,
                trip.odometerEnd || '',
                trip.isPrivateTrip ? 'Yes' : 'No',
                getDayTypeLabel(trip),
            ])

            // Combine headers and rows
            const csvContent = [
                headers.join(','),
                ...rows.map((row) =>
                    row
                        .map((cell) => {
                            // Escape quotes and wrap in quotes if contains comma
                            const cellStr = String(cell)
                            return cellStr.includes(',') || cellStr.includes('"')
                                ? `"${cellStr.replace(/"/g, '""')}"`
                                : cellStr
                        })
                        .join(','),
                ),
            ].join('\n')

            // Create blob and download
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
            const link = document.createElement('a')
            const url = URL.createObjectURL(blob)

            link.setAttribute('href', url)
            link.setAttribute('download', `trips-all-${new Date().toISOString().split('T')[0]}.csv`)
            link.style.visibility = 'hidden'

            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)

            updateStatus(`Exported all ${allTrips.length} trips to CSV.`, 'success')
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to export trips.'
            updateStatus(message, 'error')
        }
    }

    const handleOpenCreateModal = () => {
        setCreateState(emptyTripCreateFormState)
        setIsCreateModalOpen(true)
        updateStatus('Adding a new trip.')
        setStatusTone('default')
    }

    const handleCloseCreateModal = () => {
        setCreateState(emptyTripCreateFormState)
        setIsCreateModalOpen(false)
    }

    const handleCreateInputChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const target = event.target
        const { name, value } = target
        const isCheckbox = target instanceof HTMLInputElement && target.type === 'checkbox'

        setCreateState((prev) => {
            const newState = {
                ...prev,
                [name]: isCheckbox ? target.checked : value,
            }

            // Auto-fill city and distance when client is selected
            if (name === 'client' && value) {
                const selectedClient = enabledClients.find((c) => c.client === value)
                if (selectedClient) {
                    newState.city = String(selectedClient.city)
                    newState.distanceKm = String(selectedClient.distanceFromOffice)
                }
            }

            return newState
        })
    }

    const handleCreateTrip = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        if (!createState.date) {
            updateStatus('Please choose a date.', 'error')
            return
        }

        const distanceValue = Number.parseFloat(createState.distanceKm)
        const cityValue = createState.city.trim() || 'Unknown'
        const tripTypeValue = Number.parseInt(createState.tripType, 10)

        if (!Number.isFinite(distanceValue) || distanceValue <= 0) {
            updateStatus('Distance must be greater than 0 km.', 'error')
            return
        }

        if (!Number.isFinite(tripTypeValue) || tripTypeValue < 0 || tripTypeValue > 2) {
            updateStatus('Trip type must be 0 (Private), 1 (One-way), or 2 (Return).', 'error')
            return
        }

        try {
            setIsCreatingTrip(true)
            updateStatus('Saving trip…')
            // Default to "Private Trip" if no client provided
            const clientValue = createState.client.trim() || 'Private Trip'
            await createTrip(
                {
                    date: createState.date,
                    client: clientValue,
                    city: cityValue,
                    distanceKm: distanceValue,
                    tripType: tripTypeValue,
                    isPrivateTrip: createState.isPrivateTrip,
                    vehicleRegNumber: createState.vehicleRegNumber || undefined,
                },
                apiBaseUrl,
            )
            updateStatus('Trip added successfully.', 'success')
            await queryClient.invalidateQueries({ queryKey: ['trips', apiBaseUrl] })
            await queryClient.invalidateQueries({ queryKey: ['vehicles', apiBaseUrl] })
            handleCloseCreateModal()
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to add trip.'
            updateStatus(message, 'error')
        } finally {
            setIsCreatingTrip(false)
        }
    }

    const formatDistance = (value?: number) =>
        typeof value === 'number' ? `${value.toFixed(1)} km` : '—'

    const getDayTypeLabel = (trip: TripRecord) => {
        if (trip.isPublicHoliday) return 'Public holiday'
        if (trip.isSaturday) return 'Saturday'
        if (trip.isSunday) return 'Sunday'
        return 'Weekday'
    }

    const getTripTypeLabel = (type: number): string => {
        const labels: Record<number, string> = {
            0: 'Private Trip',
            1: 'One-way Trip',
            2: 'Return Trip',
        }
        return labels[type] || String(type)
    }

    const handleStartEdit = (trip: TripRecord) => {
        setEditingTrip(trip)
        setEditorState({
            date: trip.date,
            client: trip.client || '',
            city: trip.city || '',
            distanceKm: trip.distanceKm ? String(trip.distanceKm) : '',
            tripType: String(trip.tripType),
            isPrivateTrip: Boolean(trip.isPrivateTrip),
            vehicleRegNumber: trip.vehicleRegNumber || '',
        })
        updateStatus(`Editing trip #${trip.id} (${trip.date}).`)
        setStatusTone('default')
        setIsEditorModalOpen(true)
    }

    const handleEditorInputChange = (
        event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    ) => {
        const target = event.target
        const { name, value } = target
        const isCheckbox = target instanceof HTMLInputElement && target.type === 'checkbox'

        setEditorState((prev) => {
            const newState = {
                ...prev,
                [name]: isCheckbox ? target.checked : value,
            }

            // Auto-fill city and distance when client is selected
            if (name === 'client' && value) {
                const selectedClient = enabledClients.find((c) => c.client === value)
                if (selectedClient) {
                    newState.city = selectedClient.city || ''
                    newState.distanceKm = String(selectedClient.distanceFromOffice)
                }
            }

            return newState
        })
    }

    const handleCancelEditing = () => {
        setEditingTrip(null)
        setEditorState(emptyTripEditorFormState)
        setIsEditorModalOpen(false)
    }

    const handleUpdateTrip = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!editingTrip) {
            updateStatus('Select a trip to edit first.', 'error')
            return
        }

        if (!editorState.date) {
            updateStatus('Date is required.', 'error')
            return
        }

        const distanceValue = Number.parseFloat(editorState.distanceKm)
        const tripTypeValue = Number.parseInt(editorState.tripType, 10)

        if (!Number.isFinite(distanceValue) || distanceValue <= 0) {
            updateStatus('Distance must be greater than 0 km.', 'error')
            return
        }

        if (!Number.isFinite(tripTypeValue) || tripTypeValue < 0 || tripTypeValue > 2) {
            updateStatus('Trip type must be 0 (Private), 1 (One-way), or 2 (Return).', 'error')
            return
        }

        try {
            setIsUpdatingTrip(true)
            updateStatus(`Updating trip #${editingTrip.id}…`)
            // Default to "Private Trip" if no client provided
            const clientValue = editorState.client.trim() || 'Private Trip'
            const cityValue = editorState.city.trim() || "undefined"
            await updateTrip(
                editingTrip.id,
                {
                    date: editorState.date,
                    client: clientValue,
                    city: cityValue,
                    distanceKm: distanceValue,
                    tripType: tripTypeValue,
                    isPrivateTrip: editorState.isPrivateTrip,
                    vehicleRegNumber: editorState.vehicleRegNumber || undefined,
                },
                apiBaseUrl,
            )
            updateStatus(`Trip #${editingTrip.id} updated.`, 'success')
            await queryClient.invalidateQueries({ queryKey: ['trips', apiBaseUrl] })
            await queryClient.invalidateQueries({ queryKey: ['vehicles', apiBaseUrl] })
            handleCancelEditing()
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update trip.'
            updateStatus(message, 'error')
        } finally {
            setIsUpdatingTrip(false)
        }
    }

    const handleDeleteTrip = async (trip: TripRecord) => {
        const confirmed = window.confirm(
            `Delete trip #${trip.id} on ${trip.date}? This cannot be undone.`,
        )
        if (!confirmed) return

        try {
            setDeletingTripId(trip.id)
            updateStatus(`Deleting trip #${trip.id}…`)
            await deleteTrip(trip.id, apiBaseUrl)
            updateStatus(`Trip #${trip.id} deleted.`, 'success')
            await queryClient.invalidateQueries({ queryKey: ['trips', apiBaseUrl] })
            await queryClient.invalidateQueries({ queryKey: ['vehicles', apiBaseUrl] })
            if (editingTrip?.id === trip.id) {
                handleCancelEditing()
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to delete trip.'
            updateStatus(message, 'error')
        } finally {
            setDeletingTripId(null)
        }
    }

    const subtitleText = useMemo(() => {
        if (isLoading) return 'Loading trips from the API…'
        if (isError) {
            return `Failed to load trips: ${(error as Error)?.message ?? 'Unknown error'}`
        }
        if (!data) return 'No trip data yet.'
        return `Showing ${data.items.length} of ${data.totalItems} trip(s).`
    }, [data, error, isError, isLoading])

    return (
        <div className="page-content">
            <section className="panel">
                <h2>Trip actions</h2>
                <p className="subtitle">Manage trips: cleanup, clear all, or create new.</p>
                <div className="action-row" style={{ flexWrap: 'wrap', gap: 12 }}>
                    <button className="button" type="button" onClick={handleOpenCreateModal}>
                        Add trip
                    </button>
                    <button
                        className="button ghost"
                        type="button"
                        onClick={handleExportTrips}
                        disabled={!data || data.totalItems === 0}
                    >
                        Export to CSV
                    </button>
                    <button
                        className="button ghost"
                        type="button"
                        onClick={() => setIsClearModalOpen(true)}
                        disabled={isClearing}
                    >
                        {isClearing ? 'Clearing…' : 'Clear trips'}
                    </button>

                </div>
            </section>

            <section className="panel">
                <h2>Trips</h2>
                <p className="subtitle">{subtitleText}</p>
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSortByColumn('date')}>
                                    Date{getSortIndicator('date')}
                                </th>
                                <th>Vehicle</th>
                                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSortByColumn('client')}>
                                    Client{getSortIndicator('client')}
                                </th>
                                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSortByColumn('city')}>
                                    City{getSortIndicator('city')}
                                </th>
                                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSortByColumn('distanceKm')}>
                                    Distance{getSortIndicator('distanceKm')}
                                </th>
                                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSortByColumn('tripType')}>
                                    Type{getSortIndicator('tripType')}
                                </th>
                                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSortByColumn('totalDistanceKm')}>
                                    Total Distance{getSortIndicator('totalDistanceKm')}
                                </th>
                                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSortByColumn('odometerEnd')}>
                                    Odometer{getSortIndicator('odometerEnd')}
                                </th>
                                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSortByColumn('isPrivateTrip')}>
                                    Private{getSortIndicator('isPrivateTrip')}
                                </th>
                                <th>
                                    Day Type{getSortIndicator('dayType')}
                                </th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading && (
                                <tr>
                                    <td colSpan={11} style={{ textAlign: 'center', padding: '32px 0' }}>
                                        Loading…
                                    </td>
                                </tr>
                            )}
                            {isError && (
                                <tr>
                                    <td colSpan={11} style={{ textAlign: 'center', padding: '32px 0' }}>
                                        No trips found for the selected filters.
                                    </td>
                                </tr>
                            )}
                            {!isLoading && !isError &&
                                trips.map((trip) => (
                                    <tr key={trip.id}>
                                        <td>{trip.date}</td>
                                        <td>{trip.vehicleRegNumber || '—'}</td>
                                        <td>{trip.client || '—'}</td>
                                        <td>{trip.city || '—'}</td>
                                        <td>{formatDistance(trip.distanceKm)}</td>
                                        <td>{getTripTypeLabel(trip.tripType)}</td>
                                        <td>{formatDistance(trip.totalDistanceKm)}</td>
                                        <td>{formatDistance(trip.odometerEnd)}</td>
                                        <td>{trip.isPrivateTrip ? '✓' : '—'}</td>
                                        <td>{getDayTypeLabel(trip)}</td>
                                        <td className="action-row" style={{ gap: 8 }}>
                                            <button
                                                className="button secondary"
                                                type="button"
                                                onClick={() => handleStartEdit(trip)}
                                            >
                                                Edit
                                            </button>
                                            <button
                                                className="button secondary"
                                                type="button"
                                                onClick={() => handleDeleteTrip(trip)}
                                                disabled={deletingTripId === trip.id}
                                            >
                                                {deletingTripId === trip.id ? 'Deleting…' : 'Delete'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
                <div className="action-row" style={{ justifyContent: 'center', gap: '0.5rem', marginTop: 24, flexWrap: 'wrap' }}>
                    {/* Go to first page button */}
                    <button
                        className="button secondary"
                        type="button"
                        onClick={() => setFilters((prev) => ({ ...prev, page: 1 }))}
                        disabled={!data || filters.page <= 1 || isFetching}
                        title="Go to first page"
                        style={{ minWidth: '44px' }}
                    >
                        {'⏮'}
                    </button>

                    {/* Jump back 10 pages button */}
                    <button
                        className="button secondary"
                        type="button"
                        onClick={() => setFilters((prev) => ({ ...prev, page: Math.max(1, prev.page - 10) }))}
                        disabled={!data || filters.page <= 1 || isFetching}
                        title="Jump back 10 pages"
                        style={{ minWidth: '44px' }}
                    >
                        {'<<'}
                    </button>

                    {/* Previous page button */}
                    <button
                        className="button secondary"
                        type="button"
                        onClick={() => handlePageChange('previous')}
                        disabled={!data || filters.page <= 1 || isFetching}
                        title="Previous page"
                        style={{ minWidth: '44px' }}
                    >
                        {'<'}
                    </button>

                    {/* Page number buttons */}
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                        {data && data.totalPages > 0 && Array.from({ length: Math.min(data.totalPages, 10) }, (_, i) => {
                            // Calculate which 10 pages to show (centered around current page)
                            const totalPages = data.totalPages
                            const currentPage = data.page
                            let startPage = Math.max(1, currentPage - 4)
                            let endPage = Math.min(totalPages, startPage + 9)

                            // Adjust start if we're near the end
                            if (endPage - startPage < 9) {
                                startPage = Math.max(1, endPage - 9)
                            }

                            return startPage + i
                        }).map((pageNum) => (
                            <button
                                key={pageNum}
                                className={pageNum === data?.page ? 'button' : 'button secondary'}
                                type="button"
                                onClick={() => setFilters((prev) => ({ ...prev, page: pageNum }))}
                                disabled={isFetching}
                                style={{
                                    minWidth: '44px',
                                    fontWeight: pageNum === data?.page ? 'bold' : 'normal',
                                }}
                            >
                                {pageNum}
                            </button>
                        ))}
                    </div>

                    {/* Next page button */}
                    <button
                        className="button secondary"
                        type="button"
                        onClick={() => handlePageChange('next')}
                        disabled={!data || (data && data.page >= data.totalPages) || isFetching}
                        title="Next page"
                        style={{ minWidth: '44px' }}
                    >
                        {'>'}
                    </button>

                    {/* Jump forward 10 pages button */}
                    <button
                        className="button secondary"
                        type="button"
                        onClick={() => setFilters((prev) => ({ ...prev, page: Math.min(data?.totalPages ?? 1, prev.page + 10) }))}
                        disabled={!data || filters.page >= (data?.totalPages ?? 1) || isFetching}
                        title="Jump forward 10 pages"
                        style={{ minWidth: '44px' }}
                    >
                        {'>>'}
                    </button>

                    {/* Go to last page button */}
                    <button
                        className="button secondary"
                        type="button"
                        onClick={() => setFilters((prev) => ({ ...prev, page: data?.totalPages ?? 1 }))}
                        disabled={!data || filters.page >= (data?.totalPages ?? 1) || isFetching}
                        title="Go to last page"
                        style={{ minWidth: '44px' }}
                    >
                        {'⏭'}
                    </button>

                    {/* Page info */}
                    <span className="status-text" style={{ marginLeft: '1rem' }}>
                        Page {data?.page ?? 1} of {data?.totalPages ?? 1}
                    </span>
                </div>
            </section>

            <Modal
                isOpen={isCreateModalOpen}
                onClose={handleCloseCreateModal}
                title="Add trip"
            >
                <form className="form-grid" onSubmit={handleCreateTrip}>
                    <label>
                        Date
                        <input
                            name="date"
                            type="date"
                            value={createState.date}
                            onChange={handleCreateInputChange}
                            required
                        />
                    </label>
                    <label>
                        Client
                        <select
                            name="client"
                            value={createState.client}
                            onChange={handleCreateInputChange}
                        >
                            <option value="">Select a client</option>
                            {enabledClients.map((c) => (
                                <option key={c.client} value={c.client}>
                                    {c.client}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        City
                        <input
                            name="city"
                            placeholder="City"
                            value={createState.city}
                            onChange={handleCreateInputChange}
                        />
                    </label>
                    <label>
                        Distance (km)
                        <input
                            name="distanceKm"
                            type="number"
                            min={0.1}
                            step={0.1}
                            value={createState.distanceKm}
                            onChange={handleCreateInputChange}
                            required
                        />
                    </label>
                    <label>
                        Vehicle (optional)
                        <select
                            name="vehicleRegNumber"
                            value={createState.vehicleRegNumber}
                            onChange={handleCreateInputChange}
                        >
                            <option value="">No vehicle</option>
                            {enabledVehicles.map((v) => (
                                <option key={v.regNumber} value={v.regNumber}>
                                    {v.regNumber} - {v.make} {v.model}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                            name="isReturnTrip"
                            type="checkbox"
                            checked={createState.tripType === '2'}
                            onChange={(e) => {
                                const tripType = e.target.checked ? '2' : '1'
                                setCreateState((prev) => ({
                                    ...prev,
                                    tripType,
                                }))
                            }}
                        />
                        Is Return Trip
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                            name="isPrivateTrip"
                            type="checkbox"
                            checked={createState.isPrivateTrip}
                            onChange={handleCreateInputChange}
                        />
                        Mark as private trip
                    </label>
                    <div className="action-row" style={{ gridColumn: '1 / -1', gap: 12 }}>
                        <button className="button" type="submit" disabled={isCreatingTrip}>
                            {isCreatingTrip ? 'Saving…' : 'Add trip'}
                        </button>
                        <button
                            className="button secondary"
                            type="button"
                            onClick={handleCloseCreateModal}
                            disabled={isCreatingTrip}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </Modal>

            <Modal
                isOpen={isEditorModalOpen && Boolean(editingTrip)}
                onClose={handleCancelEditing}
                title={editingTrip ? `Edit trip #${editingTrip.id}` : 'Edit trip'}
            >
                <form className="form-grid" onSubmit={handleUpdateTrip}>
                    <label>
                        Date
                        <input
                            type="date"
                            name="date"
                            value={editorState.date}
                            onChange={handleEditorInputChange}
                            required
                        />
                    </label>
                    <label>
                        Client
                        <select
                            name="client"
                            value={editorState.client}
                            onChange={handleEditorInputChange}
                        >
                            <option value="">Select a client</option>
                            {enabledClients.map((c) => (
                                <option key={c.client} value={c.client}>
                                    {c.client}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        City
                        <input
                            name="city"
                            value={editorState.city}
                            onChange={handleEditorInputChange}
                        />
                    </label>
                    <label>
                        Distance (km)
                        <input
                            name="distanceKm"
                            type="number"
                            min={0.1}
                            step={0.1}
                            value={editorState.distanceKm}
                            onChange={handleEditorInputChange}
                            required
                        />
                    </label>
                    <label>
                        Vehicle (optional)
                        <select
                            name="vehicleRegNumber"
                            value={editorState.vehicleRegNumber}
                            onChange={handleEditorInputChange}
                        >
                            <option value="">No vehicle</option>
                            {enabledVehicles.map((v) => (
                                <option key={v.regNumber} value={v.regNumber}>
                                    {v.regNumber} - {v.make} {v.model}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                            name="isReturnTrip"
                            type="checkbox"
                            checked={editorState.tripType === '2'}
                            onChange={(e) => {
                                const tripType = e.target.checked ? '2' : '1'
                                setEditorState((prev) => ({
                                    ...prev,
                                    tripType,
                                }))
                            }}
                        />
                        Is Return Trip
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                            name="isPrivateTrip"
                            type="checkbox"
                            checked={editorState.isPrivateTrip}
                            onChange={handleEditorInputChange}
                        />
                        Mark as private trip
                    </label>
                    <div className="action-row" style={{ gridColumn: '1 / -1', gap: 12 }}>
                        <button className="button" type="submit" disabled={isUpdatingTrip}>
                            {isUpdatingTrip ? 'Updating…' : 'Update trip'}
                        </button>
                        <button
                            className="button secondary"
                            type="button"
                            onClick={handleCancelEditing}
                            disabled={isUpdatingTrip}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Clear Trips Modal */}
            <Modal isOpen={isClearModalOpen} onClose={() => setIsClearModalOpen(false)} title="Clear Trips">
                <form
                    onSubmit={(e) => {
                        e.preventDefault()
                        handleClearTrips()
                    }}
                    style={{ display: 'grid', gap: '1rem' }}
                >
                    <p>
                        Specify a date range to clear trips from. Leave fields empty to clear all trips.
                    </p>
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
        </div>
    )
}

export default TripsPage
