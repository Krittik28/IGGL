import React, { useState, useEffect, useCallback } from 'react';
import { RotateCw } from 'lucide-react';

const CHARACTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const generateCaptchaCode = (length = 5) => {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += CHARACTERS.charAt(Math.floor(Math.random() * CHARACTERS.length));
  }
  return result;
};

export const CaptchaWidget = ({
  value,
  onChange,
  onCodeChange,
  error = false,
  label = 'Security Captcha',
  placeholder = 'Enter Captcha code',
}) => {
  const [code, setCode] = useState(() => generateCaptchaCode(5));
  const [rotation, setRotation] = useState(0);

  const refreshCaptcha = useCallback(() => {
    const newCode = generateCaptchaCode(5);
    setCode(newCode);
    setRotation(prev => prev + 360);
    if (onCodeChange) {
      onCodeChange(newCode);
    }
  }, [onCodeChange]);

  useEffect(() => {
    if (onCodeChange) {
      onCodeChange(code);
    }
  }, [code, onCodeChange]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>{label} <span style={{ color: '#ef4444' }}>*</span></span>
        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Case-insensitive</span>
      </label>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        {/* Captcha Visual Box */}
        <div
          style={{
            position: 'relative',
            background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 50%, #f8fafc 100%)',
            border: '1.5px solid #cbd5e1',
            borderRadius: '8px',
            padding: '0.35rem 1rem',
            userSelect: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '130px',
            height: '42px',
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.08)',
            overflow: 'hidden',
          }}
          title="Security verification code"
        >
          {/* Noise lines */}
          <svg
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.35 }}
          >
            <line x1="0" y1="10" x2="140" y2="35" stroke="#475569" strokeWidth="1.5" />
            <line x1="10" y1="35" x2="130" y2="5" stroke="#00823b" strokeWidth="1.2" strokeDasharray="3,3" />
            <line x1="30" y1="40" x2="100" y2="0" stroke="#0284c7" strokeWidth="1" />
          </svg>

          {/* Distorted characters */}
          <div
            style={{
              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
              fontSize: '1.35rem',
              fontWeight: 800,
              letterSpacing: '0.35em',
              color: '#0f172a',
              textShadow: '1px 1px 2px rgba(0,0,0,0.15)',
              transform: 'skew(-6deg)',
              zIndex: 2,
            }}
          >
            {code}
          </div>
        </div>

        {/* Refresh button */}
        <button
          type="button"
          onClick={refreshCaptcha}
          className="btn btn-secondary"
          style={{
            padding: '0.55rem',
            borderRadius: '8px',
            color: '#00823b',
            borderColor: '#bbf7d0',
            background: '#f0fdf4',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '42px',
            width: '42px',
          }}
          title="Change captcha code"
        >
          <RotateCw
            size={16}
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: 'transform 0.4s ease',
            }}
          />
        </button>

        {/* Captcha Input */}
        <div style={{ flex: 1, minWidth: '150px' }}>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            placeholder={placeholder}
            maxLength={6}
            className={`form-input ${error ? 'error' : ''}`}
            style={{
              height: '42px',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              fontWeight: 700,
              fontFamily: "'JetBrains Mono', monospace",
            }}
            required
          />
        </div>
      </div>
    </div>
  );
};
