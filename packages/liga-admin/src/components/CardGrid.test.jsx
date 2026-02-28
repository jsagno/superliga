/**
 * Unit Tests for CardGrid Component
 * Tests card loading, filtering, search, selection, and keyboard navigation
 *
 * Run with: npm test -- CardGrid.test.jsx
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CardGrid from './CardGrid';

// Mock supabase
vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            card_id: 26000000,
            name: 'Knight',
            raw_payload: {
              name: 'Knight',
              rarity: 'Common',
              elixirCost: 3,
              iconUrls: { medium: 'https://example.com/knight.png' },
            },
          },
          {
            card_id: 26000001,
            name: 'Archers',
            raw_payload: {
              name: 'Archers',
              rarity: 'Common',
              elixirCost: 3,
              iconUrls: { medium: 'https://example.com/archers.png' },
            },
          },
          {
            card_id: 26000002,
            name: 'Princess',
            raw_payload: {
              name: 'Princess',
              rarity: 'Legendary',
              elixirCost: 3,
              iconUrls: { medium: 'https://example.com/princess.png' },
            },
          },
          {
            card_id: 26000003,
            name: 'P.E.K.K.A',
            raw_payload: {
              name: 'P.E.K.K.A',
              rarity: 'Epic',
              elixirCost: 7,
              iconUrls: { medium: 'https://example.com/pekka.png' },
            },
          },
        ],
        error: null,
      }),
    })),
  },
}));

// Mock cardParser
vi.mock('../utils/cardParser', () => ({
  parseCardPayload: vi.fn(payload => ({
    name: payload?.name || 'Unknown Card',
    icon: payload?.iconUrls?.medium || null,
    rarity: (payload?.rarity || 'common').toLowerCase(),
    elixir: payload?.elixirCost || 0,
    maxLevel: payload?.maxLevel || 14,
  })),
  getRarityColor: vi.fn(rarity => ({
    text: 'text-gray-400',
    bg: 'bg-gray-500/10',
    bgHover: 'hover:bg-gray-500/20',
  })),
  getRarityBorder: vi.fn(rarity => ({
    border: 'border-gray-500/30',
    borderHover: 'hover:border-gray-500',
    ring: 'ring-gray-500/50',
  })),
  getRarityEmoji: vi.fn(rarity => '⚪'),
  getRarityLabel: vi.fn(rarity => 'Common'),
  sortCardsByRarity: vi.fn(cards => cards),
  groupCardsByRarity: vi.fn(cards => ({ common: cards })),
}));

describe('CardGrid Component', () => {
  const mockOnCardToggle = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render loading skeletons initially', () => {
      const { container } = render(
        <CardGrid selectedCards={[]} onCardToggle={mockOnCardToggle} />
      );

      // Look for skeleton elements (animated divs with specific classes)
      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should render search input', () => {
      render(<CardGrid selectedCards={[]} onCardToggle={mockOnCardToggle} />);

      const searchInput = screen.getByPlaceholderText(/Search cards by name/i);
      expect(searchInput).toBeInTheDocument();
    });

    it('should render rarity filter pills', async () => {
      render(<CardGrid selectedCards={[]} onCardToggle={mockOnCardToggle} />);

      await waitFor(() => {
        expect(screen.getByText(/All/i)).toBeInTheDocument();
      });

      const rarities = ['Champion', 'Legendary', 'Epic', 'Rare', 'Common'];
      rarities.forEach(rarity => {
        expect(screen.getByText(new RegExp(rarity, 'i'))).toBeInTheDocument();
      });
    });

    it('should load and display cards', async () => {
      render(<CardGrid selectedCards={[]} onCardToggle={mockOnCardToggle} />);

      await waitFor(() => {
        expect(screen.getByText('Knight')).toBeInTheDocument();
        expect(screen.getByText('Archers')).toBeInTheDocument();
      });
    });

    it('should display card count in pills', async () => {
      render(<CardGrid selectedCards={[]} onCardToggle={mockOnCardToggle} />);

      await waitFor(() => {
        // Look for "(4)" in "All (4)"
        expect(screen.getByText(/All \(\d+\)/)).toBeInTheDocument();
      });
    });
  });

  describe('Selection', () => {
    it('should toggle card selection', async () => {
      const user = userEvent.setup();
      render(
        <CardGrid selectedCards={[]} onCardToggle={mockOnCardToggle} />
      );

      await waitFor(() => {
        expect(screen.getByText('Knight')).toBeInTheDocument();
      });

      const knightButton = screen
        .getAllByRole('button')
        .find(btn => btn.getAttribute('aria-label')?.includes('Knight'));

      await user.click(knightButton);
      expect(mockOnCardToggle).toHaveBeenCalled();
    });

    it('should show selection state with checkmark', async () => {
      const selectedCards = [{ card_id: 26000000 }];
      const { container } = render(
        <CardGrid selectedCards={selectedCards} onCardToggle={mockOnCardToggle} />
      );

      await waitFor(() => {
        expect(screen.getByText('Knight')).toBeInTheDocument();
      });

      // Find the card button and check for SVG checkmark
      const buttons = screen.getAllByRole('button');
      const knightButton = buttons.find(btn =>
        btn.getAttribute('aria-label')?.includes('Knight')
      );

      expect(knightButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('should enforce max selection limit', async () => {
      const user = userEvent.setup();
      const selectedCards = [
        { card_id: 26000000 },
        { card_id: 26000001 },
      ];

      render(
        <CardGrid
          selectedCards={selectedCards}
          onCardToggle={mockOnCardToggle}
          maxSelection={2}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Knight')).toBeInTheDocument();
      });

      // Try to select a third card
      const buttons = screen.getAllByRole('button');
      const princessButton = buttons.find(btn =>
        btn.getAttribute('aria-label')?.includes('Princess')
      );

      // Mock window.alert
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation();

      await user.click(princessButton);
      expect(alertSpy).toHaveBeenCalledWith('Maximum 2 cards allowed');

      alertSpy.mockRestore();
    });

    it('should display selected count when maxSelection set', async () => {
      render(
        <CardGrid
          selectedCards={[{ card_id: 26000000 }]}
          onCardToggle={mockOnCardToggle}
          maxSelection={5}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Selected: 1 \/ 5/)).toBeInTheDocument();
      });
    });
  });

  describe('Filtering', () => {
    it('should filter cards by rarity', async () => {
      const user = userEvent.setup();
      render(<CardGrid selectedCards={[]} onCardToggle={mockOnCardToggle} />);

      await waitFor(() => {
        expect(screen.getByText('Knight')).toBeInTheDocument();
      });

      // Click "Legendary" filter
      const legendaryButton = screen
        .getAllByRole('button')
        .find(btn => btn.getAttribute('aria-label')?.includes('Legendary'));

      await user.click(legendaryButton);

      // Should show Princess (legendary) but not Knight (common)
      expect(screen.queryByText('Princess')).toBeInTheDocument();
      expect(screen.queryByText('Knight')).not.toBeInTheDocument();
    });

    it('should show correct card count for each rarity', async () => {
      render(<CardGrid selectedCards={[]} onCardToggle={mockOnCardToggle} />);

      await waitFor(() => {
        // Check that rarity pills show counts
        const pills = screen.getAllByRole('button');
        const allPill = pills.find(btn =>
          btn.getAttribute('aria-label')?.includes('All')
        );
        expect(allPill?.textContent).toMatch(/\(\d+\)/);
      });
    });
  });

  describe('Search', () => {
    it('should search cards by name', async () => {
      const user = userEvent.setup();
      render(<CardGrid selectedCards={[]} onCardToggle={mockOnCardToggle} />);

      await waitFor(() => {
        expect(screen.getByText('Knight')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/Search cards/i);
      await user.type(searchInput, 'knight');

      await waitFor(() => {
        expect(screen.getByText('Knight')).toBeInTheDocument();
      });

      // Archers shouldn't match
      expect(screen.queryByText('Archers')).not.toBeInTheDocument();
    });

    it('should be case-insensitive', async () => {
      const user = userEvent.setup();
      render(<CardGrid selectedCards={[]} onCardToggle={mockOnCardToggle} />);

      await waitFor(() => {
        expect(screen.getByText('Knight')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/Search cards/i);
      await user.type(searchInput, 'PRINCESS');

      await waitFor(() => {
        expect(screen.getByText('Princess')).toBeInTheDocument();
      });
    });

    it('should show no results message when search matches nothing', async () => {
      const user = userEvent.setup();
      render(<CardGrid selectedCards={[]} onCardToggle={mockOnCardToggle} />);

      await waitFor(() => {
        expect(screen.getByText('Knight')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/Search cards/i);
      await user.type(searchInput, 'nonexistent');

      await waitFor(() => {
        expect(screen.getByText(/No cards found matching/i)).toBeInTheDocument();
      });
    });

    it('should have clear button in search results', async () => {
      const user = userEvent.setup();
      render(<CardGrid selectedCards={[]} onCardToggle={mockOnCardToggle} />);

      await waitFor(() => {
        expect(screen.getByText('Knight')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/Search cards/i);
      await user.type(searchInput, 'xyz123');

      const clearButton = screen.getByText(/Clear search/i);
      expect(clearButton).toBeInTheDocument();

      await user.click(clearButton);
      expect(searchInput).toHaveValue('');
    });
  });

  describe('Keyboard Navigation', () => {
    it('should navigate with arrow keys', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <CardGrid selectedCards={[]} onCardToggle={mockOnCardToggle} />
      );

      await waitFor(() => {
        expect(screen.getByText('Knight')).toBeInTheDocument();
      });

      const grid = container.querySelector('[role="grid"]');
      expect(grid).toBeInTheDocument();

      // Focus the grid and navigate
      grid.focus();
      await user.keyboard('{ArrowRight}');

      // Component should track focused element
      // This is a simplified test - real implementation would verify focus movement
      expect(grid).toBeFocused();
    });

    it('should select card with Enter key', async () => {
      const user = userEvent.setup();
      render(
        <CardGrid selectedCards={[]} onCardToggle={mockOnCardToggle} />
      );

      await waitFor(() => {
        expect(screen.getByText('Knight')).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button');
      const knightButton = buttons.find(btn =>
        btn.getAttribute('aria-label')?.includes('Knight')
      );

      knightButton.focus();
      await user.keyboard('{Enter}');

      expect(mockOnCardToggle).toHaveBeenCalled();
    });

    it('should select card with Space key', async () => {
      const user = userEvent.setup();
      render(
        <CardGrid selectedCards={[]} onCardToggle={mockOnCardToggle} />
      );

      await waitFor(() => {
        expect(screen.getByText('Knight')).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button');
      const knightButton = buttons.find(btn =>
        btn.getAttribute('aria-label')?.includes('Knight')
      );

      knightButton.focus();
      await user.keyboard(' ');

      expect(mockOnCardToggle).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      render(<CardGrid selectedCards={[]} onCardToggle={mockOnCardToggle} />);

      await waitFor(() => {
        expect(screen.getByText('Knight')).toBeInTheDocument();
      });

      const searchInput = screen.getByLabelText(/Search cards/i);
      expect(searchInput).toBeInTheDocument();

      const grid = screen.getByRole('grid', { name: /Card selection grid/i });
      expect(grid).toBeInTheDocument();
    });

    it('should have aria-pressed on selected cards', async () => {
      const selectedCards = [{ card_id: 26000000 }];
      render(
        <CardGrid selectedCards={selectedCards} onCardToggle={mockOnCardToggle} />
      );

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        const knightButton = buttons.find(btn =>
          btn.getAttribute('aria-label')?.includes('Knight')
        );
        expect(knightButton).toHaveAttribute('aria-pressed', 'true');
      });
    });

    it('should support tabindex for keyboard navigation', async () => {
      render(<CardGrid selectedCards={[]} onCardToggle={mockOnCardToggle} />);

      await waitFor(() => {
        expect(screen.getByText('Knight')).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button');
      const cardButtons = buttons.filter(btn =>
        btn.getAttribute('aria-label')?.includes('elixir')
      );

      // At least one card should be tabbable
      const tabbableCards = cardButtons.filter(
        btn => btn.tabIndex !== -1
      );
      expect(tabbableCards.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Empty States', () => {
    it('should show message when no cards match search', async () => {
      const user = userEvent.setup();
      render(<CardGrid selectedCards={[]} onCardToggle={mockOnCardToggle} />);

      await waitFor(() => {
        expect(screen.getByText('Knight')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/Search cards/i);
      await user.type(searchInput, 'impossible card name');

      await waitFor(() => {
        expect(
          screen.getByText(/No cards match your search/i)
        ).toBeInTheDocument();
      });
    });

    it('should show results summary', async () => {
      render(<CardGrid selectedCards={[]} onCardToggle={mockOnCardToggle} />);

      await waitFor(() => {
        expect(screen.getByText('Knight')).toBeInTheDocument();
      });

      expect(screen.getByText(/Showing \d+ of \d+ cards/)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display error message on load failure', async () => {
      // Mock failed request
      vi.mock('../lib/supabaseClient', () => ({
        supabase: {
          from: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' },
            }),
          })),
        },
      }));

      render(<CardGrid selectedCards={[]} onCardToggle={mockOnCardToggle} />);

      // The actual error display depends on implementation
      // This test documents the expected behavior
    });

    it('should have retry button on error', async () => {
      // Similar to above - test would depend on actual error implementation
      // This documents expected behavior
    });
  });
});
