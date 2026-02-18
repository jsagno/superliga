import { renderHook } from '@testing-library/react';
import { usePlayers } from './usePlayers';

test('usePlayers returns loading then data', async () => {
  const { result, waitForNextUpdate } = renderHook(() => usePlayers());
  expect(result.current.loading).toBe(true);
  await waitForNextUpdate();
  expect(Array.isArray(result.current.players)).toBe(true);
});
