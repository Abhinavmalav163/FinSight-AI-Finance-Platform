'use client';
import { useEffect, useState } from 'react';
import { useUser } from "@clerk/nextjs";

export function UserSync() {
  const { isSignedIn, user, isLoaded } = useUser();
  const [isSyncing, setIsSyncing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    let retryTimeout;

    const syncUser = async () => {
      if (!isLoaded || !isSignedIn || isSyncing || !user?.id || retryCount > 2) return;

      try {
        setIsSyncing(true);
        const response = await fetch('/api/user/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({ 
            userId: user.id,
            email: user.primaryEmailAddress?.emailAddress,
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username
          }),
          cache: 'no-store',
        });

        // Check if component is still mounted
        if (!mounted) return;

        let data;
        const responseClone = response.clone();
        try {
          data = await response.json();
        } catch (parseError) {
          const responseText = await responseClone.text();
          console.error('Response parsing error:', responseText);
          if (mounted && retryCount < 2) {
            setRetryCount(prev => prev + 1);
            retryTimeout = setTimeout(syncUser, 1000 * (retryCount + 1));
          }
          return;
        }

        if (!response.ok) {
          throw new Error(data.error || data.message || 'Failed to sync user data');
        }

        if (mounted) {
          console.log('User sync successful:', data.message || 'User synced successfully');
          setRetryCount(0);
        }
      } catch (error) {
        if (mounted) {
          console.error('Error syncing user:', error.message);
          if (retryCount < 2) {
            setRetryCount(prev => prev + 1);
            retryTimeout = setTimeout(syncUser, 1000 * (retryCount + 1));
          }
        }
      } finally {
        if (mounted) {
          setIsSyncing(false);
        }
      }
    };

    syncUser();

    return () => {
      mounted = false;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [isSignedIn, isLoaded, user?.id, retryCount, isSyncing]);

  return null;
}
