import React, { useState } from 'react';
import { BRAND_SITE } from '../config.js';

// Logo officiel Numera (chargé depuis le site Numera), avec le nom du produit.
// Tant que l'image n'est pas chargée (ou hors connexion), le nom s'affiche en toutes lettres.
export default function Logo({ size = 28, stacked = false }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <span className={`logo${stacked ? ' stacked' : ''}`}>
      {!loaded && <span className="logo-word" style={{ fontSize: size * 0.8 }}>NUMERA</span>}
      <img src={`${BRAND_SITE}/numera-logo.png`} alt={loaded ? 'Numera' : ''}
        style={{ height: size, display: loaded ? 'block' : 'none' }} onLoad={() => setLoaded(true)} />
      <span className="logo-product">COMMERCIAL AI</span>
    </span>
  );
}
