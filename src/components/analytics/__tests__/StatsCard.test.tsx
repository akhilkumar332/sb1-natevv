/**
 * Tests for StatsCard Component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '../../../test/testUtils';
import { StatsCard } from '../StatsCard';
import { Activity } from 'lucide-react';

describe('StatsCard', () => {
  it('should render title and value', () => {
    render(<StatsCard title="Total Donations" value={150} />);

    expect(screen.getByText('Total Donations')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
  });

  it('should render subtitle when provided', () => {
    render(
      <StatsCard
        title="Total Donations"
        value={150}
        subtitle="This month"
      />
    );

    expect(screen.getByText('This month')).toBeInTheDocument();
  });

  it('should render icon when provided', () => {
    const { container } = render(
      <StatsCard
        title="Total Donations"
        value={150}
        icon={Activity}
      />
    );

    // Lucide icons are rendered as SVG
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('should show loading skeleton when loading is true', () => {
    const { container } = render(
      <StatsCard
        title="Total Donations"
        value={150}
        loading={true}
      />
    );

    // Check for skeleton elements (animate-pulse class)
    const skeleton = container.querySelector('.animate-pulse');
    expect(skeleton).toBeInTheDocument();
  });

  it('should show positive trend indicator', () => {
    const { container } = render(
      <StatsCard
        title="Total Donations"
        value={150}
        trend={{ value: 15, isPositive: true }}
      />
    );

    // Should show increase indicator with green color
    const trendIndicator = container.querySelector('.text-green-600');
    expect(trendIndicator).toBeInTheDocument();
    expect(trendIndicator?.textContent).toContain('15');
  });

  it('should show negative trend indicator', () => {
    const { container } = render(
      <StatsCard
        title="Total Donations"
        value={150}
        trend={{ value: 10, isPositive: false }}
      />
    );

    // Should show decrease indicator with red color
    const trendIndicator = container.querySelector('.text-red-600');
    expect(trendIndicator).toBeInTheDocument();
    expect(trendIndicator?.textContent).toContain('10');
  });

  it('should apply custom icon color', () => {
    const { container } = render(
      <StatsCard
        title="Total Donations"
        value={150}
        icon={Activity}
        iconColor="text-red-600"
      />
    );

    const iconContainer = container.querySelector('.text-red-600');
    expect(iconContainer).toBeInTheDocument();
  });

  it('should render string values', () => {
    render(<StatsCard title="Status" value="Active" />);

    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('should render number values', () => {
    render(<StatsCard title="Count" value={0} />);

    expect(screen.getByText('0')).toBeInTheDocument();
  });
});
