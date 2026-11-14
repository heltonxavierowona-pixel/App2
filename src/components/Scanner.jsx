import React, { useEffect, useRef, useState } from 'react';
import { Modal } from '../ui.jsx';

// Lecture d'un code-barres avec la caméra. Utilise le lecteur intégré au navigateur
// quand il existe, sinon une bibliothèque chargée à la demande. La saisie manuelle
// (ou une douchette USB/Bluetooth) fonctionne toujours.
export default function Scanner({ onDetect, onClose, title = 'Scanner un code-barres' }) {
  const video = useRef(null);
  const [error, setError] = useState('');
  const [manual, setManual] = useState('');
  const done = useRef(false);

  useEffect(() => {
    let stop = () => {};
    let cancelled = false;
    const found = (code) => {
      if (done.current || !code) return;
      done.current = true;
      navigator.vibrate?.(60);
      onDetect(String(code));
    };
    (async () => {
      try {
        if ('BarcodeDetector' in window) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
          video.current.srcObject = stream;
          await video.current.play();
          const detector = new window.BarcodeDetector();
          const timer = setInterval(async () => {
            try { const codes = await detector.detect(video.current); if (codes[0]) found(codes[0].rawValue); } catch { /* image pas prête */ }
          }, 250);
          stop = () => { clearInterval(timer); stream.getTracks().forEach((t) => t.stop()); };
        } else {
          const { BrowserMultiFormatReader } = await import('@zxing/browser');
          const controls = await new BrowserMultiFormatReader().decodeFromConstraints(
            { video: { facingMode: 'environment' } }, video.current, (result) => result && found(result.getText()));
          if (cancelled) controls.stop(); else stop = () => controls.stop();
        }
      } catch {
        setError("Caméra indisponible ou non autorisée. Saisissez le code ci-dessous.");
      }
    })();
    return () => { cancelled = true; stop(); };
  }, [onDetect]);

  return (
    <Modal title={title} onClose={onClose}>
      {error ? <p className="note">{error}</p> : (
        <div className="scanner"><video ref={video} muted playsInline /><span className="scan-line" /></div>
      )}
      <form className="row" onSubmit={(e) => { e.preventDefault(); if (manual.trim()) onDetect(manual.trim()); }}>
        <input placeholder="Ou saisir le code…" value={manual} onChange={(e) => setManual(e.target.value)} inputMode="numeric" />
        <button className="btn" type="submit">Valider</button>
      </form>
    </Modal>
  );
}
