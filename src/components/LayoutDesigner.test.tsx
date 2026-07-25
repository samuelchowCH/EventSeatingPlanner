/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import LayoutDesigner from './LayoutDesigner';
import { Table } from '../types';

// Mock localStorage to verify data loading and saving behaviors
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    }
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock
});

describe('LayoutDesigner Component Testing Suite', () => {
  afterEach(() => {
    cleanup();
  });

  const mockTables: Table[] = [
    { id: 'table-1', name: 'Royal Gold', maxSeats: 8, shape: 'round', color: '#C9A96E' },
    { id: 'table-2', name: 'Academic Row', maxSeats: 16, shape: 'seminar', color: '#4F46E5', seminarRows: 2, seminarSeatsPerRow: 8 }
  ];

  it('renders without crashing and displays header layout description', () => {
    render(<LayoutDesigner tables={mockTables} layoutElements={[]} onUpdateLayoutElements={() => {}} />);
    expect(screen.getByText('Room Architectural Planner')).toBeDefined();
    expect(screen.getByText(/Assemble wall bounds/i)).toBeDefined();
  });

  it('correctly handles switching between A3 and A4 canvas layout sizes', () => {
    render(<LayoutDesigner tables={mockTables} layoutElements={[]} onUpdateLayoutElements={() => {}} />);
    
    // Find paper format selection select element
    const selectEl = screen.getByRole('combobox') as HTMLSelectElement;
    expect(selectEl).toBeDefined();
    expect(selectEl.value).toBe('A4');

    // Toggle to A3
    fireEvent.change(selectEl, { target: { value: 'A3' } });
    expect(selectEl.value).toBe('A3');
  });

  it('constructs a new coordinate canvas element node when a table proxy is deployed', () => {
    render(<LayoutDesigner tables={mockTables} layoutElements={[]} onUpdateLayoutElements={() => {}} />);

    // Switch sidebar tab to tables list
    const tablesTabBtn = screen.getByText(/Tables \(2 unplaced\)/i);
    expect(tablesTabBtn).toBeDefined();
    fireEvent.click(tablesTabBtn);

    // Locate the Deploy button for table-1
    const deployBtns = screen.getAllByRole('button');
    const deployBtn = deployBtns.find(b => b.textContent === 'Deploy');
    expect(deployBtn).toBeDefined();

    // Trigger Deploy
    if (deployBtn) {
      fireEvent.click(deployBtn);
    }

    // Verify properties tab displays the table proxy's custom configurations
    expect(screen.getByText(/table_proxy Settings/i)).toBeDefined();
    expect(screen.getByText('Item Properties')).toBeDefined();
  });

  it('bounds checks dimension modifiers to ensure elements never scale below negative or zero thresholds', () => {
    render(<LayoutDesigner tables={mockTables} layoutElements={[]} onUpdateLayoutElements={() => {}} />);

    // Place a new wall
    const libraryTabBtn = screen.getByText('Architectural Elements');
    fireEvent.click(libraryTabBtn);
    const addWallBtn = document.getElementById('add-wall-btn');
    if (addWallBtn) {
      fireEvent.click(addWallBtn);
    }

    // Go to properties tab
    const propsTabBtn = screen.getByText('Item Properties');
    fireEvent.click(propsTabBtn);

    // Enter a negative width value
    const widthInputs = screen.getAllByRole('spinbutton');
    const widthInput = widthInputs[2]; // width input field
    expect(widthInput).toBeDefined();

    // Fire event with invalid negative number
    fireEvent.change(widthInput, { target: { value: '-20' } });

    // Ensure state bounds-checks the updated value so it never sinks below minimum positive bounds
    const updatedValue = Number((widthInput as HTMLInputElement).value);
    expect(updatedValue).toBeGreaterThanOrEqual(0);
  });

  it('verifies that clicking geometry group button switches page and deploys geometry shapes', () => {
    render(<LayoutDesigner tables={mockTables} layoutElements={[]} onUpdateLayoutElements={() => {}} />);

    // Click on Geometry Group button in the library view
    const geomGroupBtn = document.getElementById('add-geometry-btn');
    expect(geomGroupBtn).toBeDefined();
    if (geomGroupBtn) {
      fireEvent.click(geomGroupBtn);
    }

    // Verify page changed to display geometry group elements
    expect(screen.getByText('Geometry Groups')).toBeDefined();
    expect(screen.getByText('← Back')).toBeDefined();

    // Click Back to return to architectural elements
    const backBtn = screen.getByText('← Back');
    fireEvent.click(backBtn);
    expect(screen.getByText('Structural Wall')).toBeDefined();

    // Go back to geometry groups
    const geomGroupBtn2 = document.getElementById('add-geometry-btn');
    if (geomGroupBtn2) {
      fireEvent.click(geomGroupBtn2);
    }

    // Deploy rectangle geometry element
    const rectBtn = screen.getByText('Rectangle');
    fireEvent.click(rectBtn);

    // Verify properties tab activated with custom geometry settings
    expect(screen.getByText(/geometry_rect Settings/i)).toBeDefined();
    
    // Verify corner radius property is visible in properties panel
    expect(screen.getByText('Corner Radius')).toBeDefined();
  });
});
