import React from 'react';

interface HBRCIconProps {
  size?: number;
  style?: React.CSSProperties;
}

export default function HBRCIcon({ size = 128, style }: HBRCIconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width={size} height={size} style={style}>
      <line x1="80" y1="20" x2="80" y2="36" stroke="#0E1116" strokeWidth="4" strokeLinecap="round" />
      <circle cx="80" cy="20" r="5" fill="#3B82F6" />
      <rect x="30" y="40" width="100" height="80" rx="18" fill="#FFFFFF" stroke="#0E1116" strokeWidth="4" />
      <rect x="42" y="58" width="76" height="32" rx="8" fill="#0E1116" />
      <rect x="50" y="66" width="26" height="16" rx="3" fill="#3B82F6" />
      <rect x="50" y="66" width="26" height="5" fill="#1B2128" opacity="0.6" />
      <rect x="84" y="66" width="26" height="16" rx="3" fill="#3B82F6" />
      <rect x="84" y="66" width="26" height="5" fill="#1B2128" opacity="0.6" />
      <rect x="62" y="100" width="36" height="6" rx="3" fill="#0E1116" />
      <rect x="22" y="68" width="8" height="20" rx="3" fill="#0E1116" />
      <rect x="130" y="68" width="8" height="20" rx="3" fill="#0E1116" />
    </svg>
  );
}
