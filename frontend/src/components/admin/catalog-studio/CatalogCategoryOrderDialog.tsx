import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowDown, ArrowUp, ArrowUpToLine, GripVertical, RotateCcw, X } from 'lucide-react';
import {
  isSameCategoryOrder,
  moveCategory,
  moveCategoryToTop,
} from './catalogCategoryOrder.helper';

interface CatalogCategoryOrderDialogProps {
  open: boolean;
  currentOrder: string[];
  defaultOrder: string[];
  countsByCategory: Map<string, number>;
  onClose: () => void;
  onSave: (nextOrder: string[]) => void;
}

interface DragState {
  pointerId: number;
  fromIndex: number;
  startY: number;
  startScrollTop: number;
  translateY: number;
  dropIndex: number | null;
}

export function CatalogCategoryOrderDialog({
  open,
  currentOrder,
  defaultOrder,
  countsByCategory,
  onClose,
  onSave,
}: CatalogCategoryOrderDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [draft, setDraft] = useState<string[]>(currentOrder);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open) {
      setDraft(currentOrder);
      setDrag(null);
      setAnnouncement('');
      if (!dlg.open) dlg.showModal();
    } else if (dlg.open) {
      dlg.close();
    }
  }, [open, currentOrder]);

  useEffect(() => {
    if (!drag) return;
    document.body.classList.add('cs-dragging-cursor');
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setDrag(null);
        setAnnouncement('Reordenamiento cancelado.');
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.body.classList.remove('cs-dragging-cursor');
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [drag]);

  const computeDropIndex = (clientY: number, fromIndex: number): number | null => {
    const list = listRef.current;
    if (!list) return null;
    const listRect = list.getBoundingClientRect();
    const clampedY = Math.max(listRect.top, Math.min(clientY, listRect.bottom));
    const pointerInList = clampedY - listRect.top - list.clientTop + list.scrollTop;
    const children = Array.from(list.children) as HTMLElement[];

    let target = children.length;
    for (let i = 0; i < children.length; i++) {
      const el = children[i];
      const midpoint = el.offsetTop + el.offsetHeight / 2;
      if (pointerInList < midpoint) {
        target = i;
        break;
      }
    }
    if (target === fromIndex || target === fromIndex + 1) return null;
    return target;
  };

  const handleHandlePointerDown = (e: ReactPointerEvent<HTMLButtonElement>, index: number) => {
    if (e.button !== 0 || drag) return;
    const list = listRef.current;
    if (!list) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({
      pointerId: e.pointerId,
      fromIndex: index,
      startY: e.clientY,
      startScrollTop: list.scrollTop,
      translateY: 0,
      dropIndex: null,
    });
  };

  const handleHandlePointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const list = listRef.current;
    if (!list) return;

    const listRect = list.getBoundingClientRect();
    const edgeZone = 44;
    if (e.clientY < listRect.top + edgeZone) {
      list.scrollTop -= 12;
    } else if (e.clientY > listRect.bottom - edgeZone) {
      list.scrollTop += 12;
    }

    const scrollDelta = list.scrollTop - drag.startScrollTop;
    const translateY = e.clientY - drag.startY + scrollDelta;
    const dropIndex = computeDropIndex(e.clientY, drag.fromIndex);
    setDrag((prev) => (prev ? { ...prev, translateY, dropIndex } : null));
  };

  const finishDrag = (e: ReactPointerEvent<HTMLButtonElement>, commit: boolean) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (commit && drag.dropIndex !== null) {
      const toIndex = drag.dropIndex > drag.fromIndex ? drag.dropIndex - 1 : drag.dropIndex;
      const movedName = draft[drag.fromIndex];
      setDraft((prev) => moveCategory(prev, drag.fromIndex, toIndex));
      setAnnouncement(`${movedName} movida a posición ${toIndex + 1}.`);
    }
    setDrag(null);
  };

  const handleStepMove = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= draft.length) return;
    const name = draft[index];
    setDraft((prev) => moveCategory(prev, index, target));
    setAnnouncement(`${name} movida a posición ${target + 1}.`);
  };

  const handleMoveTop = (index: number) => {
    if (index <= 0) return;
    const name = draft[index];
    setDraft((prev) => moveCategoryToTop(prev, index));
    setAnnouncement(`${name} movida arriba de todo.`);
  };

  const handleRestoreDefault = () => {
    setDraft(defaultOrder);
    setAnnouncement('Orden por defecto restaurado.');
  };

  const isDefault = isSameCategoryOrder(draft, defaultOrder);
  const hasChanges = !isSameCategoryOrder(draft, currentOrder);

  return (
    <dialog
      ref={dialogRef}
      className="cs-dialog cs-order-dialog"
      aria-labelledby="cs-order-dialog-title"
      onCancel={(e) => {
        if (drag) {
          e.preventDefault();
          return;
        }
        onClose();
      }}
      onClose={onClose}
    >
      <div className="cs-dialog-header">
        <h1 id="cs-order-dialog-title" className="cs-dialog-title">
          Orden de categorías
        </h1>
        <button type="button" className="cs-icon-btn" aria-label="Cerrar" onClick={onClose}>
          <X size={15} />
        </button>
      </div>

      <div className="cs-dialog-body cs-order-body">
        <span className="cs-sr-only" aria-live="polite">
          {announcement}
        </span>

        <ul ref={listRef} className="cs-order-list">
          {draft.map((category, index) => {
            const isDragging = drag?.fromIndex === index;
            const showDropBefore = drag?.dropIndex === index;
            const showDropAfter = drag?.dropIndex === draft.length && index === draft.length - 1;
            const count = countsByCategory.get(category) ?? 0;

            return (
              <li
                key={category}
                className={`cs-order-item ${isDragging ? 'is-dragging' : ''} ${showDropBefore ? 'has-drop-before' : ''} ${showDropAfter ? 'has-drop-after' : ''}`}
                style={isDragging ? { transform: `translateY(${drag.translateY}px)` } : undefined}
              >
                <button
                  type="button"
                  className="cs-order-handle"
                  aria-label={`Arrastrar ${category}`}
                  onPointerDown={(e) => handleHandlePointerDown(e, index)}
                  onPointerMove={handleHandlePointerMove}
                  onPointerUp={(e) => finishDrag(e, true)}
                  onPointerCancel={(e) => finishDrag(e, false)}
                  onLostPointerCapture={(e) => finishDrag(e, false)}
                >
                  <GripVertical size={15} />
                </button>

                <span className="cs-order-rank">{index + 1}</span>
                <span className="cs-order-name">{category}</span>
                <span className="cs-order-count">{count}</span>

                <div className="cs-order-controls">
                  <button
                    type="button"
                    className="cs-icon-btn"
                    title="Subir primero"
                    aria-label={`Subir ${category} arriba de todo`}
                    disabled={index === 0}
                    onClick={() => handleMoveTop(index)}
                  >
                    <ArrowUpToLine size={13} />
                  </button>
                  <button
                    type="button"
                    className="cs-icon-btn"
                    title="Subir"
                    aria-label={`Subir ${category}`}
                    disabled={index === 0}
                    onClick={() => handleStepMove(index, -1)}
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    className="cs-icon-btn"
                    title="Bajar"
                    aria-label={`Bajar ${category}`}
                    disabled={index === draft.length - 1}
                    onClick={() => handleStepMove(index, 1)}
                  >
                    <ArrowDown size={13} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="cs-dialog-footer cs-order-footer">
        <button
          type="button"
          className="cs-btn"
          disabled={isDefault}
          onClick={handleRestoreDefault}
        >
          <RotateCcw size={13} />
          <span>Restaurar</span>
        </button>
        <div className="cs-order-footer-right">
          <button type="button" className="cs-btn" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="cs-btn cs-btn-dark"
            disabled={!hasChanges}
            onClick={() => {
              onSave(isDefault ? [] : draft);
              onClose();
            }}
          >
            Aplicar
          </button>
        </div>
      </div>
    </dialog>
  );
}
