import React from 'react';

export interface Column<T> {
  header: React.ReactNode;
  accessorKey?: keyof T;
  cell?: (row: T, index: number) => React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T, index: number) => string | number;
  isLoading?: boolean;
  emptyMessage?: string;
  className?: string;
  style?: React.CSSProperties;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  emptyMessage = 'No se encontraron registros',
  className = '',
  style,
  onRowClick,
}: DataTableProps<T>) {
  return (
    <div
      className={`ui-table-container ${className}`}
      style={{
        width: '100%',
        overflowX: 'auto',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-card)',
        boxShadow: 'var(--shadow-sm)',
        ...style,
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', textTransform: 'none' }}>
        <thead>
          <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid var(--border-color)' }}>
            {columns.map((col, idx) => (
              <th
                key={idx}
                style={{
                  padding: '10px 14px',
                  textAlign: col.align || 'left',
                  fontWeight: 600,
                  fontSize: '0.74rem',
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  width: col.width,
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            Array.from({ length: 4 }).map((_, rIdx) => (
              <tr key={rIdx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                {columns.map((_, cIdx) => (
                  <td key={cIdx} style={{ padding: '14px' }}>
                    <div
                      style={{
                        height: '14px',
                        backgroundColor: '#F3F4F6',
                        borderRadius: '4px',
                        animation: 'uiPulse 1.2s ease-in-out infinite',
                        width: '80%',
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  padding: '40px 20px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '0.88rem',
                }}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, rIdx) => (
              <tr
                key={keyExtractor(row, rIdx)}
                onClick={() => onRowClick && onRowClick(row)}
                className={`ui-table-row ${onRowClick ? 'clickable' : ''}`}
                style={{
                  borderBottom: rIdx === data.length - 1 ? 'none' : '1px solid var(--border-color)',
                  transition: 'background-color 0.12s ease',
                  cursor: onRowClick ? 'pointer' : 'default',
                }}
              >
                {columns.map((col, cIdx) => {
                  const content = col.cell
                    ? col.cell(row, rIdx)
                    : col.accessorKey
                    ? (row[col.accessorKey] as React.ReactNode)
                    : null;

                  return (
                    <td
                      key={cIdx}
                      style={{
                        padding: '11px 14px',
                        textAlign: col.align || 'left',
                        fontSize: '0.85rem',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {content}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>

      <style>{`
        @keyframes uiPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .ui-table-row:hover {
          background-color: #F9FAFB !important;
        }
      `}</style>
    </div>
  );
}

export default DataTable;
