import { useState, useEffect } from 'react';
import { getQueue, addToQueue, removeFromQueue, QueueItem } from '../utils/offlineQueue';

export const useOfflineQueue = () => {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  const refreshQueue = async () => {
    try {
      const q = await getQueue();
      setQueue(q);
    } catch (e) {
      console.error("Failed to load offline queue", e);
    }
  };

  useEffect(() => {
    let mounted = true;
    const loadQueue = async () => {
      try {
        const q = await getQueue();
        if (mounted) setQueue(q);
      } catch (e) {
        console.error("Failed to load offline queue", e);
      }
    };
    loadQueue();
    
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      mounted = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const add = async (item: QueueItem) => {
    await addToQueue(item);
    await refreshQueue();
  };

  const remove = async (id: string) => {
    await removeFromQueue(id);
    await refreshQueue();
  };

  return { queue, isOnline, add, remove, refreshQueue };
};
