import React, { useEffect, useState } from 'react';
import { Pin, Trash2 } from 'lucide-react';
import { api } from '../../utils/api';
import {
  NOTE_CATEGORIES,
  NOTE_CATEGORY_LABELS,
  TRUST_TAGS,
} from '../../utils/trustTags';
import type { PersonaNoteCategory } from '../../utils/trustTags';

interface PersonaNoteItem {
  id: number;
  content: string;
  category: PersonaNoteCategory;
  isPinned: boolean;
  createdAt: string;
  author?: { id: number; username: string };
}

interface ClientTrustNotesPanelProps {
  client: any;
  onClientUpdated: (updatedClient: any) => void;
  onDataChanged: () => void;
  setErrorMsg: (msg: string | null) => void;
  flat?: boolean;
}

export const ClientTrustNotesPanel: React.FC<ClientTrustNotesPanelProps> = ({
  client,
  onClientUpdated,
  onDataChanged,
  setErrorMsg,
  flat = false,
}) => {
  const [notes, setNotes] = useState<PersonaNoteItem[]>(Array.isArray(client.notes) ? client.notes : []);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [savingTags, setSavingTags] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<PersonaNoteCategory>('GENERAL');
  const [isPinned, setIsPinned] = useState(false);

  const selectedTags: string[] = Array.isArray(client.trustTags) ? client.trustTags : [];

  useEffect(() => {
    let active = true;
    setLoadingNotes(true);
    api
      .getClientNotes(client.id)
      .then((list) => {
        if (active) setNotes(list);
      })
      .catch(() => {
        // Silencioso si el rol no tiene acceso o falla momentáneamente
      })
      .finally(() => {
        if (active) setLoadingNotes(false);
      });
    return () => {
      active = false;
    };
  }, [client.id]);

  const handleToggleTag = async (code: string) => {
    if (savingTags) return;
    const nextTags = selectedTags.includes(code)
      ? selectedTags.filter((t) => t !== code)
      : [...selectedTags, code];
    setSavingTags(true);
    try {
      const res = await api.updateClientTrustTags(client.id, nextTags);
      onClientUpdated({ ...client, trustTags: res.trustTags });
      onDataChanged();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al actualizar etiquetas.');
    } finally {
      setSavingTags(false);
    }
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || savingNote) return;
    setSavingNote(true);
    try {
      const created = await api.createClientNote(client.id, {
        content: content.trim(),
        category,
        isPinned,
      });
      setNotes((prev) => {
        const next = [created, ...prev];
        return next.sort((a, b) => Number(b.isPinned) - Number(a.isPinned));
      });
      setContent('');
      setIsPinned(false);
      onDataChanged();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar la nota.');
    } finally {
      setSavingNote(false);
    }
  };

  const handleTogglePin = async (noteId: number) => {
    try {
      const updated = await api.togglePinClientNote(client.id, noteId);
      setNotes((prev) =>
        prev
          .map((n) => (n.id === noteId ? updated : n))
          .sort((a, b) => {
            if (a.isPinned !== b.isPinned) return Number(b.isPinned) - Number(a.isPinned);
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          }),
      );
      onDataChanged();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al fijar la nota.');
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    try {
      await api.deleteClientNote(client.id, noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      onDataChanged();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al eliminar la nota.');
    }
  };

  return (
    <div
      style={
        flat
          ? { display: 'flex', flexDirection: 'column', gap: '14px' }
          : { border: '1px solid var(--border-color)', padding: '16px', borderRadius: '8px', backgroundColor: '#fafafa', display: 'flex', flexDirection: 'column', gap: '12px' }
      }
    >
      {!flat && (
        <h4 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
          Confianza y Bitácora
        </h4>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }} role="group" aria-label="Etiquetas de confianza">
        {TRUST_TAGS.map((tag) => {
          const active = selectedTags.includes(tag.code);
          return (
            <button
              key={tag.code}
              type="button"
              aria-pressed={active}
              disabled={savingTags}
              onClick={() => handleToggleTag(tag.code)}
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: '999px',
                cursor: savingTags ? 'wait' : 'pointer',
                border: `1px solid ${active ? tag.border : 'var(--border-color)'}`,
                backgroundColor: active ? tag.bg : '#fff',
                color: active ? tag.color : 'var(--text-secondary)',
                transition: 'all 0.12s ease',
              }}
            >
              {tag.label}
            </button>
          );
        })}
      </div>

      <form onSubmit={handleCreateNote} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <select
            aria-label="Categoría de nota"
            className="input"
            value={category}
            onChange={(e) => setCategory(e.target.value as PersonaNoteCategory)}
            style={{ width: '115px', padding: '6px 8px', fontSize: '0.8rem', height: '34px' }}
          >
            {NOTE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <input
            aria-label="Nueva nota interna"
            type="text"
            className="input"
            placeholder="Agregar nota interna..."
            maxLength={1000}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            style={{ flex: 1, padding: '6px 10px', fontSize: '0.82rem', height: '34px' }}
          />
          <button
            type="button"
            aria-pressed={isPinned}
            title="Fijar nota"
            aria-label="Fijar nota"
            onClick={() => setIsPinned((p) => !p)}
            style={{
              height: '34px',
              padding: '0 10px',
              borderRadius: '6px',
              border: `1px solid ${isPinned ? '#F59E0B' : 'var(--border-color)'}`,
              backgroundColor: isPinned ? '#FEF3C7' : '#fff',
              color: isPinned ? '#92400E' : 'var(--text-secondary)',
              display: 'inline-flex',
              alignItems: 'center',
              cursor: 'pointer',
            }}
          >
            <Pin size={14} />
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!content.trim() || savingNote}
            style={{ height: '34px', padding: '0 12px', fontSize: '0.8rem', fontWeight: 600 }}
          >
            Guardar
          </button>
        </div>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
        {loadingNotes && notes.length === 0 ? (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '6px 0' }}>Cargando...</span>
        ) : notes.length === 0 ? (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '10px', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: '6px', backgroundColor: '#fff' }}>
            Sin notas registradas
          </span>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              style={{
                padding: '9px 11px',
                borderRadius: '6px',
                backgroundColor: note.isPinned ? '#FFFBEB' : '#fff',
                border: `1px solid ${note.isPinned ? '#FDE68A' : 'var(--border-color)'}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {note.author?.username || 'Admin'}
                  </span>
                  <span>·</span>
                  <span>{NOTE_CATEGORY_LABELS[note.category] || note.category}</span>
                  <span>·</span>
                  <span className="tabular-nums">
                    {new Date(note.createdAt).toLocaleString('es-AR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    aria-label={note.isPinned ? 'Desfijar nota' : 'Fijar nota'}
                    title={note.isPinned ? 'Desfijar' : 'Fijar'}
                    onClick={() => handleTogglePin(note.id)}
                    style={{ padding: '3px', color: note.isPinned ? '#B45309' : 'var(--text-secondary)' }}
                  >
                    <Pin size={13} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost text-danger"
                    aria-label="Eliminar nota"
                    title="Eliminar"
                    onClick={() => handleDeleteNote(note.id)}
                    style={{ padding: '3px' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <div style={{ fontSize: '0.83rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                {note.content}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
