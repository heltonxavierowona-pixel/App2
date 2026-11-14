import { useRef, useState } from 'react'
import { useProductSummary } from '../components/ShipmentRow.tsx'
import { Empty, Icon, Notice, PageHeader, StatusBadge } from '../components/ui.tsx'
import { DOC_LABEL, DOC_TYPES } from '../lib/constants.ts'
import { missingDocs } from '../lib/costs.ts'
import { fullDate } from '../lib/format.ts'
import { useStore } from '../lib/store.tsx'
import { explain, supabase } from '../lib/supabase.ts'
import type { Doc, DocType, Shipment } from '../lib/types.ts'
import { ACCEPTED_TYPES, MAX_UPLOAD_BYTES, prepareFile } from '../lib/upload.ts'

export default function Documents({ rest }: { rest: string[] }) {
  const { shipments } = useStore()
  if (rest[0]) {
    const shipment = shipments.find((s) => s.id === rest[0])
    return shipment ? (
      <ShipmentDocs key={shipment.id} shipment={shipment} />
    ) : (
      <>
        <PageHeader title="Expédition introuvable" back="/documents" />
        <Empty title="Cette expédition n’existe pas ou a été supprimée." />
      </>
    )
  }
  return <DocsList />
}

/** Cinq pastilles : pleine = validée, cerclée = déposée, vide = manquante. */
function Pips({ shipment }: { shipment: Shipment }) {
  const missing = missingDocs(shipment).length
  return (
    <span
      className="pips"
      role="img"
      aria-label={`${DOC_TYPES.length - missing} pièces sur ${DOC_TYPES.length} déposées`}
    >
      {DOC_TYPES.map((t) => {
        const doc = shipment.documents.find((d) => d.doc_type === t)
        return <i key={t} className={doc ? `pip pip-${doc.status}` : 'pip'} />
      })}
    </span>
  )
}

function DocsList() {
  const { shipments, orderOf, supplierOf } = useStore()
  const summary = useProductSummary()
  const sorted = [...shipments].sort(
    (a, b) =>
      Number(a.status === 'delivered') - Number(b.status === 'delivered') ||
      missingDocs(b).length - missingDocs(a).length,
  )
  const totalMissing = shipments
    .filter((s) => s.status !== 'delivered')
    .reduce((n, s) => n + missingDocs(s).length, 0)

  return (
    <>
      <PageHeader title="Documents">
        {shipments.length > 0 && (
          <p className="page-sub">
            {totalMissing
              ? `${totalMissing} pièce${totalMissing > 1 ? 's' : ''} manquante${totalMissing > 1 ? 's' : ''} sur les expéditions en cours.`
              : 'Tous les dossiers en cours sont complets.'}
          </p>
        )}
      </PageHeader>
      {shipments.length === 0 ? (
        <Empty title="Aucun dossier">
          <p>Les pièces se déposent expédition par expédition. Créez d’abord une expédition.</p>
        </Empty>
      ) : (
        <div className="list">
          {sorted.map((s) => {
            const missing = missingDocs(s).length
            return (
              <a key={s.id} className="row" href={`#/documents/${s.id}`}>
                <div className="row-main">
                  <div className="row-title">
                    <strong>{s.reference}</strong>
                    <StatusBadge status={s.status} />
                  </div>
                  <p className="row-sub">
                    {summary(s)} · {supplierOf(orderOf(s))?.name}
                  </p>
                  <p className="row-meta docs-meta">
                    <Pips shipment={s} />
                    {missing ? (
                      <span className="count-missing">
                        {missing} manquante{missing > 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="count-ok">Dossier complet</span>
                    )}
                  </p>
                </div>
                <Icon name="chevron" size={18} />
              </a>
            )
          })}
        </div>
      )}
    </>
  )
}

function ShipmentDocs({ shipment: s }: { shipment: Shipment }) {
  const { org, session, reload } = useStore()
  const [busy, setBusy] = useState<DocType | null>(null)
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const target = useRef<DocType | null>(null)
  const missing = missingDocs(s).length

  function choose(type: DocType) {
    target.current = type
    input.current?.click()
  }

  async function upload(file: File | undefined) {
    const type = target.current
    if (!file || !type) return
    setError('')
    if (!ACCEPTED_TYPES.includes(file.type)) return setError('Format non accepté. Déposez un PDF ou une photo (JPEG, PNG).')
    setBusy(type)
    try {
      const ready = await prepareFile(file)
      if (ready.size > MAX_UPLOAD_BYTES) throw new Error('Fichier trop lourd : 10 Mo au maximum.')
      const ext = ready.name.split('.').pop()?.toLowerCase() ?? 'bin'
      const path = `${org.id}/${s.id}/${type}-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('documents').upload(path, ready, { contentType: ready.type })
      if (upErr) throw upErr
      const previous = s.documents.find((d) => d.doc_type === type)
      const { error: err } = await supabase.from('documents').upsert(
        {
          organization_id: org.id,
          shipment_id: s.id,
          doc_type: type,
          status: 'uploaded',
          file_path: path,
          file_name: file.name,
          file_size: ready.size,
          uploaded_by: session.user.id,
          uploaded_at: new Date().toISOString(),
        },
        { onConflict: 'shipment_id,doc_type' },
      )
      if (err) {
        await supabase.storage.from('documents').remove([path])
        throw err
      }
      if (previous?.file_path) await supabase.storage.from('documents').remove([previous.file_path])
      await reload(['shipments'])
    } catch (err) {
      setError(explain(err))
    }
    setBusy(null)
  }

  async function open(doc: Doc) {
    setError('')
    if (!doc.file_path) return setError('Pièce de démonstration : aucun fichier n’est associé.')
    // Onglet ouvert tout de suite, sinon le navigateur mobile bloque la fenêtre.
    const tab = window.open('', '_blank')
    const { data, error: err } = await supabase.storage.from('documents').createSignedUrl(doc.file_path, 300)
    if (err || !data) {
      tab?.close()
      return setError(explain(err))
    }
    if (tab) tab.location.href = data.signedUrl
    else window.location.href = data.signedUrl
  }

  async function setStatus(doc: Doc, status: Doc['status']) {
    setBusy(doc.doc_type)
    const { error: err } = await supabase.from('documents').update({ status }).eq('id', doc.id)
    if (err) setError(explain(err))
    else await reload(['shipments'])
    setBusy(null)
  }

  async function remove(doc: Doc) {
    if (!window.confirm(`Retirer « ${DOC_LABEL[doc.doc_type]} » du dossier ?`)) return
    setBusy(doc.doc_type)
    const { error: err } = await supabase.from('documents').delete().eq('id', doc.id)
    if (err) setError(explain(err))
    else {
      if (doc.file_path) await supabase.storage.from('documents').remove([doc.file_path])
      await reload(['shipments'])
    }
    setBusy(null)
  }

  return (
    <>
      <PageHeader title={`Dossier ${s.reference}`} back="/documents">
        <p className="page-sub">
          <StatusBadge status={s.status} />
          <span>
            {missing
              ? `${missing} pièce${missing > 1 ? 's' : ''} manquante${missing > 1 ? 's' : ''} sur ${DOC_TYPES.length}`
              : 'Dossier complet'}
          </span>
        </p>
      </PageHeader>
      {error && <Notice>{error}</Notice>}
      <input
        ref={input}
        type="file"
        hidden
        accept={ACCEPTED_TYPES.join(',')}
        onChange={(e) => {
          void upload(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <ul className="docs">
        {DOC_TYPES.map((type) => {
          const doc = s.documents.find((d) => d.doc_type === type)
          const working = busy === type
          return (
            <li key={type} className={`doc doc-${doc?.status ?? 'missing'}`}>
              <div className="doc-head">
                <span className="doc-state" aria-hidden="true">
                  {doc ? <Icon name={doc.status === 'validated' ? 'check' : 'file'} size={18} /> : <Icon name="alert" size={18} />}
                </span>
                <div>
                  <strong>{DOC_LABEL[type]}</strong>
                  <p>
                    {working
                      ? 'Envoi en cours…'
                      : !doc
                        ? 'Manquante'
                        : `${doc.status === 'validated' ? 'Validée' : 'Déposée, à valider'} · ${fullDate(doc.uploaded_at)}`}
                  </p>
                </div>
              </div>
              <div className="doc-actions">
                {!doc ? (
                  <button className="btn btn-primary" onClick={() => choose(type)} disabled={working}>
                    <Icon name="upload" />
                    Déposer
                  </button>
                ) : (
                  <>
                    <button className="btn" onClick={() => open(doc)} disabled={working}>
                      <Icon name="eye" />
                      Voir
                    </button>
                    {doc.status === 'uploaded' && (
                      <button className="btn" onClick={() => setStatus(doc, 'validated')} disabled={working}>
                        <Icon name="check" />
                        Valider
                      </button>
                    )}
                    <button className="btn" onClick={() => choose(type)} disabled={working}>
                      Remplacer
                    </button>
                    <button
                      className="btn-icon"
                      onClick={() => remove(doc)}
                      disabled={working}
                      aria-label={`Retirer ${DOC_LABEL[type]}`}
                    >
                      <Icon name="trash" size={18} />
                    </button>
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      <p className="muted small">PDF ou photo, 10 Mo au maximum. Les photos sont allégées avant l’envoi.</p>
    </>
  )
}
