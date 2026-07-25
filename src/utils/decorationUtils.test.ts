import { describe, it, expect } from 'vitest';
import { computeSafeRadius, buildDecorPrompt } from './decorationUtils';

describe('decorationUtils', () => {
  describe('computeSafeRadius', () => {
    it('returns furthest seat distance + safetyPadding', () => {
      // Seat at (200+80, 200) — distance 80 from centre (200,200)
      // Seat at (200, 200+100) — distance 100 from centre
      const seats = [
        { x: 280, y: 200 }, // dist 80
        { x: 200, y: 300 }, // dist 100  <-- furthest
        { x: 120, y: 200 }, // dist 80
      ];
      const result = computeSafeRadius(seats, 200, 200, 30);
      expect(result).toBeCloseTo(130); // 100 + 30
    });

    it('uses default safetyPadding of 30 when omitted', () => {
      const seats = [{ x: 250, y: 200 }]; // dist 50
      expect(computeSafeRadius(seats)).toBeCloseTo(80); // 50 + 30
    });

    it('falls back to 110 + padding when no seats are provided', () => {
      expect(computeSafeRadius([], 200, 200, 30)).toBe(140); // 110 + 30
    });

    it('handles diagonal seat positions correctly', () => {
      // Seat at (200+60, 200+80) — distance = sqrt(3600+6400) = 100
      const seats = [{ x: 260, y: 280 }];
      expect(computeSafeRadius(seats, 200, 200, 0)).toBeCloseTo(100);
    });
  });

  describe('buildDecorPrompt', () => {
    it('includes the user text verbatim inside the prompt', () => {
      const result = buildDecorPrompt('Gold leaf wedding');
      expect(result).toContain('"Gold leaf wedding"');
    });

    it('explicitly instructs to keep the centre 50% empty', () => {
      const result = buildDecorPrompt('any theme');
      expect(result.toLowerCase()).toContain('centre 50%');
    });

    it('trims leading/trailing whitespace from user input', () => {
      const result = buildDecorPrompt('  Rustic Barn  ');
      expect(result).toContain('"Rustic Barn"');
    });

    it('instructs outer-edge / vignette composition', () => {
      const result = buildDecorPrompt('test');
      expect(result.toLowerCase()).toContain('outer edges');
    });
  });
});
