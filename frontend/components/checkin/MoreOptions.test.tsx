import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MoreOptions } from './MoreOptions';

describe('MoreOptions', () => {
  it('hides advanced content until opened', () => {
    render(
      <MoreOptions>
        <p>Candidate Quick Check-In</p>
      </MoreOptions>,
    );
    expect(screen.queryByText('Candidate Quick Check-In')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'More options' }));
    expect(screen.getByText('Candidate Quick Check-In')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide more options' })).toBeInTheDocument();
  });
});
