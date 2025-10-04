/**
 * Tests for Export Utilities
 */

import { describe, it, expect } from 'vitest';
import { convertToCSV, formatForExport, createFilename } from '../export.utils';

describe('convertToCSV', () => {
  it('should convert array of objects to CSV format', () => {
    const data = [
      { name: 'John', age: 30, city: 'New York' },
      { name: 'Jane', age: 25, city: 'Los Angeles' },
    ];

    const csv = convertToCSV(data);

    expect(csv).toContain('name,age,city');
    expect(csv).toContain('John,30,New York');
    expect(csv).toContain('Jane,25,Los Angeles');
  });

  it('should handle empty array', () => {
    const csv = convertToCSV([]);
    expect(csv).toBe('');
  });

  it('should escape commas in values', () => {
    const data = [{ name: 'Doe, John', age: 30 }];
    const csv = convertToCSV(data);
    expect(csv).toContain('"Doe, John"');
  });

  it('should escape quotes in values', () => {
    const data = [{ name: 'John "The Boss"', age: 30 }];
    const csv = convertToCSV(data);
    expect(csv).toContain('John ""The Boss""');
  });

  it('should handle null and undefined values', () => {
    const data = [{ name: 'John', age: null, city: undefined }];
    const csv = convertToCSV(data);
    expect(csv).toContain('John,,');
  });

  it('should use custom headers if provided', () => {
    const data = [{ name: 'John', age: 30, city: 'NYC' }];
    const csv = convertToCSV(data, ['name', 'age']);
    expect(csv).toContain('name,age');
    expect(csv).not.toContain('city');
  });

  it('should handle Date objects', () => {
    const date = new Date('2025-10-04');
    const data = [{ name: 'John', joined: date }];
    const csv = convertToCSV(data);
    expect(csv).toContain(date.toISOString());
  });
});

describe('formatForExport', () => {
  it('should format dates to local date string', () => {
    const data = [{ name: 'John', joined: new Date('2025-10-04') }];
    const formatted = formatForExport(data);
    expect(formatted[0].joined).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
  });

  it('should stringify objects', () => {
    const data = [{ name: 'John', address: { city: 'NYC', zip: '10001' } }];
    const formatted = formatForExport(data);
    expect(typeof formatted[0].address).toBe('string');
    expect(formatted[0].address).toContain('NYC');
  });

  it('should skip functions and undefined values', () => {
    const data = [
      {
        name: 'John',
        greet: () => 'Hello',
        age: undefined,
      },
    ];
    const formatted = formatForExport(data);
    expect(formatted[0]).not.toHaveProperty('greet');
    expect(formatted[0]).not.toHaveProperty('age');
  });
});

describe('createFilename', () => {
  it('should create filename with timestamp', () => {
    const filename = createFilename('report', 'csv');
    expect(filename).toMatch(/report_\d{4}-\d{2}-\d{2}\.csv/);
  });

  it('should handle different extensions', () => {
    const filename = createFilename('data', 'json');
    expect(filename).toContain('.json');
  });
});
