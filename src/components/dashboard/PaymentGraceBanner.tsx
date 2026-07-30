/**
 * PaymentGraceBanner
 *
 * Shown at the top of every dashboard page when a Stripe payment has failed
 * and the user is within the 7-day grace period before their account is
 * downgraded to no-plan.
 *
 * - Displays a live countdown to the grace deadline.
 * - Links to the billing page so the user can update their payment method.
 * - Cannot be permanently dismissed (it's urgent — they must act).
 * - Turns red when fewer than 2 days remain.
 */
import { useState, useEffect } from 'react';
import { AlertTriangle, CreditCard, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface Props {
  paymentGraceUntil: string; // ISO timestamp — deadline before downgrade
}

function getTimeLeft(deadline: Date) {
  const diff = deadline.getTime() - Date.now();
  if (diff <= 0) return null;

  const days    = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours   = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return { days, hours, minutes, seconds };
}

const pad = (n: number) => String(n).padStart(2, '0');

export default function PaymentGraceBanner({ paymentGraceUntil }: Props) {
  const deadline = new Date(paymentGraceUntil);
  const [timeLeft, setTimeLeft] = useState(getTimeLeft(deadline));

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(getTimeLeft(deadline)), 1000);
    return () => clearInterval(timer);
  }, [paymentGraceUntil]);

  // Grace period expired — the next page load will trigger the downgrade in entitlement
  if (!timeLeft) return null;

  const isCritical = timeLeft.days < 2;

  return (
    <div
      role="alert"
      className={`relative flex items-start gap-3 px-4 py-3 rounded-xl border text-sm mb-6 ${
        isCritical
          ? 'bg-red-50 dark:bg-red-500/10 border-red-300 dark:border-red-500/40 text-red-700 dark:text-red-400'
          : 'bg-orange-50 dark:bg-orange-500/10 border-orange-300 dark:border-orange-500/40 text-orange-700 dark:text-orange-400'
      }`}
    >
      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-900 dark:text-foreground mb-0.5">
          {isCritical
            ? 'Payment overdue — your account will be downgraded very soon'
            : 'Payment failed — please update your payment method'}
        </p>
        <p className="text-xs text-slate-600 dark:text-muted-foreground leading-relaxed">
          Your last payment could not be processed. You have{' '}
          <span className="font-semibold">
            {timeLeft.days > 0
              ? `${timeLeft.days}d ${pad(timeLeft.hours)}h ${pad(timeLeft.minutes)}m`
              : `${pad(timeLeft.hours)}h ${pad(timeLeft.minutes)}m ${pad(timeLeft.seconds)}s`}
          </span>{' '}
          to update your payment details before your account is downgraded and access is removed.
        </p>

        {/* Countdown blocks */}
        <div className="flex items-center gap-2 mt-2">
          {timeLeft.days > 0 && (
            <span className={`font-mono font-bold text-lg tabular-nums ${isCritical ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'}`}>
              {timeLeft.days}<span className="text-xs font-normal ml-0.5 text-slate-500 dark:text-muted-foreground">d</span>
            </span>
          )}
          <span className={`font-mono font-bold text-lg tabular-nums ${isCritical ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'}`}>
            {pad(timeLeft.hours)}<span className="text-xs font-normal ml-0.5 text-slate-500 dark:text-muted-foreground">h</span>
          </span>
          <span className={`font-mono font-bold text-lg tabular-nums ${isCritical ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'}`}>
            {pad(timeLeft.minutes)}<span className="text-xs font-normal ml-0.5 text-slate-500 dark:text-muted-foreground">m</span>
          </span>
          <span className={`font-mono font-bold text-lg tabular-nums ${isCritical ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'}`}>
            {pad(timeLeft.seconds)}<span className="text-xs font-normal ml-0.5 text-slate-500 dark:text-muted-foreground">s</span>
          </span>
          <span className="text-xs text-slate-500 dark:text-muted-foreground ml-1">until downgrade</span>
        </div>
      </div>

      <Link to="/dashboard/billing" className="flex-shrink-0 self-center">
        <Button
          size="sm"
          className={`gap-1.5 text-xs h-8 px-3 ${
            isCritical
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-orange-600 hover:bg-orange-700 text-white'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          Update payment <ArrowRight className="w-3 h-3" />
        </Button>
      </Link>
    </div>
  );
}
