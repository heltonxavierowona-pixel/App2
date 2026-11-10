import { Component } from 'react'
import type { ReactNode } from 'react'

/** Évite l'écran blanc : toute erreur d'affichage propose de recharger. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error(error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="splash">
        <p role="alert">
          Cet écran n’a pas pu s’afficher. Vérifiez votre connexion, puis rechargez la page. Vos données
          enregistrées ne sont pas perdues.
        </p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          Recharger
        </button>
      </div>
    )
  }
}
