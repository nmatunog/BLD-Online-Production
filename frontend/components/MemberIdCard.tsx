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
            <div className="logo-section">
              <Image
                src="/bld-logo.png"
                alt="BLD"
                width={64}
                height={64}
                className="logo"
                priority
              />
            </div>

            <div className="community-name">Bukas Loob sa Diyos</div>
            <div className="community-subtitle">Catholic Charismatic Covenant Community</div>

            <div className="district-line">Cebu District</div>

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

            <div className="name-section">
              <div className="display-name">{displayName}</div>
              <div className="full-name">{fullName}</div>
            </div>

            <div className="member-chip">MEMBER</div>

            <div className="community-id">{communityId}</div>
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
          width: 53.98mm;
          height: 85.6mm;
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
          padding: 8px 10px;
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
        }

        /* Front Card Styles */
        .id-card-front .card-content {
          border-top: 1px solid ${BLD.red};
          border-bottom: 1px solid ${BLD.red};
          justify-content: space-evenly;
        }

        .logo-section {
          margin-bottom: 1px;
        }

        .logo {
          width: 32px;
          height: 32px;
          object-fit: contain;
        }

        .community-name {
          font-size: 9px;
          color: ${BLD.ink};
          font-weight: 600;
          text-align: center;
          letter-spacing: 0.3px;
          margin-bottom: 1px;
          line-height: 1.1;
        }

        .community-subtitle {
          font-size: 6.5px;
          color: ${BLD.ink};
          font-weight: 500;
          text-align: center;
          letter-spacing: 0.2px;
          margin-bottom: 2px;
          line-height: 1.2;
          max-width: 90%;
        }

        .district-line {
          font-size: 7.5px;
          color: ${BLD.navy};
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          margin-bottom: 3px;
        }

        .photo-section {
          width: 72px;
          height: 72px;
          border-radius: 4px;
          overflow: hidden;
          border: 1.5px solid ${BLD.red};
          margin-bottom: 3px;
          background: #f5f5f5;
          flex-shrink: 0;
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

        .name-section {
          text-align: center;
          margin-bottom: 2px;
          max-width: 90%;
        }

        .display-name {
          font-size: 14px;
          font-weight: 700;
          color: ${BLD.ink};
          margin-bottom: 2px;
          line-height: 1.1;
        }

        .full-name {
          font-size: 10px;
          font-weight: 500;
          color: ${BLD.ink};
          line-height: 1.1;
        }

        .member-chip {
          font-size: 6px;
          font-weight: 700;
          color: ${BLD.navy};
          background: ${BLD.redSoft};
          padding: 2px 6px;
          border-radius: 2px;
          letter-spacing: 0.4px;
          margin-bottom: 2px;
        }

        .community-id {
          font-size: 11px;
          font-weight: 700;
          font-family: 'Courier New', monospace;
          color: ${BLD.ink};
          letter-spacing: 0.4px;
        }

        /* Back Card Styles */
        .id-card-back .card-content {
          justify-content: center;
          padding: 12px;
        }

        .qr-section {
          margin-bottom: 6px;
        }

        .qr-code {
          width: 110px;
          height: 110px;
          display: block;
        }

        .back-community-id {
          font-size: 13px;
          font-weight: 700;
          font-family: 'Courier New', monospace;
          color: ${BLD.ink};
          letter-spacing: 0.8px;
          margin-bottom: 2px;
          text-align: center;
        }

        .back-name {
          font-size: 10px;
          font-weight: 600;
          color: ${BLD.ink};
          margin-bottom: 5px;
          text-align: center;
        }

        .instruction-text {
          font-size: 7px;
          color: #666;
          text-align: center;
          margin-bottom: 2px;
        }

        .footer-text {
          font-size: 8px;
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
            width: 215.92px;
            height: 342.4px;
          }
        }
      `}</style>
    </div>
  );
}
