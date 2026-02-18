// src/hooks/usePlayers.js
import { useEffect, useState } from 'react';
import { fetchPlayers } from '../services/playersService.jsx';

export function usePlayers() {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchPlayers()
      .then(data => {
        if (mounted) setPlayers(data || []);
      })
      .catch(err => {
        if (mounted) setError(err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  return { players, loading, error };
}
