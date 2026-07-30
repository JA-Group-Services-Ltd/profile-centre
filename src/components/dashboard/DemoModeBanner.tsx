/**
 * DemoModeBanner
 *
 * Shown at the top of every dashboard page when demo_mode = true.
 * In demo mode, no live data is written — the user can explore freely.
 * A prominent banner makes it impossible to miss.
 */
import { FlaskConical, X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'motion/react';

interface Props {
  onExit: () => void;
  loading?: boolean;
}

export default function DemoModeBanner({ onExit, loading }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
          <FlaskConical className="w-4 h-4 text-amber-500" />
        </div>
        <div className="min-w-0">
          <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">Demo Mode Active</span>
          <span className="text-xs text-amber-600/80 dark:text-amber-400/80 ml-2 hidden sm:inline">
            Nothing you do here goes live. Explore freely — your real data is untouched.
          </span>
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 gap-1.5 flex-shrink-0 h-7 text-xs"
        onClick={onExit}
        disabled={loading}
      >
        <X className="w-3.5 h-3.5" />
        Exit Demo
        <ArrowRight className="w-3 h-3" />
      </Button>
    </motion.div>
  );
}
