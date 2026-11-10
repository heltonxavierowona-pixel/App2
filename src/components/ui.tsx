import type { ReactNode } from 'react'
import { STATUSES, STATUS_LABEL } from '../lib/constants.ts'
import type { Status } from '../lib/types.ts'

const ICONS = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  orders: 'M9 4h6v3H9zM7 5H5v16h14V5h-2M9 12h6M9 16h4',
  ship: 'M3 17l2 3h14l2-3M5 17v-6h14v6M9 11V6h6v5M12 3v3',
  file: 'M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 17h6',
  calc: 'M6 3h12v18H6zM9 7h6M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01',
  plus: 'M12 5v14M5 12h14',
  chevron: 'M9 6l6 6-6 6',
  back: 'M15 6l-6 6 6 6',
  alert: 'M12 4l9 16H3zM12 10v4M12 17h.01',
  check: 'M5 12l5 5 9-10',
  upload: 'M12 16V5M7 10l5-5 5 5M5 19h14',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  logout: 'M10 4H5v16h5M14 8l4 4-4 4M18 12H9',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
} as const

export type IconName = keyof typeof ICONS

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICONS[name]} />
    </svg>
  )
}

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABEL[status]}</span>
}

export function LateBadge({ days }: { days: number }) {
  if (days <= 0) return null
  return (
    <span className="badge badge-late">
      <Icon name="alert" size={14} />
      Retard {days} j
    </span>
  )
}

/**
 * La « ligne maritime » : les six étapes d'une expédition dessinées comme les
 * escales d'une route. Compacte dans les listes, détaillée sur la fiche.
 */
export function RouteLine({ status, late = false }: { status: Status; late?: boolean }) {
  const current = STATUSES.indexOf(status)
  return (
    <ol
      className={`route${late ? ' route-late' : ''}`}
      role="img"
      aria-label={`Étape ${current + 1} sur ${STATUSES.length} : ${STATUS_LABEL[status]}${late ? ', en retard' : ''}`}
    >
      {STATUSES.map((s, i) => (
        <li key={s} className={i < current ? 'done' : i === current ? 'current' : 'todo'} />
      ))}
    </ol>
  )
}

export interface RouteStop {
  status: Status
  planned?: string | null
  actual?: string | null
}

export function RouteDetail({
  status,
  late,
  stops,
  format,
}: {
  status: Status
  late: boolean
  stops: RouteStop[]
  format: (iso: string | null) => string
}) {
  const current = STATUSES.indexOf(status)
  return (
    <ol className={`route-detail${late ? ' route-late' : ''}`}>
      {stops.map((stop, i) => (
        <li
          key={stop.status}
          className={i < current ? 'done' : i === current ? 'current' : 'todo'}
          aria-current={i === current ? 'step' : undefined}
        >
          <span className="route-stop-name">{STATUS_LABEL[stop.status]}</span>
          <span className="route-stop-dates">
            {stop.actual ? (
              <>
                <strong>{format(stop.actual)}</strong>
                {stop.planned && stop.planned !== stop.actual && <> · prévu {format(stop.planned)}</>}
              </>
            ) : stop.planned ? (
              <>prévu {format(stop.planned)}</>
            ) : (
              ''
            )}
          </span>
        </li>
      ))}
    </ol>
  )
}

export function PageHeader({
  title,
  back,
  action,
  children,
}: {
  title: string
  back?: string
  action?: ReactNode
  children?: ReactNode
}) {
  return (
    <header className="page-header">
      {back && (
        <a className="back-link" href={`#${back}`}>
          <Icon name="back" size={18} />
          Retour
        </a>
      )}
      <div className="page-header-row">
        <h1>{title}</h1>
        {action}
      </div>
      {children}
    </header>
  )
}

export function Field({
  label,
  hint,
  error,
  children,
  className = '',
}: {
  label: string
  hint?: string
  error?: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">{label}</span>
      {children}
      {error ? (
        <span className="field-error" role="alert">
          {error}
        </span>
      ) : (
        hint && <span className="field-hint">{hint}</span>
      )}
    </label>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {children}
    </div>
  )
}

export function Notice({ kind = 'error', children }: { kind?: 'error' | 'info' | 'ok'; children: ReactNode }) {
  return (
    <p className={`notice notice-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  )
}
