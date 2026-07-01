import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  CompletionHeatmap,
  DayCounter,
  HeatmapGrid,
  LineChart,
  getHeatmapColumnCount,
} from '@workspace-starter/ui';

describe('LineChart', () => {
  it('renders empty state without crashing', () => {
    render(<LineChart series={[{ label: 'Test', points: [] }]} />);
    expect(screen.getByText('Not enough data yet')).toBeInTheDocument();
  });

  it('renders chart with data', () => {
    const { container } = render(
      <LineChart
        series={[
          {
            label: 'Water',
            points: [
              { date: '2026-06-01', value: 2 },
              { date: '2026-06-02', value: 3 },
            ],
          },
        ]}
      />,
    );
    expect(container.querySelector('svg')).toBeTruthy();
    expect(screen.getByText('Water')).toBeInTheDocument();
  });
});

describe('CompletionHeatmap', () => {
  it('renders empty state without crashing', () => {
    render(<CompletionHeatmap days={[]} />);
    expect(screen.getByText('Not enough data yet')).toBeInTheDocument();
  });

  it('renders heatmap cells with legend', () => {
    const { container } = render(
      <CompletionHeatmap
        days={[
          { date: '2026-06-01', state: 'completed' },
          { date: '2026-06-02', state: 'missed' },
        ]}
      />,
    );
    expect(container.querySelectorAll('rect')).toHaveLength(2);
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Missed')).toBeInTheDocument();
  });
});

describe('HeatmapGrid', () => {
  function cells(count: number) {
    return Array.from({ length: count }, (_, index) => ({
      dayNumber: index + 1,
      state: 'future' as const,
      dayLabel: null,
    }));
  }

  it('uses a compact week layout for 7-day ranges', () => {
    const { container } = render(<HeatmapGrid cells={cells(7)} />);
    expect(screen.getAllByTitle(/Day \d+/)).toHaveLength(7);
    expect(container.querySelector('.grid')).toHaveStyle({
      gridTemplateColumns: 'repeat(7, minmax(1.25rem, 1fr))',
    });
  });

  it('keeps long ranges scrollable instead of shrinking cells away', () => {
    const { container } = render(<HeatmapGrid cells={cells(366)} />);
    expect(screen.getAllByTitle(/Day \d+/)).toHaveLength(366);
    expect(container.querySelector('.grid')).toHaveStyle({
      gridTemplateColumns: 'repeat(24, minmax(1.25rem, 1fr))',
    });
  });

  it('derives column counts for week, month, and arbitrary ranges', () => {
    expect(getHeatmapColumnCount(7)).toBe(7);
    expect(getHeatmapColumnCount(31)).toBe(7);
    expect(getHeatmapColumnCount(75)).toBe(13);
    expect(getHeatmapColumnCount(366)).toBe(24);
  });
});

describe('DayCounter', () => {
  it('renders explicit challenge totals without a default 75-day fallback', () => {
    const { container } = render(
      <DayCounter
        currentDay={370}
        totalDays={366}
        startDate="2026-01-01T00:00:00.000Z"
        endDate="2027-01-01T00:00:00.000Z"
      />,
    );

    expect(container).toHaveTextContent('/ 366');
    expect(container).toHaveTextContent('Range');
    expect(container).toHaveTextContent('to');
  });
});
