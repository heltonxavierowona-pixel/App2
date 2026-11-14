import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base relative : l'application fonctionne à la racine d'un domaine comme dans un sous-dossier.
export default defineConfig({ base: './', plugins: [react()] });
