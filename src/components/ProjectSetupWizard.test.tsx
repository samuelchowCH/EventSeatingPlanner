// @vitest-environment jsdom

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Tests for ProjectSetupWizard
 *
 * Coverage:
 *  - Step navigation (Next / Back)
 *  - Per-step validation blocks progression on invalid input
 *  - Values preserved when navigating between steps
 *  - Draft save/load via localStorage
 *  - Final review and onCreateEvent callback
 *  - AI failure leaves form data intact
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import React from 'react';
import ProjectSetupWizard from './ProjectSetupWizard';

// ── helpers ────────────────────────────────────────────────────────────────────

const mockCreate = vi.fn();
const mockCancel = vi.fn();

function renderWizard() {
  cleanup();
  return render(
    <ProjectSetupWizard onCreateEvent={mockCreate} onCancel={mockCancel} />
  );
}

function fillStep1(name = 'My Test Event', eventType = 'Wedding') {
  fireEvent.change(screen.getByLabelText(/Event Name/i), { target: { value: name } });
  fireEvent.click(screen.getByRole('radio', { name: eventType }));
}

// ── setup / teardown ───────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  // Suppress fetch errors in test environment
  vi.spyOn(global, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ error: 'AI unavailable in tests' }), { status: 503 })
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ── tests ──────────────────────────────────────────────────────────────────────

describe('ProjectSetupWizard', () => {

  it('renders Step 1 with event name and event type fields', () => {
    renderWizard();
    expect(screen.queryByText('Event Basics')).toBeTruthy();
    expect(screen.queryByLabelText(/Event Name/i)).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Wedding' })).toBeTruthy();
  });

  it('blocks Step 1 → Step 2 if name is empty', () => {
    renderWizard();
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    expect(screen.queryAllByRole('alert').length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/Event name is required/i).length).toBeGreaterThan(0);
    // Should still be on step 1
    expect(screen.queryByText('Event Basics')).toBeTruthy();
  });

  it('blocks Step 1 → Step 2 if event type is not selected', () => {
    renderWizard();
    fireEvent.change(screen.getByLabelText(/Event Name/i), { target: { value: 'Test' } });
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    expect(screen.queryAllByText(/Please select an event type/i).length).toBeGreaterThan(0);
  });

  it('proceeds to Step 2 when Step 1 is valid', () => {
    renderWizard();
    fillStep1();
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    expect(screen.getByRole('heading', { name: 'Date & Venue' })).toBeTruthy();
  });

  it('goes back from Step 2 to Step 1 and preserves name value', () => {
    renderWizard();
    fillStep1('Preserved Name');
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    // Now on step 2
    expect(screen.getByRole('heading', { name: 'Date & Venue' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Back/i }));
    // Back on step 1, name preserved
    const nameInput = screen.getByLabelText(/Event Name/i) as HTMLInputElement;
    expect(nameInput.value).toBe('Preserved Name');
  });

  it('blocks Step 3 progression if guest count is negative', async () => {
    renderWizard();
    // Navigate to step 3
    fillStep1();
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    // On step 3
    expect(screen.queryByText('Event Background')).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Estimated Guest Count/i), { target: { value: '-5' } });
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    expect(screen.queryAllByText(/positive number/i).length).toBeGreaterThan(0);
  });

  it('blocks Step 5 progression if seats < 2', async () => {
    renderWizard();
    // Navigate to step 5
    fillStep1();
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    }
    // step 4 - visual prefs, proceed
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    // step 5
    expect(screen.queryByText('Seating Defaults')).toBeTruthy();
    const seatsInput = screen.getByLabelText(/Seats per table number/i) as HTMLInputElement;
    fireEvent.change(seatsInput, { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    expect(screen.queryAllByText(/between 2 and 30/i).length).toBeGreaterThan(0);
  });

  it('Save Draft button stores form data to localStorage', () => {
    renderWizard();
    fillStep1('Draft Event', 'Birthday');
    fireEvent.click(screen.getByRole('button', { name: /Save Draft/i }));
    const saved = JSON.parse(localStorage.getItem('seating_planner_wizard_draft') || 'null');
    expect(saved).not.toBeNull();
    expect(saved.name).toBe('Draft Event');
    expect(saved.eventType).toBe('Birthday');
  });

  it('loads saved draft from localStorage on mount', () => {
    localStorage.setItem('seating_planner_wizard_draft', JSON.stringify({
      ...{ name: 'Loaded Draft', eventType: 'Corporate' },
      date: '', venueName: '', venueCity: '', description: '',
      guestCountEstimated: '', dietaryNotes: '', arenaMode: 'dining',
      defaultTableShape: 'round', defaultTableSeats: '8',
      aiThemeName: '', aiFillColor: '', aiStrokeColor: '',
      aiStrokeWidth: 3, aiBackgroundColor: '', aiGridOpacity: 0.12,
      aiSetupNotes: '', aiApplied: false,
    }));
    renderWizard();
    const nameInput = screen.getByLabelText(/Event Name/i) as HTMLInputElement;
    expect(nameInput.value).toBe('Loaded Draft');
  });

  it('reaches Review step and calls onCreateEvent on submit', async () => {
    renderWizard();
    fillStep1('Grand Wedding', 'Wedding');
    // Step through to step 6
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    }
    expect(screen.queryByText('Review & Create')).toBeTruthy();
    // The review table should show the event name
    expect(screen.queryByText('Grand Wedding')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Create Event/i }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledOnce();
    });
    const [name, , metadata] = mockCreate.mock.calls[0];
    expect(name).toBe('Grand Wedding');
    expect(metadata.eventType).toBe('Wedding');
  });

  it('Cancel button calls onCancel', () => {
    renderWizard();
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(mockCancel).toHaveBeenCalledOnce();
  });

  it('AI failure preserves form data and shows error message', async () => {
    renderWizard();
    fillStep1('Wedding With AI', 'Wedding');
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    // fill description so AI has something
    fireEvent.change(screen.getByLabelText(/Event Description/i), { target: { value: 'Romantic garden wedding' } });
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    // On step 4
    expect(screen.queryByText('Visual Preferences')).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Get AI suggestions/i }));
    });

    await waitFor(() => {
      expect(screen.queryAllByRole('alert', { hidden: true }).length).toBeGreaterThan(0);
    }, { timeout: 3000 });

    // Name is still preserved (not wiped on AI failure)
    // Navigate back to step 1 to verify
    fireEvent.click(screen.getByRole('button', { name: /Back/i }));
    fireEvent.click(screen.getByRole('button', { name: /Back/i }));
    fireEvent.click(screen.getByRole('button', { name: /Back/i }));
    const nameInput = screen.getByLabelText(/Event Name/i) as HTMLInputElement;
    expect(nameInput.value).toBe('Wedding With AI');
  });
});
