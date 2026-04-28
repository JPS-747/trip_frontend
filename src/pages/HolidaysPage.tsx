import { importHolidaysFromApi, deleteHoliday, saveHoliday } from '@/services/holidayService'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useApiConfig } from '@/contexts/ApiConfigContext'
import { getHolidays } from '@/services/holidayService'
import type { HolidayRecord } from '@/services/holidayService'

const HolidaysPage = () => {

    const [editIdx, setEditIdx] = useState<number | null>(null)
    const [editHoliday, setEditHoliday] = useState<HolidayRecord | null>(null)

    // Delete a holiday
    const handleDeleteHoliday = async (date: string, name: string) => {
        if (!window.confirm('Delete this holiday?')) return
        try {
            await deleteHoliday(date, name, apiBaseUrl)
            window.location.reload()
        } catch (err) {
            alert('Delete failed: ' + (err instanceof Error ? err.message : err))
        }
    }

    // Start editing a holiday
    const handleEditHoliday = (holiday: HolidayRecord, idx: number) => {
        setEditIdx(idx)
        setEditHoliday({ ...holiday })
    }

    // Save edited holiday
    const handleSaveEdit = async () => {
        if (!editHoliday) return
        try {
            await saveHoliday(editHoliday, apiBaseUrl)
            setEditIdx(null)
            setEditHoliday(null)
            window.location.reload()
        } catch (err) {
            alert('Save failed: ' + (err instanceof Error ? err.message : err))
        }
    }

    // Cancel edit
    const handleCancelEdit = () => {
        setEditIdx(null)
        setEditHoliday(null)
    }

        // Export holidays as CSV using new endpoint
        const handleExportHolidays = async () => {
            try {
                const response = await fetch(`${apiBaseUrl}/holidays/export`)
                if (!response.ok) throw new Error('Failed to export holidays')
                const blob = await response.blob()
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'public_holidays.csv'
                document.body.appendChild(a)
                a.click()
                a.remove()
                window.URL.revokeObjectURL(url)
            } catch (err) {
                alert('Export failed: ' + (err instanceof Error ? err.message : err))
            }
        }

        // Import holidays from CSV using importHolidaysFromApi
        const handleImportHolidays = async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0]
            if (!file) return
            try {
                const text = await file.text()
                // Parse CSV to array of objects
                const rows = text.split(/\r?\n/)
                const [header, ...lines] = rows
                const keys = header.split(',').map((k) => k.trim())
                const holidays = lines
                    .filter(Boolean)
                    .map((line) => {
                        const values = line.split(',')
                        const obj: any = {}
                        keys.forEach((k, i) => (obj[k] = values[i] || ''))
                        return obj
                    })
                await importHolidaysFromApi(holidays, apiBaseUrl)
                alert('Holidays imported successfully!')
                window.location.reload()
            } catch (err) {
                alert('Import failed: ' + (err instanceof Error ? err.message : err))
            }
        }
    const { apiBaseUrl } = useApiConfig()
    const [currentYearIndex, setCurrentYearIndex] = useState(0)

    const { data: holidaysData, isLoading, isError, error } = useQuery({
        queryKey: ['holidays', apiBaseUrl],
        queryFn: () => getHolidays(apiBaseUrl),
    })

    // Group holidays by year
    const holidaysByYear = useMemo(() => {
        if (!holidaysData?.holidays) return {}

        const grouped: Record<number, HolidayRecord[]> = {}

        holidaysData.holidays.forEach((holiday) => {
            const year = new Date(holiday.date).getFullYear()
            if (!grouped[year]) {
                grouped[year] = []
            }
            grouped[year].push(holiday)
        })

        // Sort holidays within each year by date
        Object.keys(grouped).forEach((year) => {
            grouped[parseInt(year)].sort((a, b) =>
                new Date(a.date).getTime() - new Date(b.date).getTime()
            )
        })

        return grouped
    }, [holidaysData?.holidays])

    const sortedYears = useMemo(() => {
        return Object.keys(holidaysByYear)
            .map(Number)
            .sort((a, b) => a - b)
    }, [holidaysByYear])

    const currentYear = sortedYears[currentYearIndex]
    const currentYearHolidays = currentYear ? holidaysByYear[currentYear] : []

    const handlePreviousYear = () => {
        setCurrentYearIndex((prev) => Math.max(0, prev - 1))
    }

    const handleNextYear = () => {
        setCurrentYearIndex((prev) => Math.min(sortedYears.length - 1, prev + 1))
    }

    const handleFirstYear = () => {
        setCurrentYearIndex(0)
    }

    const handleLastYear = () => {
        setCurrentYearIndex(sortedYears.length - 1)
    }

    const handleSelectYear = (year: number) => {
        const index = sortedYears.indexOf(year)
        if (index !== -1) {
            setCurrentYearIndex(index)
        }
    }

    if (isLoading) {
        return (
            <div className="page-content">
                <section className="panel">
                    <h1>Public Holidays</h1>
                    <p>Loading holidays…</p>
                </section>
            </div>
        )
    }

    if (isError) {
        return (
            <div className="page-content">
                <section className="panel">
                    <h1>Public Holidays</h1>
                    <p style={{ color: 'var(--danger)' }}>
                        Failed to load holidays: {error instanceof Error ? error.message : 'Unknown error'}
                    </p>
                </section>
            </div>
        )
    }

    return (
        <div className="page-content">
            <section className="panel">
                <h1>Namibia Public Holidays</h1>
                <p className="subtitle">Browse public holidays by year</p>

                {/* Import/Export Buttons */}
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                    <button className="button" type="button" onClick={handleExportHolidays}>
                        Export Holidays (CSV)
                    </button>
                    <label className="button" style={{ cursor: 'pointer', marginBottom: 0 }}>
                        Import Holidays (CSV)
                        <input
                            type="file"
                            accept=".csv"
                            style={{ display: 'none' }}
                            onChange={handleImportHolidays}
                        />
                    </label>
                </div>

                {sortedYears.length === 0 ? (
                    <p>No holidays found.</p>
                ) : (
                    <>
                        <div style={{ marginBottom: '2rem' }}>
                            <h2 style={{ marginBottom: '1rem' }}>Year {currentYear}</h2>
                            <p style={{ marginBottom: '1rem', opacity: 0.8 }}>
                                {currentYearHolidays.length} holiday{currentYearHolidays.length !== 1 ? 's' : ''} in {currentYear}
                            </p>

                            <div className="table-wrap">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Holiday Name</th>
                                            <th>Country</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {currentYearHolidays.map((holiday, idx) => {
                                            const date = new Date(holiday.date)
                                            const formattedDate = date.toLocaleDateString('en-US', {
                                                weekday: 'short',
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                            })
                                            const isEditing = editIdx === idx
                                            return (
                                                <tr key={idx}>
                                                    <td style={{ whiteSpace: 'nowrap', fontWeight: 500 }}>{formattedDate}</td>
                                                    <td>
                                                        {isEditing ? (
                                                            <input
                                                                type="text"
                                                                value={editHoliday?.name || ''}
                                                                onChange={e => setEditHoliday(h => h ? { ...h, name: e.target.value } : h)}
                                                                style={{ width: '10rem' }}
                                                            />
                                                        ) : (
                                                            holiday.name
                                                        )}
                                                    </td>
                                                    <td>
                                                        {isEditing ? (
                                                            <input
                                                                type="text"
                                                                value={editHoliday?.country || ''}
                                                                onChange={e => setEditHoliday(h => h ? { ...h, country: e.target.value } : h)}
                                                                style={{ width: '8rem' }}
                                                            />
                                                        ) : (
                                                            holiday.country || ''
                                                        )}
                                                    </td>
                                                    <td>
                                                        {isEditing ? (
                                                            <>
                                                                <button className="button" style={{ marginRight: 4 }} onClick={handleSaveEdit}>Save</button>
                                                                <button className="button secondary" onClick={handleCancelEdit}>Cancel</button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <button className="button secondary" style={{ marginRight: 4 }} onClick={() => handleEditHoliday(holiday, idx)}>Edit</button>
                                                                <button className="button danger" onClick={() => handleDeleteHoliday(holiday.date, holiday.name)}>Delete</button>
                                                            </>
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Year Navigation */}
                        <div className="action-row" style={{ justifyContent: 'center', gap: '0.5rem', marginTop: '2rem', flexWrap: 'wrap' }}>
                            {/* First year button */}
                            <button
                                className="button secondary"
                                type="button"
                                onClick={handleFirstYear}
                                disabled={currentYearIndex === 0}
                                title="First year"
                                style={{ minWidth: '44px' }}
                            >
                                {'<<'}
                            </button>

                            {/* Previous year button */}
                            <button
                                className="button secondary"
                                type="button"
                                onClick={handlePreviousYear}
                                disabled={currentYearIndex === 0}
                                title="Previous year"
                                style={{ minWidth: '44px' }}
                            >
                                {'<'}
                            </button>

                            {/* Year selection buttons */}
                            <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                                {sortedYears.map((year) => (
                                    <button
                                        key={year}
                                        className={year === currentYear ? 'button' : 'button secondary'}
                                        type="button"
                                        onClick={() => handleSelectYear(year)}
                                        style={{
                                            minWidth: '60px',
                                            fontWeight: year === currentYear ? 'bold' : 'normal',
                                        }}
                                    >
                                        {year}
                                    </button>
                                ))}
                            </div>

                            {/* Next year button */}
                            <button
                                className="button secondary"
                                type="button"
                                onClick={handleNextYear}
                                disabled={currentYearIndex === sortedYears.length - 1}
                                title="Next year"
                                style={{ minWidth: '44px' }}
                            >
                                {'>'}
                            </button>

                            {/* Last year button */}
                            <button
                                className="button secondary"
                                type="button"
                                onClick={handleLastYear}
                                disabled={currentYearIndex === sortedYears.length - 1}
                                title="Last year"
                                style={{ minWidth: '44px' }}
                            >
                                {'>>'}
                            </button>

                            {/* Year info */}
                            <span className="status-text" style={{ marginLeft: '1rem' }}>
                                Year {currentYearIndex + 1} of {sortedYears.length}
                            </span>
                        </div>

                        {/* Summary */}
                        <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '0.5rem' }}>
                            <h3 style={{ marginBottom: '0.5rem' }}>Summary</h3>
                            <p style={{ marginBottom: '0.5rem' }}>
                                <strong>Total Years:</strong> {sortedYears.length} (from {sortedYears[0]} to {sortedYears[sortedYears.length - 1]})
                            </p>
                            <p>
                                <strong>Total Holidays:</strong> {holidaysData?.holidays?.length ?? 0}
                            </p>
                        </div>
                    </>
                )}
            </section>
        </div>
    )
}

export default HolidaysPage
