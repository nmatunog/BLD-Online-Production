/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PublicVerifyCard } from './PublicVerifyCard';

describe('PublicVerifyCard', () => {
  it('shows only the public scan fields and a VALID status', () => {
    const { container } = render(
      <PublicVerifyCard
        status="VALID"
        fullName="Juan Dela Cruz"
        memberId="CEB-ME1801"
        ministry="Worship"
        photoUrl="https://bld-idphotos.b-cdn.net/juan.jpg"
      />,
    );

    expect(screen.getByText('VALID')).toBeInTheDocument();
    expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument();
    expect(screen.getByText('CEB-ME1801')).toBeInTheDocument();
    expect(screen.getByText('Worship')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/blood|emergency|phone|email|address|birth/i);
  });

  it('shows REVOKED as a large red banner', () => {
    render(
      <PublicVerifyCard
        status="REVOKED"
        fullName="Juan Dela Cruz"
        memberId="CEB-ME1801"
        ministry="No ministry assigned"
        photoUrl={null}
      />,
    );

    const banner = screen.getByRole('alert');
    expect(banner).toHaveTextContent('REVOKED');
    expect(banner.className).toMatch(/bg-red-600/);
  });
});
