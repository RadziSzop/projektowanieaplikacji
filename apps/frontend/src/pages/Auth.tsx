import { useLocation, useNavigate } from 'react-router-dom';
import { LoginForm } from '../components/auth/LoginForm';
import { RegisterForm } from '../components/auth/RegisterForm';
import { PageLayout } from '../components/layout/PageLayout';
import { Panel } from '../components/ui/Panel';
import { TextLink } from '../components/ui/TextLink';

export default function Auth({ register }: { register: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from === '/zamowienie' ? '/zamowienie' : '/';

  return (
    <PageLayout
      title={register ? 'Rejestracja' : 'Logowanie'}
      description={
        from === '/zamowienie'
          ? 'Zaloguj się, aby złożyć zamówienie.'
          : register
            ? 'Podaj dane do utworzenia konta.'
            : 'Wprowadź dane swojego konta.'
      }
      width="narrow"
    >
      <Panel>
        {register ? (
          <RegisterForm />
        ) : (
          <LoginForm onSuccess={() => navigate(from, { replace: true })} />
        )}
      </Panel>
      <TextLink
        className="block text-center"
        to={register ? '/logowanie' : '/rejestracja'}
        state={{ from }}
      >
        {register ? 'Masz konto? Zaloguj się' : 'Nie masz konta? Zarejestruj się'}
      </TextLink>
    </PageLayout>
  );
}
