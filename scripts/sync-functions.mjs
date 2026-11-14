// Copie la logique métier partagée dans la fonction serveur des rapports mensuels.
// À relancer après toute modification de ces fichiers : npm run sync:functions
import { copyFileSync } from 'node:fs';

for (const file of ['logic.js', 'overview.js', 'monthly-email.js'])
  copyFileSync(`src/lib/${file}`, `supabase/functions/commerce-monthly-report/${file}`);
console.log('Fonction commerce-monthly-report synchronisée.');
