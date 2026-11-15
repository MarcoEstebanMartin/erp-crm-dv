import { type CSSProperties, type ReactNode, useEffect, useRef } from 'react';

interface NativeModalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  ariaLabelledBy?: string;
  ariaLabel?: string;
  closeOnBackdrop?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/**
 * Contenedor modal basado en <dialog> nativo con showModal() (top-layer, Esc y retorno de foco nativos).
 */
export function NativeModalDialog({
  isOpen,
  onClose,
  ariaLabelledBy,
  ariaLabel,
  closeOnBackdrop = true,
  className = '',
  style,
  children,
}: NativeModalDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const backdropPointerDownRef = useRef(false);
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;

    if (isOpen) {
      if (!el.open && typeof el.showModal === 'function') {
        el.showModal();
      }
    } else if (el.open) {
      el.close();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      className={`app-native-dialog ${className}`.trim()}
      aria-labelledby={ariaLabelledBy}
      aria-label={ariaLabel}
      style={style}
      onClose={() => {
        if (isOpenRef.current) {
          onClose();
        }
      }}
      onPointerDown={(e) => {
        backdropPointerDownRef.current = closeOnBackdrop && e.target === dialogRef.current;
      }}
      onPointerUp={(e) => {
        if (backdropPointerDownRef.current && closeOnBackdrop && e.target === dialogRef.current) {
          onClose();
        }
        backdropPointerDownRef.current = false;
      }}
    >
      {children}
    </dialog>
  );
}
