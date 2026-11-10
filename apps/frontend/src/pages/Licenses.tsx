import { LicenseApi } from '../api/licenseApi';
import { PageLayout } from '../components/layout/PageLayout';
import { LicenseRow } from '../components/license/LicenseRow';
import { Alert } from '../components/ui/Alert';
import { Panel } from '../components/ui/Panel';
import { useResource } from '../hooks/useResource';

export default function Licenses() {
  const { data: licenses, error, loading } = useResource(LicenseApi.mine, 'licenses');
  return (
    <PageLayout title="Moje licencje" description="Klucze wygenerowane w Twoich zamówieniach.">
      {loading && !licenses && <p role="status">Ładowanie…</p>}
      <Alert>{error}</Alert>
      {licenses && !licenses.length && (
        <Panel className="text-sm text-zinc-400">Nie masz jeszcze żadnych licencji.</Panel>
      )}
      <div className="space-y-4">
        {licenses?.map((license) => (
          <LicenseRow key={license.id} license={license} />
        ))}
      </div>
    </PageLayout>
  );
}
