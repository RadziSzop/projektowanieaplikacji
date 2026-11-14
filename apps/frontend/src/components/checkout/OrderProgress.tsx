import type { Progress } from '../../services/orderStatus';
import { Section } from '../ui/Panel';

export function OrderProgress({ progress }: { progress: Progress }) {
  return (
    <Section title="Status realizacji">
      <ul className="space-y-1 text-sm text-zinc-300">
        <li>
          Wygenerowane klucze: {progress.generated} z {progress.total}
        </li>
        <li>
          Wysłane e-maile: {progress.emailsSent} z {progress.total}
        </li>
        {progress.failed > 0 && <li className="text-red-300">Nieudane: {progress.failed}</li>}
      </ul>
      {progress.pending && (
        <p role="status" className="text-sm text-zinc-400">
          Trwa realizacja, status odświeża się automatycznie…
        </p>
      )}
    </Section>
  );
}
