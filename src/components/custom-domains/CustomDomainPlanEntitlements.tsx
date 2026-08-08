import { useEffect, useState } from 'react';
import { Globe2, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Plan {
  id: number;
  name: string;
  slug: string;
  has_custom_domain: number;
  is_active: number;
}

export default function CustomDomainPlanEntitlements() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/admin/plans', { credentials: 'include' });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || 'Could not load plans.');
      setPlans(body.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load plans.');
    } finally { setLoading(false); }
  };

  useEffect(() => { if (open) load(); }, [open]);

  const toggle = async (plan: Plan) => {
    setSavingId(plan.id); setError('');
    try {
      const response = await fetch(`/api/admin/plans/${plan.id}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ has_custom_domain: plan.has_custom_domain ? 0 : 1 }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || 'Could not update the plan.');
      setPlans(current => current.map(item => item.id === plan.id ? { ...item, has_custom_domain: Number(body.data.has_custom_domain ?? !plan.has_custom_domain) } : item));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the plan.');
    } finally { setSavingId(null); }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-24 lg:bottom-6 z-[80] rounded-full shadow-lg border border-border bg-card px-4 py-2.5 text-sm font-medium flex items-center gap-2 hover:bg-muted transition-colors"
      >
        <Globe2 className="w-4 h-4 text-primary" /> Custom Domain access
      </button>
    );
  }

  return (
    <div className="fixed right-4 bottom-24 lg:bottom-6 z-[80] w-[min(92vw,390px)] rounded-2xl border border-border bg-card shadow-2xl p-4">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="font-semibold text-sm">Custom Domain access</p>
          <p className="text-xs text-muted-foreground mt-0.5">Choose which plans can connect customer domains.</p>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
      </div>
      {error && <p className="text-xs text-red-500 bg-red-500/10 rounded-lg p-2 mb-3">{error}</p>}
      {loading ? (
        <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-auto">
          {plans.map(plan => (
            <div key={plan.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{plan.name}</p>
                <p className="text-xs text-muted-foreground font-mono truncate">{plan.slug}</p>
              </div>
              <Button
                size="sm"
                variant={plan.has_custom_domain ? 'default' : 'outline'}
                disabled={savingId === plan.id}
                onClick={() => toggle(plan)}
                className="min-w-20"
              >
                {savingId === plan.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : plan.has_custom_domain ? 'Enabled' : 'Disabled'}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
