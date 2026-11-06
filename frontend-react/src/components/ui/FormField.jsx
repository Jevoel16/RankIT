import { Children, cloneElement, isValidElement, useId } from 'react';

// Wires a label, hint and error to its single input child via id/aria attributes.
export default function FormField({ label, hint, error, required = false, className = '', children }) {
  const autoId = useId();
  const child = Children.only(children);
  const id = (isValidElement(child) && child.props.id) || `field-${autoId}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [child.props['aria-describedby'], hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`ui-field ${error ? 'ui-field--invalid' : ''} ${className}`.trim()}>
      <label className="ui-field__label" htmlFor={id}>
        {label}
        {required && (
          <span className="ui-field__required" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      {cloneElement(child, {
        id,
        required: required || child.props.required,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy
      })}
      {hint && (
        <p className="ui-field__hint" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p className="ui-field__error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
