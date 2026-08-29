'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { generateStableMemberQR } from '@/lib/qr-service';

interface MemberIdCardProps {
  communityId: string;
  firstName: string;
  lastName: string;
  nickname?: string;
  photoUrl?: string | null;
  showFront?: boolean;
  showBack?: boolean;
}

const BLD = {
  red: '#D00008',
  redDark: '#A80006',
  redSoft: '#FCE8E9',
  ink: '#1A1A1A',
  navy: '#1e3a8a',
} as const;

export function MemberIdCard({
  communityId,
  firstName,
  lastName,
  nickname,
  photoUrl,
  showFront = true,
  showBack = true,
}: MemberIdCardProps) {
  const [qrCode, setQrCode] = useState<string>('');

  useEffect(() => {
    generateStableMemberQR(communityId, { width: 300, margin: 1 })
      .then(setQrCode)
      .catch(console.error);
  }, [communityId]);

  const displayName = nickname || firstName;
  const fullName = `${firstName} ${lastName}`;

  return (
    <div className="print-container">
      {showFront && (
        <div className="id-card id-card-front">
          <div className="card-content">
            <div className="photo-section">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoUrl}
                  alt="Member"
                  className="member-photo"
                />
              ) : (
                <div className="photo-placeholder" />
              )}
            </div>

            <div className="info-section">
              <div className="header-section">
                <Image
                  src="/bld-logo.png"
                  alt="BLD"
                  width={64}
                  height={64}
                  className="logo"
                  priority
                />
                <div className="org-text">
                  <div className="org-name">Bukas Loob sa Diyos</div>
                  <div className="org-subtitle">Catholic Charismatic Covenant Community</div>
                  <div className="district-line">Cebu District</div>
                </div>
              </div>

              <div className="name-section">
                <div className="display-name">{displayName}</div>
                <div className="full-name">{fullName}</div>
              </div>

              <div className="bottom-section">
                <div className="member-chip">MEMBER</div>
                <div className="community-id">{communityId}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showBack && (
        <div className="id-card id-card-back">
          <div className="card-content">
            <div className="qr-section">
              {qrCode && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrCode}
                  alt="QR Code"
                  className="qr-code"
                />
              )}
            </div>

            <div className="back-community-id">{communityId}</div>

            <div className="back-name">{displayName}</div>

            <div className="instruction-text">Scan for attendance</div>

            <div className="footer-text">BLD Cebu</div>
          </div>
        </div>
      )}

      <style jsx>{`
        .print-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
          align-items: center;
          padding: 20px;
        }

        .id-card {
          width: 85.6mm;
          height: 53.98mm;
          background: #FEFCF8;
          border: 1px solid ${BLD.red};
          border-radius: 8px;
          overflow: visible;
          position: relative;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .card-content {
          width: 100%;
          height: 100%;
          padding: 3mm;
          display: flex;
          position: relative;
        }

        /* Front Card Styles - Landscape Layout */
        .id-card-front .card-content {
          border-top: 1px solid ${BLD.red};
          border-bottom: 1px solid ${BLD.red};
          flex-direction: row;
          gap: 3mm;
          align-items: stretch;
        }

        .photo-section {
          width: 20mm;
          height: 20mm;
          border-radius: 2mm;
          overflow: hidden;
          border: 0.5mm solid ${BLD.red};
          background: #f5f5f5;
          flex-shrink: 0;
          align-self: center;
        }

        .member-photo {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .photo-placeholder {
          width: 100%;
          height: 100%;
          background: #e5e5e5;
        }

        .info-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-width: 0;
        }

        .header-section {
          display: flex;
          gap: 2mm;
          align-items: flex-start;
        }

        .logo {
          width: 12mm;
          height: 12mm;
          object-fit: contain;
          flex-shrink: 0;
        }

        .org-text {
          flex: 1;
          min-width: 0;
        }

        .org-name {
          font-size: 8pt;
          color: ${BLD.navy};
          font-weight: 600;
          line-height: 1.1;
        }

        .org-subtitle {
          font-size: 7pt;
          color: ${BLD.navy};
          font-weight: 400;
          line-height: 1.2;
          margin-top: 0.5mm;
        }

        .district-line {
          font-size: 7pt;
          color: ${BLD.navy};
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.2pt;
          margin-top: 0.5mm;
        }

        .name-section {
          text-align: left;
        }

        .display-name {
          font-size: 12pt;
          font-weight: 700;
          color: ${BLD.ink};
          line-height: 1.1;
          text-transform: capitalize;
        }

        .full-name {
          font-size: 8pt;
          font-weight: 500;
          color: ${BLD.ink};
          line-height: 1.2;
          margin-top: 0.5mm;
        }

        .bottom-section {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 2mm;
        }

        .member-chip {
          font-size: 7pt;
          font-weight: 700;
          color: ${BLD.navy};
          background: ${BLD.redSoft};
          padding: 0.5mm 1.5mm;
          border-radius: 1mm;
          letter-spacing: 0.3pt;
          white-space: nowrap;
        }

        .community-id {
          font-size: 10pt;
          font-weight: 700;
          font-family: 'Courier New', monospace;
          color: ${BLD.ink};
          letter-spacing: 0.3pt;
        }

        /* Back Card Styles - Landscape QR-dominant */
        .id-card-back .card-content {
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 4mm;
        }

        .qr-section {
          margin-bottom: 2mm;
        }

        .qr-code {
          width: 20mm;
          height: 20mm;
          display: block;
        }

        .back-community-id {
          font-size: 10pt;
          font-weight: 700;
          font-family: 'Courier New', monospace;
          color: ${BLD.ink};
          letter-spacing: 0.5pt;
          margin-bottom: 1mm;
          text-align: center;
        }

        .back-name {
          font-size: 9pt;
          font-weight: 600;
          color: ${BLD.ink};
          margin-bottom: 2mm;
          text-align: center;
        }

        .instruction-text {
          font-size: 7pt;
          color: #666;
          text-align: center;
          margin-bottom: 0.5mm;
        }

        .footer-text {
          font-size: 7pt;
          font-weight: 600;
          color: ${BLD.navy};
          text-align: center;
        }

        @media print {
          .print-container {
            gap: 0;
            padding: 0;
          }

          .id-card {
            box-shadow: none;
            border-radius: 0;
            page-break-after: always;
          }

          .id-card:last-child {
            page-break-after: auto;
          }
        }

        @media screen and (max-width: 640px) {
          .id-card {
            width: 342.4px;
            height: 215.92px;
          }
        }
      `}</style>
    </div>
  );
}
