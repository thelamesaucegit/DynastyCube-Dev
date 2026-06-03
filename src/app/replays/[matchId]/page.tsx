// src/app/replays/[matchId]/page.tsx

import { ReplayPage as ReplayPageComponent } from '@/components/replay/ReplayPage';
import { SettingsProvider } from '@/contexts/SettingsContext';

/**
 * This is the server-side Next.js page component for the public replay route.
 * Its only job is to provide the necessary global context providers and
 * then render the main client-side replay component.
 */
export default function ReplayRoutePage() {
    return (
        <SettingsProvider>
            <ReplayPageComponent />
        </SettingsProvider>
    );
}
