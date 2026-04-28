import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import StatCard from '@/components/ui/StatCard'
import { useApiConfig } from '@/contexts/ApiConfigContext'
import { getClients } from '@/services/clientService'
import { defaultTripQueryState, getTrips } from '@/services/tripService'

const DashboardPage = () => {
    const { apiBaseUrl } = useApiConfig()
    const {
        data: clientsResponse,
        isLoading: clientsLoading,
        isError: clientsError,
    } = useQuery({
        queryKey: ['clients', apiBaseUrl],
        queryFn: () => getClients(apiBaseUrl, 1, 1000),
    })

    const clients = clientsResponse?.items ?? []

    const tripsSummaryFilters = useMemo(
        () => ({
            ...defaultTripQueryState,
            pageSize: 10000, // Get all trips for analysis
        }),
        [],
    )

    const {
        data: tripsSummary,
        isLoading: tripsLoading,
        isError: tripsError,
    } = useQuery({
        queryKey: ['trips-summary', apiBaseUrl],
        queryFn: () => getTrips(tripsSummaryFilters, apiBaseUrl),
    })

    const totalClientsDisplay = clientsLoading
        ? 'Loading…'
        : clientsError
            ? '—'
            : clients.length

    const formatDistance = (value?: number) =>
        typeof value === 'number' ? `${value.toFixed(1)} km` : '0 km'

    const totalTripsDisplay = tripsLoading
        ? 'Loading…'
        : tripsError
            ? '—'
            : tripsSummary?.totalItems ?? 0

    const totalDistanceDisplay = tripsLoading
        ? 'Loading…'
        : tripsError
            ? '—'
            : formatDistance(tripsSummary?.totalDistanceKm)

    const currentOdometerDisplay = useMemo(() => {
        if (tripsLoading) return 'Loading…'
        if (tripsError) return '—'
        if (!tripsSummary?.items || tripsSummary.items.length === 0) return '0 km'

        // Find the most recent trip
        const sortedTrips = [...tripsSummary.items].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        )
        const lastTrip = sortedTrips[0]

        if (lastTrip?.odometerEnd) {
            return `${lastTrip.odometerEnd.toFixed(1)} km`
        }

        return '0 km'
    }, [tripsSummary?.items, tripsLoading, tripsError])

    // Calculate day type summaries (weekday, Saturday, Sunday, public holiday)
    const dayTypeSummaries = useMemo(() => {
        if (!tripsSummary?.items || tripsSummary.items.length === 0) {
            return {
                weekday: { count: 0, distance: 0 },
                saturday: { count: 0, distance: 0 },
                sunday: { count: 0, distance: 0 },
                publicHoliday: { count: 0, distance: 0 },
            }
        }

        const summaries = {
            weekday: { count: 0, distance: 0 },
            saturday: { count: 0, distance: 0 },
            sunday: { count: 0, distance: 0 },
            publicHoliday: { count: 0, distance: 0 },
        }

        tripsSummary.items.forEach((trip) => {
            if (trip.isPublicHoliday) {
                summaries.publicHoliday.count += 1
                summaries.publicHoliday.distance += trip.totalDistanceKm || 0
            } else if (trip.isSunday) {
                summaries.sunday.count += 1
                summaries.sunday.distance += trip.totalDistanceKm || 0
            } else if (trip.isSaturday) {
                summaries.saturday.count += 1
                summaries.saturday.distance += trip.totalDistanceKm || 0
            } else if (trip.isWeekday) {
                summaries.weekday.count += 1
                summaries.weekday.distance += trip.totalDistanceKm || 0
            }
        })

        return summaries
    }, [tripsSummary?.items])

    const summaryCards = [
        { label: 'Total trips', value: totalTripsDisplay, helper: 'Loaded from /trips summary' },
        { label: 'Total distance', value: totalDistanceDisplay, helper: 'Aggregated from /trips' },
        { label: 'Current odometer', value: currentOdometerDisplay, helper: 'From latest trip' },
        {
            label: 'Total clients',
            value: totalClientsDisplay,
            helper: clientsError ? 'Failed to load /clients' : 'Synced from /clients',
        },
        {
            label: 'Weekday trips',
            value: `${formatDistance(dayTypeSummaries.weekday.distance)}`,
            helper: `${dayTypeSummaries.weekday.count} trips`,
        },
        {
            label: 'Saturday trips',
            value: `${formatDistance(dayTypeSummaries.saturday.distance)}`,
            helper: `${dayTypeSummaries.saturday.count} trips`,
        },
        {
            label: 'Sunday trips',
            value: `${formatDistance(dayTypeSummaries.sunday.distance)}`,
            helper: `${dayTypeSummaries.sunday.count} trips`,
        },
        {
            label: 'Holiday trips',
            value: `${formatDistance(dayTypeSummaries.publicHoliday.distance)}`,
            helper: `${dayTypeSummaries.publicHoliday.count} trips`,
        },
    ]

    // Calculate monthly distance by financial year (March 1 - Feb 28/29)
    const monthlyDistanceByYear = useMemo(() => {
        if (!tripsSummary?.items || tripsSummary.items.length === 0) {
            return {}
        }

        const yearMonthData: Record<string, Record<number, number>> = {}

        tripsSummary.items.forEach((trip) => {
            const date = new Date(trip.date)
            const calendarYear = date.getFullYear()
            const month = date.getMonth() // 0-11 (Jan=0, Feb=1, Mar=2, etc)

            // Financial year starts on March 1
            // If month is Jan (0) or Feb (1), it belongs to previous year's financial year
            const financialYear = month < 2 ? calendarYear - 1 : calendarYear
            const financialYearLabel = `FY ${financialYear}/${(financialYear + 1).toString().slice(-2)}`

            // Month in financial year (0-11, where 0=Mar, 1=Apr, ..., 10=Dec, 11=Jan, 12=Feb)
            const monthInFinancialYear = (month - 2 + 12) % 12

            if (!yearMonthData[financialYearLabel]) {
                yearMonthData[financialYearLabel] = {}
            }

            if (!yearMonthData[financialYearLabel][monthInFinancialYear]) {
                yearMonthData[financialYearLabel][monthInFinancialYear] = 0
            }

            yearMonthData[financialYearLabel][monthInFinancialYear] += trip.totalDistanceKm || 0
        })

        return yearMonthData
    }, [tripsSummary?.items])

    // Calculate private vs non-private trips by financial year
    const privateVsNonPrivateByYear = useMemo(() => {
        if (!tripsSummary?.items || tripsSummary.items.length === 0) {
            return {}
        }

        const yearData: Record<string, { privateKm: number; nonPrivateKm: number; totalKm: number }> = {}

        tripsSummary.items.forEach((trip) => {
            const date = new Date(trip.date)
            const calendarYear = date.getFullYear()
            const month = date.getMonth() // 0-11 (Jan=0, Feb=1, Mar=2, etc)

            // Financial year starts on March 1
            // If month is Jan (0) or Feb (1), it belongs to previous year's financial year
            const financialYear = month < 2 ? calendarYear - 1 : calendarYear
            const financialYearLabel = `FY ${financialYear}/${(financialYear + 1).toString().slice(-2)}`

            if (!yearData[financialYearLabel]) {
                yearData[financialYearLabel] = { privateKm: 0, nonPrivateKm: 0, totalKm: 0 }
            }

            if (trip.isPrivateTrip) {
                yearData[financialYearLabel].privateKm += trip.totalDistanceKm || 0
            } else {
                yearData[financialYearLabel].nonPrivateKm += trip.totalDistanceKm || 0
            }

            yearData[financialYearLabel].totalKm += trip.totalDistanceKm || 0
        })

        return yearData
    }, [tripsSummary?.items])

    return (
        <div className="page-content">
            <section className="panel">
                <h2>Summary</h2>
                <p className="subtitle">React components already mirror the metrics shown in the vanilla dashboard.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                    {summaryCards.map((card) => (
                        <StatCard key={card.label} {...card} />
                    ))}
                </div>
            </section>

            {Object.keys(monthlyDistanceByYear).length > 0 && (
                <section className="panel">
                    <h2>Distance per month</h2>
                    <p className="subtitle">Monthly distance breakdown by year</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2rem' }}>
                        {Object.entries(monthlyDistanceByYear)
                            .sort(([yearA], [yearB]) => yearB.localeCompare(yearA))
                            .map(([year, monthData]) => (
                                <MonthlyChart key={year} year={year} monthData={monthData} />
                            ))}
                    </div>
                </section>
            )}

            {Object.keys(privateVsNonPrivateByYear).length > 0 && (
                <section className="panel">
                    <h2>Private vs Non-Private trips</h2>
                    <p className="subtitle">Breakdown of trip privacy status by financial year</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2rem' }}>
                        {Object.entries(privateVsNonPrivateByYear)
                            .sort(([yearA], [yearB]) => yearB.localeCompare(yearA))
                            .map(([year, data]) => (
                                <PrivacyPieChartByYear key={year} year={year} privateVsNonPrivate={data} totalKm={data.totalKm} />
                            ))}
                    </div>
                </section>
            )}
        </div>
    )
}

const MonthlyChart = ({ year, monthData }: { year: string; monthData: Record<number, number> }) => {
    // Financial year months: 0=Mar, 1=Apr, 2=May, ..., 10=Dec, 11=Jan, 12=Feb
    const monthNames = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb']
    const months = Array.from({ length: 12 }, (_, i) => i)
    const distances = months.map((m) => monthData[m] || 0)
    const yearlyTotal = distances.reduce((a, b) => a + b, 0)
    const maxDistance = Math.max(...distances, 100) // Default to 100 if all zeros
    const chartHeight = 180
    const minBarHeight = 8

    return (
        <div style={{ padding: '1rem', border: '1px solid var(--border)', borderRadius: '0.5rem', display: 'flex', flexDirection: 'column' }}>
            <div
                style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'space-around',
                    height: `${chartHeight}px`,
                    gap: '0.5rem',
                    borderBottom: '1px solid var(--border)',
                    paddingBottom: '0.5rem',
                    overflow: 'hidden',
                    flex: 1,
                }}
            >
                {months.map((month) => {
                    const distance = distances[month]
                    const barHeight = distance === 0 ? minBarHeight : Math.max((distance / maxDistance) * chartHeight, minBarHeight)
                    const isZero = distance === 0

                    return (
                        <div
                            key={month}
                            style={{
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                gap: '0.25rem',
                                minHeight: 0,
                            }}
                        >
                            <div
                                style={{
                                    width: '100%',
                                    height: `${Math.min(barHeight, chartHeight)}px`,
                                    backgroundColor: isZero ? 'var(--border)' : 'var(--accent)',
                                    borderRadius: '0.25rem',
                                    opacity: isZero ? 0.3 : 1,
                                }}
                                title={`${monthNames[month]}: ${distance.toFixed(1)} km`}
                            />
                            <span style={{ fontSize: '0.75rem', opacity: 0.7, flexShrink: 0 }}>{monthNames[month]}</span>
                            <span style={{ fontSize: '0.7rem', opacity: 0.5, minHeight: '1rem', flexShrink: 0 }}>
                                {distance > 0 ? `${distance.toFixed(0)}` : '—'}
                            </span>
                        </div>
                    )
                })}
            </div>

            {/* Separator and Footer Info */}
            <div style={{ paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem', fontWeight: 500 }}>
                    <span>{year}</span>
                    <span>{yearlyTotal.toFixed(1)} km</span>
                </div>
            </div>
        </div>
    )
}

const PrivacyPieChartByYear = ({ year, privateVsNonPrivate, totalKm }: { year: string; privateVsNonPrivate: { privateKm: number; nonPrivateKm: number }; totalKm: number }) => {
    const total = privateVsNonPrivate.privateKm + privateVsNonPrivate.nonPrivateKm
    const privatePercentage = (privateVsNonPrivate.privateKm / total) * 100
    const nonPrivatePercentage = (privateVsNonPrivate.nonPrivateKm / total) * 100

    const privateColor = '#cc6600'
    const nonPrivateColor = '#0066cc'

    // Calculate pie slice angles
    const privateAngle = (privateVsNonPrivate.privateKm / total) * 360
    const nonPrivateAngle = (privateVsNonPrivate.nonPrivateKm / total) * 360

    const radius = 80
    const centerX = 120
    const centerY = 120
    const svgSize = 240

    // Function to convert angle and radius to x, y coordinates
    const getCoordinates = (angle: number, r: number) => {
        const radians = (angle * Math.PI) / 180
        return [centerX + r * Math.cos(radians), centerY + r * Math.sin(radians)]
    }

    // Function to create SVG path for pie slice
    const createSlicePath = (startAngle: number, endAngle: number) => {
        const [x1, y1] = getCoordinates(startAngle, radius)
        const [x2, y2] = getCoordinates(endAngle, radius)

        const largeArc = endAngle - startAngle > 180 ? 1 : 0

        return `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`
    }

    return (
        <div style={{ padding: '1rem', border: '1px solid var(--border)', borderRadius: '0.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
                {/* Pie Chart */}
                <svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
                    {privateVsNonPrivate.privateKm > 0 && (
                        <path
                            d={createSlicePath(-90, -90 + privateAngle)}
                            fill={privateColor}
                            stroke="white"
                            strokeWidth="2"
                        />
                    )}
                    {privateVsNonPrivate.nonPrivateKm > 0 && (
                        <path
                            d={createSlicePath(-90 + privateAngle, -90 + privateAngle + nonPrivateAngle)}
                            fill={nonPrivateColor}
                            stroke="white"
                            strokeWidth="2"
                        />
                    )}
                </svg>

                {/* Legend */}
                <div style={{ width: '100%', display: 'grid', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div
                            style={{
                                width: '12px',
                                height: '12px',
                                backgroundColor: privateColor,
                                borderRadius: '2px',
                                flexShrink: 0,
                            }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>Private</div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                                {privateVsNonPrivate.privateKm.toFixed(1)} km ({privatePercentage.toFixed(0)}%)
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div
                            style={{
                                width: '12px',
                                height: '12px',
                                backgroundColor: nonPrivateColor,
                                borderRadius: '2px',
                                flexShrink: 0,
                            }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>Non-Private</div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                                {privateVsNonPrivate.nonPrivateKm.toFixed(1)} km ({nonPrivatePercentage.toFixed(0)}%)
                            </div>
                        </div>
                    </div>
                </div>

                {/* Separator and Footer Info */}
                <div style={{ width: '100%', borderTop: '1px solid var(--border)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem', fontWeight: 500 }}>
                        <span>{year}</span>
                        <span>{totalKm.toFixed(1)} km</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default DashboardPage
