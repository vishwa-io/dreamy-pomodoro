/**
 * Hover/focus tooltip.
 *
 * Visibility is pure CSS (`:hover` / `:focus-within` on the wrapper), so this
 * stays a server component and the label is in the HTML for screen readers.
 * `tabIndex` makes it reachable by keyboard, since the trigger is plain text
 * rather than a link.
 */
export default function Tooltip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <span className="cv-tooltip-wrap" tabIndex={0}>
      {children}
      <span className="cv-tooltip" role="tooltip">
        {label}
      </span>
    </span>
  );
}
