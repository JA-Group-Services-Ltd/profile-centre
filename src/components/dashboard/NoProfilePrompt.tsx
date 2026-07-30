/**
 * NoProfilePrompt
 *
 * Shown on feature pages (WhatsApp, Gallery, Menu, etc.) when the user has
 * no profiles yet — either personal or business.
 *
 * Replaces the old bare "No personal profile found. Please set up your
 * profile first." text with a clear, actionable card that links to both
 * profile creation pages.
 */

import { Link } from 'react-router-dom';
import { User, Building2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NoProfilePromptProps {
  /** Which profile type this feature is for — affects the primary CTA */
  preferredType?: 'personal' | 'business' | 'any';
  /** Feature name shown in the message, e.g. "WhatsApp button" */
  featureName?: string;
}

export default function NoProfilePrompt({
  preferredType = 'any',
  featureName,
}: NoProfilePromptProps) {
  const featureLabel = featureName ? `the ${featureName}` : 'this feature';

  return (
    <div className="rounded-2xl border border-border bg-muted/20 p-6 text-center space-y-4">
      <div className="flex items-center justify-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <User className="w-5 h-5 text-primary" />
        </div>
        {preferredType !== 'personal' && (
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-indigo-400" />
          </div>
        )}
      </div>

      <div>
        <p className="text-sm font-semibold text-foreground mb-1">
          {preferredType === 'business'
            ? 'No business profile yet'
            : preferredType === 'personal'
              ? 'No personal profile yet'
              : 'No profile set up yet'}
        </p>
        <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
          You need to create a profile before you can use {featureLabel}.
          It only takes a minute.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 justify-center">
        {(preferredType === 'personal' || preferredType === 'any') && (
          <Link to="/dashboard/profile">
            <Button size="sm" className="bg-primary gap-2 w-full sm:w-auto">
              <User className="w-3.5 h-3.5" />
              Set up personal profile
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        )}
        {(preferredType === 'business' || preferredType === 'any') && (
          <Link to="/dashboard/business-profile">
            <Button size="sm" variant="outline" className="border-border gap-2 w-full sm:w-auto">
              <Building2 className="w-3.5 h-3.5" />
              Set up business profile
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
