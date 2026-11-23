import React from 'react';
import { Pin } from 'lucide-react';
import { TRUST_TAG_MAP } from '../../utils/trustTags';

interface ClientTrustBadgesProps {
  trustTags?: string[];
  pinnedNote?: { content: string } | null;
}

export const ClientTrustBadges: React.FC<ClientTrustBadgesProps> = ({ trustTags, pinnedNote }) => {
  const tags = Array.isArray(trustTags) ? trustTags : [];
  if (tags.length === 0 && !pinnedNote) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px', marginTop: '5px' }}>
      {tags.map((code) => {
        const meta = TRUST_TAG_MAP[code];
        const label = meta ? meta.label : code;
        return (
          <span
            key={code}
            style={{
              fontSize: '0.68rem',
              fontWeight: 600,
              padding: '1px 7px',
              borderRadius: '999px',
              backgroundColor: meta ? meta.bg : '#f1f5f9',
              color: meta ? meta.color : '#334155',
              border: `1px solid ${meta ? meta.border : '#e2e8f0'}`,
              lineHeight: 1.4,
            }}
          >
            {label}
          </span>
        );
      })}
      {pinnedNote && (
        <span
          title={pinnedNote.content}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            fontSize: '0.68rem',
            color: '#92400E',
            backgroundColor: '#FFFBEB',
            border: '1px solid #FDE68A',
            borderRadius: '999px',
            padding: '1px 7px',
            maxWidth: '200px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          <Pin size={10} style={{ flexShrink: 0 }} />
          {pinnedNote.content}
        </span>
      )}
    </div>
  );
};
