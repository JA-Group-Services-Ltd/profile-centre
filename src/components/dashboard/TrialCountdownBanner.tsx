/**
 * TrialCountdownBanner
 * Shown at the top of every dashboard page when the user has an active free trial.
 * Displays a live countdown and disappears once the trial expires.
 */
import { useState, useEffect } from 'react';
import { Clock, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface Props {
  trialEndsAt: string; // ISO timestamp
}

function getTimeLeft(endsAt: Date) {
  const diff = endsAt.getTime() - Date.now();
  if (diff <= 0) return null;

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return { days, hours, minutes, seconds, diff };
}

export default function TrialCountdownBanner({ trialEndsAt }: Props) {
  const endsAt = new Date(trialEndsAt);
  const [timeLeft, setTimeLeft] = useState(getTimeLeft(endsAt));
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(getTimeLeft(endsAt));
    }, 1000);
    return () => clearInterval(timer);
  }, [trialEndsAt]);

  if (dismissed || !timeLeft) return null;

  const isUrgent = timeLeft.days < 3;

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className={`relative flex items-center gap-3 px-4 py-3 rounded-xl border text-sm mb-6 ${
      isUrgent
        ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400'
        : 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-400'
    }`}>
      <Clock className="w-4 h-4 flex-shrink-0" />

      <div className="flex-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium text-slate-900 dark:text-foreground">
          {isUrgent ? 'Your free trial is ending soon!' : 'Free trial active'}
        </span>
        <span className="text-slate-600 dark:text-muted-foreground text-xs">
          {timeLeft.days > 0
            ? `${timeLeft.days}d ${pad(timeLeft.hours)}h ${pad(timeLeft.minutes)}m remaining`
            : `${pad(timeLeft.hours)}h ${pad(timeLeft.minutes)}m ${pad(timeLeft.seconds)}s remaining`}
        </span>

        {/* Countdown blocks */}
        <div className="flex items-center gap-1.5">
          {timeLeft.days > 0 && (
            <>
              <span className={`font-mono font-bold text-base tabular-nums ${isUrgent ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                {timeLeft.days}
              </span>
              <span className="text-slate-500 dark:text-muted-foreground text-xs">days</span>
            </>
          )}
          <span className={`font-mono font-bold text-base tabular-nums ${isUrgent ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
            {pad(timeLeft.hours)}
          </span>
          <span className="text-slate-500 dark:text-muted-foreground text-xs">h</span>
          <span className={`font-mono font-bold text-base tabular-nums ${isUrgent ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
            {pad(timeLeft.minutes)}
          </span>
          <span className="text-slate-500 dark:text-muted-foreground text-xs">m</span>
          <span className={`font-mono font-bold text-base tabular-nums ${isUrgent ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
            {pad(timeLeft.seconds)}
          </span>
          <span className="text-slate-500 dark:text-muted-foreground text-xs">s</span>
        </div>
      </div>

      <Link to="/dashboard/billing">
        <Button
          size="sm"
          className={`gap-1.5 text-xs h-7 px-3 ${
            isUrgent
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          Pick a plan <ArrowRight className="w-3 h-3" />
        </Button>
      </Link>

      <button
        onClick={() => setDismissed(true)}
        className="text-slate-400 hover:text-slate-700 dark:text-muted-foreground dark:hover:text-foreground transition-colors ml-1"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
