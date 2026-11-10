import { ShipmentRow } from '../components/ShipmentRow.tsx'
import { Empty, Icon, PageHeader } from '../components/ui.tsx'
import { DOC_LABEL } from '../lib/constants.ts'
import { lateDays, missingDocs, monthMargin } from '../lib/costs.ts'
import { fcfa, shortDate, todayISO } from '../lib/format.ts'
import { useStore } from '../lib/store.tsx'

const monthName = new Intl.DateTimeFormat('fr-FR', { month: 'long' })

export default function Dashboard() {
  const { shipments, orders } = useStore()
  const today = todayISO()

  const active = shipments.filter((s) => s.status !== 'delivered')
  const late = active
    .map((s) => ({ s, days: lateDays(s, today) }))
    .filter((x) => x.days > 0)
    .sort((a, b) => b.days - a.days)
  const arrived = active.filter((s) => s.status === 'at_port' || s.status === 'cleared')
  const { margin, lots } = monthMargin(shipments, orders, today)
  const incomplete = active
    .map((s) => ({ s, missing: missingDocs(s) }))
    .filter((x) => x.missing.length > 0 && x.s.status !== 'ordered')
    .sort((a, b) => b.missing.length - a.missing.length)
  const upcoming = active
    .filter((s) => !s.actual_arrival && s.planned_arrival && s.planned_arrival >= today)
    .sort((a, b) => a.planned_arrival!.localeCompare(b.planned_arrival!))
    .slice(0, 3)

  if (shipments.length === 0)
    return (
      <>
        <PageHeader title="Tableau de bord" />
        <Empty title="Aucune expédition pour le moment">
          <p>Commencez par enregistrer une commande fournisseur, puis créez son expédition.</p>
          <a className="btn btn-primary" href="#/commandes/nouvelle">
            <Icon name="plus" />
            Nouvelle commande
          </a>
        </Empty>
      </>
    )

  return (
    <>
      <PageHeader title="Tableau de bord" />

      <section className="stats" aria-label="Indicateurs">
        <a className="stat" href="#/expeditions?filtre=en-cours">
          <span className="stat-label">En cours</span>
          <span className="stat-value">{active.length}</span>
          <span className="stat-note">expédition{active.length > 1 ? 's' : ''}</span>
        </a>
        <a className={`stat${late.length ? ' stat-danger' : ''}`} href="#/expeditions?filtre=retard">
          <span className="stat-label">En retard</span>
          <span className="stat-value">{late.length}</span>
          <span className="stat-note">{late.length ? `jusqu’à ${late[0].days} j` : 'tout est à l’heure'}</span>
        </a>
        <a className="stat" href="#/expeditions?filtre=arrivees">
          <span className="stat-label">Arrivées</span>
          <span className="stat-value">{arrived.length}</span>
          <span className="stat-note">au port, à livrer</span>
        </a>
        <a className="stat stat-wide" href="#/couts">
          <span className="stat-label">Marge de {monthName.format(new Date())}</span>
          <span className={`stat-value stat-money${margin < 0 ? ' neg' : ''}`}>{fcfa(margin)}</span>
          <span className="stat-note">
            {lots ? `sur ${lots} lot${lots > 1 ? 's' : ''} livré${lots > 1 ? 's' : ''}` : 'aucun lot livré ce mois-ci'}
          </span>
        </a>
      </section>

      {late.length > 0 && (
        <section className="section">
          <h2>En retard</h2>
          <div className="list">
            {late.map(({ s }) => (
              <ShipmentRow key={s.id} shipment={s} href={`/expeditions/${s.id}`} />
            ))}
          </div>
        </section>
      )}

      {incomplete.length > 0 && (
        <section className="section">
          <h2>Pièces manquantes</h2>
          <div className="list">
            {incomplete.map(({ s, missing }) => (
              <a key={s.id} className="row" href={`#/documents/${s.id}`}>
                <div className="row-main">
                  <div className="row-title">
                    <strong>{s.reference}</strong>
                    <span className="count-missing">
                      {missing.length} manquante{missing.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="row-sub">{missing.map((t) => DOC_LABEL[t]).join(' · ')}</p>
                </div>
                <Icon name="chevron" size={18} />
              </a>
            ))}
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="section">
          <h2>Prochaines arrivées</h2>
          <div className="list">
            {upcoming.map((s) => (
              <ShipmentRow
                key={s.id}
                shipment={s}
                href={`/expeditions/${s.id}`}
                extra={`Arrivée prévue le ${shortDate(s.planned_arrival)}${s.destination_port ? ` à ${s.destination_port}` : ''}`}
              />
            ))}
          </div>
        </section>
      )}
    </>
  )
}
