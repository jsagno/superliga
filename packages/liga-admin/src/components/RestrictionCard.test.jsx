/**
 * Tests for RestrictionCard Component
 * Tests rendering, card grouping, deletion, and accessibility
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RestrictionCard from './RestrictionCard';

describe('RestrictionCard', () => {
  const mockPlayer = {
    player_id: 'p1',
    name: 'Alice',
    nick: '@Alice',
    zone_name: 'ZONE A',
  };

  const mockRestrictions = [
    {
      restriction_id: 'r1',
      card_id: 1,
      card_name: 'P.E.K.K.A',
      rarity: 'Legendary',
      created_at: '2025-02-27T10:00:00Z',
    },
    {
      restriction_id: 'r2',
      card_id: 2,
      card_name: 'Princess',
      rarity: 'Legendary',
      created_at: '2025-02-27T10:00:00Z',
    },
    {
      restriction_id: 'r3',
      card_id: 3,
      card_name: 'Knight',
      rarity: 'Common',
      created_at: '2025-02-27T10:00:00Z',
    },
    {
      restriction_id: 'r4',
      card_id: 4,
      card_name: 'Fireball',
      rarity: 'Rare',
      created_at: '2025-02-27T10:00:00Z',
    },
  ];

  const defaultProps = {
    player: mockPlayer,
    restrictedCards: mockRestrictions,
    onDeleteCard: vi.fn(),
    onDeleteAll: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render player information', () => {
      render(<RestrictionCard {...defaultProps} />);
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('@Alice • ZONE A')).toBeInTheDocument();
    });

    it('should display empty state when no restrictions', () => {
      const emptyProps = { ...defaultProps, restrictedCards: [] };
      render(<RestrictionCard {...emptyProps} />);
      expect(screen.getByText('Alice has no restricted cards')).toBeInTheDocument();
    });

    it('should display card count badge', () => {
      render(<RestrictionCard {...defaultProps} />);
      expect(screen.getByText('4')).toBeInTheDocument();
    });

    it('should show total restriction count in footer', () => {
      render(<RestrictionCard {...defaultProps} />);
      expect(screen.getByText('4 restricted cards')).toBeInTheDocument();
    });
  });

  describe('Card Grouping', () => {
    it('should group cards by rarity', () => {
      render(<RestrictionCard {...defaultProps} />);

      // Check for rarity headers
      expect(screen.getByText(/^Legendary \(2\)$/)).toBeInTheDocument();
      expect(screen.getByText(/^Rare \(1\)$/)).toBeInTheDocument();
      expect(screen.getByText(/^Common \(1\)$/)).toBeInTheDocument();
    });

    it('should display rarity emoji for each group', () => {
      render(<RestrictionCard {...defaultProps} />);

      // Legendary = ⭐, Rare = 💙, Common = ⚪
      const cells = screen.getAllByText(/⭐|💙|⚪/);
      expect(cells.length).toBeGreaterThanOrEqual(3);
    });

    it('should sort cards alphabetically within rarity', () => {
      render(<RestrictionCard {...defaultProps} />);

      // Legendary section should have P.E.K.K.A before Princess (alphabetically)
      const pekka = screen.getByLabelText('P.E.K.K.A, Legendary');
      const princess = screen.getByLabelText('Princess, Legendary');
      expect(pekka.compareDocumentPosition(princess)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING
      );
    });

    it('should skip rarity groups with no cards', () => {
      const props = {
        ...defaultProps,
        restrictedCards: [mockRestrictions[2]], // Only common card
      };
      render(<RestrictionCard {...props} />);

      // Should only show Common group, not others
      expect(screen.getByText(/^Common \(1\)$/)).toBeInTheDocument();
      expect(screen.queryByText(/^Legendary/)).not.toBeInTheDocument();
      expect(screen.queryByText(/^Epic/)).not.toBeInTheDocument();
    });
  });

  describe('Card Display', () => {
    it('should render all restricted cards', () => {
      render(<RestrictionCard {...defaultProps} />);

      mockRestrictions.forEach(card => {
        expect(screen.getByText(card.card_name)).toBeInTheDocument();
      });
    });

    it('should have card with correct rarity label', () => {
      render(<RestrictionCard {...defaultProps} />);

      const pekka = screen.getByLabelText('P.E.K.K.A, Legendary');
      expect(pekka).toBeInTheDocument();

      const knight = screen.getByLabelText('Knight, Common');
      expect(knight).toBeInTheDocument();
    });

    it('should have correct rarity borders', () => {
      const { container } = render(<RestrictionCard {...defaultProps} />);

      // Cards should have rarity-based border classes
      const cards = container.querySelectorAll('[role="img"]');
      expect(cards.length).toBe(mockRestrictions.length);
      cards.forEach(card => {
        expect(
          card.className.includes('border-') || card.className.includes('hover:border-')
        ).toBe(true);
      });
    });
  });

  describe('Delete Single Card', () => {
    it('should show delete button on hover', async () => {
      const { container } = render(<RestrictionCard {...defaultProps} />);

      const pekkaCard = screen.getByLabelText('P.E.K.K.A, Legendary');
      await userEvent.hover(pekkaCard);

      // Delete button should appear
      const deleteButtons = screen.queryAllByLabelText(/^Remove/);
      expect(deleteButtons.length).toBeGreaterThan(0);
    });

    it('should hide delete button when not hovering', async () => {
      const { container } = render(<RestrictionCard {...defaultProps} />);

      const pekkaCard = screen.getByLabelText('P.E.K.K.A, Legendary');
      await userEvent.hover(pekkaCard);

      // Delete button appears
      expect(screen.queryByLabelText('Remove P.E.K.K.A')).toBeInTheDocument();

      // Hover away
      await userEvent.unhover(pekkaCard);

      // Delete button hides (due to conditional rendering)
      expect(screen.queryByLabelText('Remove P.E.K.K.A')).not.toBeInTheDocument();
    });

    it('should call onDeleteCard when delete button clicked', async () => {
      const onDeleteCard = vi.fn();
      const props = { ...defaultProps, onDeleteCard };

      render(<RestrictionCard {...props} />);

      const pekkaCard = screen.getByLabelText('P.E.K.K.A, Legendary');
      await userEvent.hover(pekkaCard);

      const deleteButton = screen.getByLabelText('Remove P.E.K.K.A');
      await userEvent.click(deleteButton);

      expect(onDeleteCard).toHaveBeenCalledWith('r1');
    });

    it('should call onDeleteCard when Delete key pressed on card', async () => {
      const onDeleteCard = vi.fn();
      const props = { ...defaultProps, onDeleteCard };

      render(<RestrictionCard {...props} />);

      const pekkaCard = screen.getByLabelText('P.E.K.K.A, Legendary');
      pekkaCard.focus();
      await userEvent.keyboard('{Delete}');

      expect(onDeleteCard).toHaveBeenCalledWith('r1');
    });

    it('should work with Backspace key as well', async () => {
      const onDeleteCard = vi.fn();
      const props = { ...defaultProps, onDeleteCard };

      render(<RestrictionCard {...props} />);

      const pekkaCard = screen.getByLabelText('P.E.K.K.A, Legendary');
      pekkaCard.focus();
      await userEvent.keyboard('{Backspace}');

      expect(onDeleteCard).toHaveBeenCalledWith('r1');
    });

    it('should show tooltip with card name on hover', async () => {
      render(<RestrictionCard {...defaultProps} />);

      const pekkaCard = screen.getByLabelText('P.E.K.K.A, Legendary');
      await userEvent.hover(pekkaCard);

      // Tooltip should appear
      const tooltips = screen.queryAllByText('P.E.K.K.A');
      expect(tooltips.length).toBeGreaterThanOrEqual(2); // Card + tooltip
    });
  });

  describe('Clear All', () => {
    it('should show Clear All button', () => {
      render(<RestrictionCard {...defaultProps} />);
      expect(screen.getByLabelText(/Clear all restrictions/)).toBeInTheDocument();
    });

    it('should show confirmation dialog when Clear All clicked', async () => {
      render(<RestrictionCard {...defaultProps} />);

      const clearButton = screen.getByLabelText(/Clear all restrictions/);
      await userEvent.click(clearButton);

      // Confirmation should appear
      expect(screen.getByText('Remove all?')).toBeInTheDocument();
      expect(screen.getByLabelText('Confirm clear all')).toBeInTheDocument();
      expect(screen.getByLabelText('Cancel clear all')).toBeInTheDocument();
    });

    it('should call onDeleteAll when confirmed', async () => {
      const onDeleteAll = vi.fn();
      const props = { ...defaultProps, onDeleteAll };

      render(<RestrictionCard {...props} />);

      const clearButton = screen.getByLabelText(/Clear all restrictions/);
      await userEvent.click(clearButton);

      const confirmButton = screen.getByLabelText('Confirm clear all');
      await userEvent.click(confirmButton);

      expect(onDeleteAll).toHaveBeenCalledWith('p1');
    });

    it('should cancel confirmation when Cancel clicked', async () => {
      const onDeleteAll = vi.fn();
      const props = { ...defaultProps, onDeleteAll };

      render(<RestrictionCard {...props} />);

      const clearButton = screen.getByLabelText(/Clear all restrictions/);
      await userEvent.click(clearButton);

      const cancelButton = screen.getByLabelText('Cancel clear all');
      await userEvent.click(cancelButton);

      // Confirmation should hide
      expect(screen.queryByText('Remove all?')).not.toBeInTheDocument();

      // Callback should NOT have been called
      expect(onDeleteAll).not.toHaveBeenCalled();
    });

    it('should skip confirmation when onApprovedDelete is true', async () => {
      const onDeleteAll = vi.fn();
      const props = { ...defaultProps, onDeleteAll, onApprovedDelete: true };

      render(<RestrictionCard {...props} />);

      const clearButton = screen.getByLabelText(/Clear all restrictions/);
      await userEvent.click(clearButton);

      expect(onDeleteAll).toHaveBeenCalledWith('p1');
      expect(screen.queryByText('Remove all?')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria-labels', () => {
      render(<RestrictionCard {...defaultProps} />);

      mockRestrictions.forEach(card => {
        const cardElem = screen.getByLabelText(`${card.card_name}, ${card.rarity}`);
        expect(cardElem).toHaveAttribute('role', 'img');
      });
    });

    it('should label clear all button descriptively', () => {
      render(<RestrictionCard {...defaultProps} />);

      const clearButton = screen.getByLabelText('Clear all restrictions for Alice');
      expect(clearButton).toBeInTheDocument();
    });

    it('should label delete buttons descriptively', async () => {
      render(<RestrictionCard {...defaultProps} />);

      const pekkaCard = screen.getByLabelText('P.E.K.K.A, Legendary');
      await userEvent.hover(pekkaCard);

      const deleteButton = screen.getByLabelText('Remove P.E.K.K.A');
      expect(deleteButton).toBeInTheDocument();
    });

    it('should label confirmation buttons clearly', async () => {
      render(<RestrictionCard {...defaultProps} />);

      const clearButton = screen.getByLabelText(/Clear all restrictions/);
      await userEvent.click(clearButton);

      expect(screen.getByLabelText('Confirm clear all')).toBeInTheDocument();
      expect(screen.getByLabelText('Cancel clear all')).toBeInTheDocument();
    });

    it('cards should be keyboard focusable', () => {
      render(<RestrictionCard {...defaultProps} />);

      const pekkaCard = screen.getByLabelText('P.E.K.K.A, Legendary');
      expect(pekkaCard).toHaveAttribute('tabIndex', '0');
    });
  });

  describe('Style Variations', () => {
    it('should apply champion rarity styling', () => {
      const props = {
        ...defaultProps,
        restrictedCards: [
          {
            ...mockRestrictions[0],
            card_name: 'Goblin Barrel',
            rarity: 'Champion',
          },
        ],
      };

      const { container } = render(<RestrictionCard {...props} />);
      const card = container.querySelector('[role="img"]');
      expect(card.className).toMatch(/border-yellow|hover:border-yellow/);
    });

    it('should apply epic rarity styling', () => {
      const props = {
        ...defaultProps,
        restrictedCards: [
          {
            ...mockRestrictions[0],
            card_name: 'Dark Prince',
            rarity: 'Epic',
          },
        ],
      };

      const { container } = render(<RestrictionCard {...props} />);
      const card = container.querySelector('[role="img"]');
      expect(card.className).toMatch(/border-purple|hover:border-purple/);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing card names', () => {
      const props = {
        ...defaultProps,
        restrictedCards: [
          {
            restriction_id: 'r1',
            card_id: 999,
            card_name: null,
            rarity: 'Legendary',
          },
        ],
      };

      render(<RestrictionCard {...props} />);
      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });

    it('should handle missing zone name', () => {
      const props = {
        ...defaultProps,
        player: { ...mockPlayer, zone_name: null },
      };

      render(<RestrictionCard {...props} />);
      expect(screen.getByText('@Alice • —')).toBeInTheDocument();
    });

    it('should handle missing nick', () => {
      const props = {
        ...defaultProps,
        player: { ...mockPlayer, nick: null },
      };

      render(<RestrictionCard {...props} />);
      expect(screen.getByText('ZONE A')).toBeInTheDocument();
      expect(screen.queryByText('@')).not.toBeInTheDocument();
    });

    it('should handle unknown rarity gracefully', () => {
      const props = {
        ...defaultProps,
        restrictedCards: [
          {
            restriction_id: 'r1',
            card_id: 1,
            card_name: 'Test Card',
            rarity: 'Unknown',
          },
        ],
      };

      render(<RestrictionCard {...props} />);
      // Should still render and use common styling
      expect(screen.getByText('Test Card')).toBeInTheDocument();
    });
  });

  describe('Multiple Cards Interaction', () => {
    it('should handle multiple delete buttons appearing independently', async () => {
      render(<RestrictionCard {...defaultProps} />);

      const pekkaCard = screen.getByLabelText('P.E.K.K.A, Legendary');
      const knightCard = screen.getByLabelText('Knight, Common');

      // Hover over first card
      await userEvent.hover(pekkaCard);
      expect(screen.getByLabelText('Remove P.E.K.K.A')).toBeInTheDocument();

      // Hover over second card
      await userEvent.hover(knightCard);
      expect(screen.getByLabelText('Remove Knight')).toBeInTheDocument();

      // First card delete button should hide
      expect(screen.queryByLabelText('Remove P.E.K.K.A')).not.toBeInTheDocument();
    });
  });
});
