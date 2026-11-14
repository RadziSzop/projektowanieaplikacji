import { formatDate, licenseState, type LicenseState } from '../../services/licenseStatus';
import type { License } from '../../types';
import { Button } from '../ui/Button';
import { Panel } from '../ui/Panel';
import { useToast } from '../Toast';

const states: Record<LicenseState, { label: string; className: string }> = {
  active: { label: 'Aktywna', className: 'border-emerald-800 text-emerald-300' },
  expired: { label: 'Wygasła', className: 'border-amber-800 text-amber-300' },
  revoked: { label: 'Unieważniona', className: 'border-red-900 text-red-300' },
};

export function LicenseRow({ license }: { license: License }) {
  const toast = useToast();
  const state = states[licenseState(license)];

  function copy() {
    navigator.clipboard.writeText(license.key).then(
      () => toast('Skopiowano klucz.'),
      () => toast('Nie udało się skopiować klucza.', 'error'),
    );
  }

  return (
    <Panel className="flex flex-wrap items-center gap-4">
      <div className="min-w-0 flex-1 space-y-1">
        <code className="block break-all text-sm">{license.key}</code>
        <p className="text-xs text-zinc-400">
          {license.expiresAt ? `Ważna do ${formatDate(license.expiresAt)}` : 'Bezterminowa'}
        </p>
      </div>
      <span className={`rounded-md border px-2 py-1 text-xs ${state.className}`}>
        {state.label}
      </span>
      <Button variant="secondary" onClick={copy}>
        Kopiuj
      </Button>
    </Panel>
  );
}
