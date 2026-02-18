import { fetchPlayers } from './playersService';

test('fetchPlayers returns array (integration, requires Supabase)', async () => {
  const data = await fetchPlayers();
  expect(Array.isArray(data)).toBe(true);
});
