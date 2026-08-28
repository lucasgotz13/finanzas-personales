import type { Ref } from 'react';

export interface ConfirmPromptProps {
  /** 600-weight question, e.g. "¿Borrar la transacción?" */
  question: string;
  /** Muted consequence note under the question (optional), e.g. what the
   * delete recomputes. One line; wraps only on word boundaries. */
  note?: string;
  /** Danger button label, e.g. "Borrar". */
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** While true, both actions are disabled (in-flight delete). */
  busy?: boolean;
  /** Forwarded to the confirm button so the row can focus it on open. */
  confirmRef?: Ref<HTMLButtonElement>;
  confirmTestId?: string;
  cancelTestId?: string;
}

/**
 * The signature inline confirm prompt (DESIGN: Components): a question over
 * its consequence note with a compact danger confirm and a muted cancel —
 * never a modal. One component so every list confirms identically; the DOM
 * classes are the ones index.css already styles.
 */
export default function ConfirmPrompt({
  question,
  note,
  confirmLabel,
  onConfirm,
  onCancel,
  busy = false,
  confirmRef,
  confirmTestId,
  cancelTestId,
}: ConfirmPromptProps): JSX.Element {
  return (
    <span className="confirm-prompt" role="alert">
      <span className="confirm-text">
        <span className="confirm-question">{question}</span>
        {note && <span className="confirm-note">{note}</span>}
      </span>
      <span className="confirm-actions">
        <button type="button" className="danger" ref={confirmRef} onClick={onConfirm} disabled={busy} data-testid={confirmTestId}>
          {confirmLabel}
        </button>
        <button type="button" className="link muted" onClick={onCancel} disabled={busy} data-testid={cancelTestId}>
          Cancelar
        </button>
      </span>
    </span>
  );
}
