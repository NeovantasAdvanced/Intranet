import { Card } from '../components/ui/Card';
import { SectionHeader } from '../components/ui/SectionHeader';
import { useAuthSession } from '../context/AuthSessionContext';
import { canAccessFeature, isAdmin } from '../lib/accessControl';

type ClaimRecord = {
  typ?: string;
  val?: string;
};

function getIdentityValue(principal: Record<string, unknown> | null, keys: string[]) {
  if (!principal) {
    return '';
  }

  for (const key of keys) {
    const value = principal[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function getClaimValue(claims: ClaimRecord[] | undefined, patterns: string[]) {
  if (!claims?.length) {
    return '';
  }

  const match = claims.find((claim) => {
    const type = String(claim.typ ?? '').toLowerCase();
    return patterns.some((pattern) => type.includes(pattern));
  });

  return match?.val?.trim() ?? '';
}

function getUserClaims(principal: Record<string, unknown> | null) {
  const claims = Array.isArray(principal?.claims) ? (principal?.claims as ClaimRecord[]) : [];
  return claims.map((claim) => ({
    typ: claim.typ ?? '',
    val: claim.val ?? '',
  }));
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <Card className="border border-neovantas-line bg-white p-5 shadow-[0_8px_24px_rgba(11,27,54,0.04)]">
      <p className="text-sm font-semibold text-neovantas-navy">{title}</p>
      <pre className="mt-3 overflow-x-auto rounded-2xl bg-[#0A0A3F] p-4 text-xs leading-6 text-white">
        {JSON.stringify(value, null, 2)}
      </pre>
    </Card>
  );
}

export function AdminProfileDiagnosticsPage() {
  const { clientPrincipal, displayName } = useAuthSession();
  const principal = (clientPrincipal ?? null) as Record<string, unknown> | null;
  const userEmail = String(principal?.userDetails ?? '').trim();
  const adminAllowed = isAdmin(userEmail);

  const claims = getUserClaims(principal);
  const claimDisplayName = getClaimValue(claims, ['name']);
  const claimGivenName = getClaimValue(claims, ['given_name', 'givenname']);
  const claimSurname = getClaimValue(claims, ['family_name', 'surname']);
  const claimEmail = getClaimValue(claims, ['email', 'preferred_username', 'upn']);
  const claimJobTitle = getClaimValue(claims, ['jobtitle']);
  const claimDepartment = getClaimValue(claims, ['department']);
  const claimOfficeLocation = getClaimValue(claims, ['officelocation']);

  const authSnapshot = {
    userDetails: principal?.userDetails ?? '',
    userId: getIdentityValue(principal, ['userId', 'user_id', 'oid']),
    identityProvider: principal?.identityProvider ?? '',
    userRoles: Array.isArray(principal?.userRoles) ? principal?.userRoles : [],
    claims,
  };

  const identityProfile = {
    displayName: getIdentityValue(principal, ['displayName']) || displayName || claimDisplayName,
    givenName: getIdentityValue(principal, ['givenName']) || claimGivenName,
    surname: getIdentityValue(principal, ['surname']) || claimSurname,
    email: getIdentityValue(principal, ['email']) || claimEmail || userEmail,
    userPrincipalName: getIdentityValue(principal, ['userPrincipalName']) || claimEmail || userEmail,
    jobTitle: getIdentityValue(principal, ['jobTitle']) || claimJobTitle,
    department: getIdentityValue(principal, ['department']) || claimDepartment,
    officeLocation: getIdentityValue(principal, ['officeLocation']) || claimOfficeLocation,
  };

  const graphAvailable = Boolean(import.meta.env.VITE_GRAPH_ENABLED);
  const canRepositories = canAccessFeature('repositories', userEmail);
  const repoReason = !identityProfile.jobTitle && !identityProfile.department
    ? 'sin datos'
    : canRepositories
      ? identityProfile.jobTitle
        ? 'por cargo'
        : 'por email permitido'
      : 'bloqueado';

  if (!adminAllowed) {
    return <Card className="p-8 text-neovantas-navy">No tienes permisos para acceder a esta sección.</Card>;
  }

  return (
    <section className="space-y-6">
      <SectionHeader
        title="Diagnóstico de perfil de usuario"
        description="Pantalla temporal para inspeccionar los datos que devuelve Microsoft Entra ID antes de ajustar permisos por cargo."
      />

      <Card className="border border-neovantas-line bg-white p-5 shadow-[0_8px_24px_rgba(11,27,54,0.04)]">
        <p className="text-sm font-semibold text-neovantas-navy">Microsoft Graph ampliado</p>
        <p className="mt-2 text-sm text-neovantas-muted">
          {graphAvailable ? 'Conectado.' : 'Microsoft Graph ampliado no configurado todavía.'}
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <JsonBlock title="Datos de autenticación desde /.auth/me" value={authSnapshot} />
        <JsonBlock title="Perfil de identidad detectado" value={identityProfile} />
      </div>

      <Card className="border border-neovantas-line bg-white p-5 shadow-[0_8px_24px_rgba(11,27,54,0.04)]">
        <p className="text-sm font-semibold text-neovantas-navy">Evaluación de acceso a Repositorios</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neovantas-muted">jobTitle detectado</p>
            <p className="mt-1 text-sm text-neovantas-navy">{identityProfile.jobTitle || 'Sin datos'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neovantas-muted">department detectado</p>
            <p className="mt-1 text-sm text-neovantas-navy">{identityProfile.department || 'Sin datos'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neovantas-muted">Acceso calculado</p>
            <p className="mt-1 text-sm text-neovantas-navy">{canRepositories ? 'Sí' : 'No'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neovantas-muted">Motivo</p>
            <p className="mt-1 text-sm text-neovantas-navy">{repoReason}</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-neovantas-muted">No se guarda ningún dato personal en esta pantalla.</p>
      </Card>
    </section>
  );
}
