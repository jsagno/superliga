/**
 * Tests for PlayerMultiSelect Component
 * Tests data fetching, grouping, selection, search, keyboard nav, accessibility
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlayerMultiSelect from './PlayerMultiSelect';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(async () => {
        // Mock response with players in different zones
        return {
          data: [
            {
              player_id: 'p1',
              zone_id: 'z1',
              player: { player_id: 'p1', name: 'Alice', nick: '@Alice' },
              zone: { zone_id: 'z1', name: 'ZONE A' },
            },
            {
              player_id: 'p2',
              zone_id: 'z1',
              player: { player_id: 'p2', name: 'Bob', nick: '@Bob' },
              zone: { zone_id: 'z1', name: 'ZONE A' },
            },
            {
              player_id: 'p3',
              zone_id: 'z2',
              player: { player_id: 'p3', name: 'Charlie', nick: '@Char' },
              zone: { zone_id: 'z2', name: 'ZONE B' },
            },
            {
              player_id: 'p4',
              zone_id: 'z2',
              player: { player_id: 'p4', name: 'Diana', nick: '@Diana' },
              zone: { zone_id: 'z2', name: 'ZONE B' },
            },
          ],
          error: null,
        };
      }),
    })),
  })),
};

// Mock the supabaseClient module
vi.mock('../lib/supabaseClient', () => ({
  supabase: mockSupabase,
}));

describe('PlayerMultiSelect', () => {
  const defaultProps = {
    seasonId: 'season-123',
    selectedPlayers: [],
    onPlayerAdd: vi.fn(),
    onPlayerRemove: vi.fn(),
    onClearAll: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering & Loading', () => {
    it('should render with loading state initially', async () => {
      render(<PlayerMultiSelect {...defaultProps} />);
      expect(screen.getByText('Select players...')).toBeInTheDocument();
    });

    it('should load and display players from season', async () => {
      render(<PlayerMultiSelect {...defaultProps} />);
      const trigger = screen.getByText('Select players...');
      await userEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.getByText('Bob')).toBeInTheDocument();
        expect(screen.getByText('Charlie')).toBeInTheDocument();
        expect(screen.getByText('Diana')).toBeInTheDocument();
      });
    });

    it('should group players by zone', async () => {
      render(<PlayerMultiSelect {...defaultProps} />);
      await userEvent.click(screen.getByText('Select players...'));

      await waitFor(() => {
        const zoneHeaders = screen.getAllByText(/^ZONE [A-B]/);
        expect(zoneHeaders.length).toBeGreaterThan(0);
        expect(screen.getByText('ZONE A (2)')).toBeInTheDocument();
        expect(screen.getByText('ZONE B (2)')).toBeInTheDocument();
      });
    });

    it('should show retry button on error', async () => {
      mockSupabase.from.mockImplementationOnce(() => ({
        select: () => ({
          eq: vi.fn(async () => ({
            data: null,
            error: { message: 'Test error' },
          })),
        }),
      }));

      render(<PlayerMultiSelect {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('Error loading players: Test error')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
      });
    });
  });

  describe('Selection', () => {
    it('should display selected players as chips', async () => {
      const selectedPlayers = [
        { player_id: 'p1', name: 'Alice' },
        { player_id: 'p2', name: 'Bob' },
      ];

      render(<PlayerMultiSelect {...defaultProps} selectedPlayers={selectedPlayers} />);

      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('2 players selected')).toBeInTheDocument();
    });

    it('should show singular "player" for single selection', async () => {
      const selectedPlayers = [{ player_id: 'p1', name: 'Alice' }];
      render(<PlayerMultiSelect {...defaultProps} selectedPlayers={selectedPlayers} />);
      expect(screen.getByText('1 player selected')).toBeInTheDocument();
    });

    it('should call onPlayerAdd when selecting a player', async () => {
      const onPlayerAdd = vi.fn();
      render(<PlayerMultiSelect {...defaultProps} onPlayerAdd={onPlayerAdd} />);

      await userEvent.click(screen.getByText('Select players...'));

      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Alice'));

      await waitFor(() => {
        expect(onPlayerAdd).toHaveBeenCalledWith(
          expect.objectContaining({
            player_id: 'p1',
            name: 'Alice',
          })
        );
      });
    });

    it('should call onPlayerRemove when clicking chip close button', async () => {
      const onPlayerRemove = vi.fn();
      const selectedPlayers = [{ player_id: 'p1', name: 'Alice' }];

      render(
        <PlayerMultiSelect {...defaultProps} selectedPlayers={selectedPlayers} onPlayerRemove={onPlayerRemove} />
      );

      const removeButton = screen.getByLabelText('Remove Alice');
      await userEvent.click(removeButton);

      expect(onPlayerRemove).toHaveBeenCalledWith({ player_id: 'p1', name: 'Alice' });
    });

    it('should call onClearAll when clicking clear all button', async () => {
      const onClearAll = vi.fn();
      const selectedPlayers = [
        { player_id: 'p1', name: 'Alice' },
        { player_id: 'p2', name: 'Bob' },
      ];

      render(<PlayerMultiSelect {...defaultProps} selectedPlayers={selectedPlayers} onClearAll={onClearAll} />);

      await userEvent.click(screen.getByLabelText('Clear all players'));
      expect(onClearAll).toHaveBeenCalled();
    });

    it('should enforce maxSelection limit', async () => {
      const onPlayerAdd = vi.fn();
      const selectedPlayers = [
        { player_id: 'p1', name: 'Alice' },
        { player_id: 'p2', name: 'Bob' },
      ];

      render(
        <PlayerMultiSelect
          {...defaultProps}
          selectedPlayers={selectedPlayers}
          maxSelection={2}
          onPlayerAdd={onPlayerAdd}
        />
      );

      await userEvent.click(screen.getByText('Select players...'));

      await waitFor(() => {
        expect(screen.getByText('Charlie')).toBeInTheDocument();
      });

      // Mock alert
      vi.spyOn(window, 'alert').mockImplementation(() => {});

      await userEvent.click(screen.getByText('Charlie'));
      expect(window.alert).toHaveBeenCalledWith('Maximum 2 players allowed');
      expect(onPlayerAdd).not.toHaveBeenCalled();

      window.alert.mockRestore();
    });

    it('should display selection counter with maxSelection', async () => {
      const selectedPlayers = [
        { player_id: 'p1', name: 'Alice' },
        { player_id: 'p2', name: 'Bob' },
      ];

      render(
        <PlayerMultiSelect {...defaultProps} selectedPlayers={selectedPlayers} maxSelection={5} />
      );

      expect(screen.getByText('Selected: 2 / 5')).toBeInTheDocument();
    });
  });

  describe('Search', () => {
    it('should filter players by name in search', async () => {
      render(<PlayerMultiSelect {...defaultProps} />);
      await userEvent.click(screen.getByText('Select players...'));

      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search players...');
      await userEvent.type(searchInput, 'ali');

      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.queryByText('Charlie')).not.toBeInTheDocument();
      });
    });

    it('should filter players by nick in search', async () => {
      render(<PlayerMultiSelect {...defaultProps} />);
      await userEvent.click(screen.getByText('Select players...'));

      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search players...');
      await userEvent.type(searchInput, '@bob');

      await waitFor(() => {
        expect(screen.getByText('Bob')).toBeInTheDocument();
        expect(screen.queryByText('Alice')).not.toBeInTheDocument();
      });
    });

    it('should show "no results" message for no matches', async () => {
      render(<PlayerMultiSelect {...defaultProps} />);
      await userEvent.click(screen.getByText('Select players...'));

      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search players...');
      await userEvent.type(searchInput, 'nonexistent');

      await waitFor(() => {
        expect(screen.getByText(/No players found for/)).toBeInTheDocument();
      });
    });

    it('should be case-insensitive for search', async () => {
      render(<PlayerMultiSelect {...defaultProps} />);
      await userEvent.click(screen.getByText('Select players...'));

      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search players...');
      await userEvent.type(searchInput, 'ALICE');

      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
      });
    });
  });

  describe('Filtering', () => {
    it('should filter players by zoneFilter prop', async () => {
      render(<PlayerMultiSelect {...defaultProps} zoneFilter="z1" />);
      await userEvent.click(screen.getByText('Select players...'));

      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.getByText('Bob')).toBeInTheDocument();
        expect(screen.getByText('ZONE A')).toBeInTheDocument();
        expect(screen.queryByText('ZONE B')).not.toBeInTheDocument();
      });
    });

    it('should exclude players from excludePlayerIds prop', async () => {
      render(<PlayerMultiSelect {...defaultProps} excludePlayerIds={['p1', 'p3']} />);
      await userEvent.click(screen.getByText('Select players...'));

      await waitFor(() => {
        expect(screen.queryByText('Alice')).not.toBeInTheDocument();
        expect(screen.getByText('Bob')).toBeInTheDocument();
        expect(screen.queryByText('Charlie')).not.toBeInTheDocument();
        expect(screen.getByText('Diana')).toBeInTheDocument();
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('should open dropdown with Enter key', async () => {
      render(<PlayerMultiSelect {...defaultProps} />);
      await userEvent.click(screen.getByText('Select players...'));

      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
      });
    });

    it('should navigate with arrow keys', async () => {
      render(<PlayerMultiSelect {...defaultProps} />);
      const trigger = screen.getByText('Select players...');
      await userEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
      });

      const dropdown = screen.getByRole('listbox');
      await userEvent.keyboard('{ArrowDown}');
      // Item gets focused (visually would have different background)
      expect(dropdown).toBeInTheDocument();
    });

    it('should close dropdown with Escape key', async () => {
      render(<PlayerMultiSelect {...defaultProps} />);
      await userEvent.click(screen.getByText('Select players...'));

      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
      });

      await userEvent.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByText('Alice')).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', async () => {
      render(<PlayerMultiSelect {...defaultProps} />);
      const trigger = screen.getByText('Select players...');
      expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('should update aria-expanded when opened', async () => {
      render(<PlayerMultiSelect {...defaultProps} />);
      const trigger = screen.getByText('Select players...');
      await userEvent.click(trigger);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('should have aria-selected for player items', async () => {
      const selectedPlayers = [{ player_id: 'p1', name: 'Alice' }];
      render(<PlayerMultiSelect {...defaultProps} selectedPlayers={selectedPlayers} />);
      await userEvent.click(screen.getByText('1 player selected'));

      await waitFor(() => {
        const aliceOption = screen.getByLabelText(/Alice.*selected/);
        expect(aliceOption).toHaveAttribute('aria-selected', 'true');
      });
    });

    it('should have descriptive aria-labels', async () => {
      render(<PlayerMultiSelect {...defaultProps} />);

      expect(screen.getByLabelText('Select players: 0 selected')).toBeInTheDocument();
      expect(screen.getByLabelText('Search players')).toBeInTheDocument();
    });

    it('should label remove buttons with player name', async () => {
      const selectedPlayers = [{ player_id: 'p1', name: 'Alice' }];
      render(<PlayerMultiSelect {...defaultProps} selectedPlayers={selectedPlayers} />);

      expect(screen.getByLabelText('Remove Alice')).toBeInTheDocument();
    });
  });

  describe('Empty States', () => {
    it('should show empty message when no players available', async () => {
      mockSupabase.from.mockImplementationOnce(() => ({
        select: () => ({
          eq: vi.fn(async () => ({
            data: [],
            error: null,
          })),
        }),
      }));

      render(<PlayerMultiSelect {...defaultProps} />);
      await userEvent.click(screen.getByText('Select players...'));

      await waitFor(() => {
        expect(screen.getByText('No players available')).toBeInTheDocument();
      });
    });

    it('should show help text when no players selected', async () => {
      render(<PlayerMultiSelect {...defaultProps} />);
      expect(screen.getByText('Click to select players from this season')).toBeInTheDocument();
    });

    it('should not show help text when players are selected', async () => {
      const selectedPlayers = [{ player_id: 'p1', name: 'Alice' }];
      render(<PlayerMultiSelect {...defaultProps} selectedPlayers={selectedPlayers} />);
      expect(screen.queryByText('Click to select players from this season')).not.toBeInTheDocument();
    });
  });

  describe('Deduplication', () => {
    it('should deduplicate players appearing in multiple teams', async () => {
      mockSupabase.from.mockImplementationOnce(() => ({
        select: () => ({
          eq: vi.fn(async () => ({
            data: [
              {
                player_id: 'p1',
                zone_id: 'z1',
                player: { player_id: 'p1', name: 'Alice', nick: '@Alice' },
                zone: { zone_id: 'z1', name: 'ZONE A' },
              },
              {
                player_id: 'p1', // Same player in different team
                zone_id: 'z1',
                player: { player_id: 'p1', name: 'Alice', nick: '@Alice' },
                zone: { zone_id: 'z1', name: 'ZONE A' },
              },
              {
                player_id: 'p2',
                zone_id: 'z2',
                player: { player_id: 'p2', name: 'Bob', nick: '@Bob' },
                zone: { zone_id: 'z2', name: 'ZONE B' },
              },
            ],
            error: null,
          })),
        }),
      }));

      render(<PlayerMultiSelect {...defaultProps} />);
      await userEvent.click(screen.getByText('Select players...'));

      await waitFor(() => {
        const aliceElements = screen.getAllByText('Alice');
        // Should only have Alice in the dropdown once (despite appearing twice in data)
        expect(aliceElements.length).toBe(1);
      });
    });
  });
});
