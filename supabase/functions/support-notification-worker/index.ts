import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  DELIVERY_POLICY,
  buildNotificationEmail,
  classifyProviderResult,
  retryAt,
  resolveSupportContact,
  safeFailureCategory,
  safeReference,
} from './core.mjs';

const SUPPORT_DESTINATION = 'rakeezxteam@gmail.com';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

const safeBackendCode = (value: unknown) => {
  const code = String(value ?? 'unknown');
  return /^[A-Z0-9_]{1,32}$/i.test(code) ? code : 'unknown';
};

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}

Deno.serve(async (request) => {
  const schedulerSecret = Deno.env.get('SUPPORT_NOTIFICATION_SCHEDULER_SECRET')?.trim();
  if (!schedulerSecret || request.headers.get('Authorization') !== `Bearer ${schedulerSecret}`) {
    return json({ error: 'unauthorized' }, 401);
  }
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let supabase;
  let cloudflareToken;
  let cloudflareAccount;
  try {
    supabase = createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
      db: { schema: 'rakeezx' },
    });
    cloudflareToken = requiredEnv('CLOUDFLARE_EMAIL_API_TOKEN');
    cloudflareAccount = requiredEnv('CLOUDFLARE_ACCOUNT_ID');
  } catch {
    console.error(JSON.stringify({ state: 'configuration_error', timestamp: new Date().toISOString() }));
    return json({ error: 'configuration' }, 503);
  }

  const { data: jobs, error: claimError } = await supabase.rpc('claim_support_notification_jobs', {
    p_limit: 10,
    p_lease_seconds: DELIVERY_POLICY.leaseSeconds,
  });
  if (claimError) {
    const code = safeBackendCode(claimError.code);
    console.error(JSON.stringify({ state: 'claim_error', code, timestamp: new Date().toISOString() }));
    return json({ error: 'claim', code }, 503);
  }

  const summary = { claimed: jobs?.length ?? 0, delivered: 0, retried: 0, exhausted: 0 };
  for (const job of jobs ?? []) {
    const reference = safeReference(job.support_request_id);
    let outcome = 'permanent_failure';
    let category = 'request_missing';
    try {
      const { data: record, error: loadError } = await supabase
        .from('support_requests')
        .select('id,type,message,diagnostics,created_at')
        .eq('owner_id', job.owner_id)
        .eq('id', job.support_request_id)
        .maybeSingle();
      if (loadError) throw Object.assign(new Error('internal'), { category: 'internal' });
      if (!record) throw Object.assign(new Error('request_missing'), { permanent: true, category: 'request_missing' });

      const contact = await resolveSupportContact(job.owner_id, {
        getAuthUser: async (ownerId: string) => {
          const { data, error } = await supabase.auth.admin.getUserById(ownerId);
          if (error) throw error;
          return data.user;
        },
        getProfile: async (ownerId: string) => {
          const { data, error } = await supabase.from('profile').select('teacher_name').eq('owner_id', ownerId).maybeSingle();
          if (error) throw error;
          return data;
        },
      });
      const email = buildNotificationEmail(record, { to: SUPPORT_DESTINATION, contact });
      if (!email.ok) throw Object.assign(new Error(email.category), { permanent: true, category: email.category });

      let provider;
      try {
        const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cloudflareAccount}/email/sending/send`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${cloudflareToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(email.payload),
          signal: AbortSignal.timeout(10_000),
        });
        provider = classifyProviderResult({ status: response.status, body: await response.json().catch(() => null) });
      } catch (error) {
        provider = classifyProviderResult({ error });
      }
      outcome = provider.outcome;
      category = provider.category;
    } catch (error) {
      const safeError = error as { permanent?: boolean; category?: string; message?: string };
      outcome = safeError?.permanent ? 'permanent_failure' : 'temporary_failure';
      category = safeFailureCategory(safeError?.category ?? safeError?.message);
    }

    const completion = {
      p_owner: job.owner_id,
      p_support_request_id: job.support_request_id,
      p_lease_token: job.lease_token,
      p_outcome: outcome,
      p_failure_category: category,
      p_next_attempt_at: outcome === 'temporary_failure' ? retryAt(job.attempt_count) : null,
    };
    const { data: finalState, error: completionError } = await supabase.rpc('complete_support_notification_job', completion);
    if (completionError) {
      console.error(JSON.stringify({ reference, state: 'completion_error', attempt: job.attempt_count, timestamp: new Date().toISOString() }));
      continue;
    }
    if (finalState === 'delivered') summary.delivered += 1;
    else if (finalState === 'pending') summary.retried += 1;
    else summary.exhausted += 1;
    console.log(JSON.stringify({ reference, state: finalState, attempt: job.attempt_count, category, timestamp: new Date().toISOString() }));
  }
  return json(summary);
});
