import { WifiOff, Wifi } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { motion, AnimatePresence } from 'motion/react';

/**
 * OfflineBanner
 *
 * Shows a sticky banner at the top of the page when the device loses internet.
 * When connection is restored it briefly shows a "back online" confirmation
 * then disappears automatically.
 *
 * - Offline: red/amber persistent banner — stays until reconnected
 * - Back online: green banner — auto-dismisses after 4 seconds
 */
export default function OfflineBanner() {
  const { isOnline, wasOffline } = useOnlineStatus();

  const showOffline  = !isOnline;
  const showOnline   = isOnline && wasOffline;
  const show         = showOffline || showOnline;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key={showOffline ? 'offline' : 'online'}
          initial={{ y: -48, opacity: 0 }}
          animate={{ y: 0,   opacity: 1 }}
          exit={{    y: -48, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className={[
            'fixed top-0 left-0 right-0 z-[99999]',
            'flex items-center justify-center gap-2',
            'px-4 py-2.5 text-sm font-medium',
            showOffline
              ? 'bg-red-600 text-white'
              : 'bg-green-600 text-white',
          ].join(' ')}
          role="status"
          aria-live="polite"
        >
          {showOffline ? (
            <>
              <WifiOff className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              <span>You're offline — check your internet connection</span>
            </>
          ) : (
            <>
              <Wifi className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              <span>Back online</span>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
