import Spinner from './Spinner';

const VARIANTS = ['primary', 'secondary', 'ghost', 'danger'];
const SIZES = ['sm', 'md', 'lg'];

export default function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  block = false,
  type = 'button',
  className = '',
  disabled,
  children,
  ...rest
}) {
  const classes = [
    'ui-btn',
    `ui-btn--${VARIANTS.includes(variant) ? variant : 'secondary'}`,
    `ui-btn--${SIZES.includes(size) ? size : 'md'}`,
    block ? 'ui-btn--block' : '',
    className
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <Spinner size="sm" label="" />}
      <span>{children}</span>
    </button>
  );
}
