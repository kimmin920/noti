import { forwardRef, type CSSProperties, type SelectHTMLAttributes } from "react";

type FormSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  wrapperClassName?: string;
  wrapperStyle?: CSSProperties;
};

const WRAPPER_CLASS_TOKENS = new Set([
  "field-width-sm",
  "field-width-md",
  "field-width-lg",
  "toolbar-select",
  "narrow",
]);

export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(function FormSelect(
  { className = "", style, wrapperClassName = "", wrapperStyle, disabled, children, ...props },
  ref
) {
  const classTokens = className.split(/\s+/).filter(Boolean);
  const inheritedWrapperClasses = classTokens.filter((token) => WRAPPER_CLASS_TOKENS.has(token));
  const selectStyle = { ...(style ?? {}) };
  const layoutStyle: CSSProperties = {};

  if (selectStyle.width !== undefined) {
    layoutStyle.width = selectStyle.width;
    delete selectStyle.width;
  }
  if (selectStyle.minWidth !== undefined) {
    layoutStyle.minWidth = selectStyle.minWidth;
    delete selectStyle.minWidth;
  }
  if (selectStyle.maxWidth !== undefined) {
    layoutStyle.maxWidth = selectStyle.maxWidth;
    delete selectStyle.maxWidth;
  }
  if (selectStyle.flex !== undefined) {
    layoutStyle.flex = selectStyle.flex;
    delete selectStyle.flex;
  }
  if (selectStyle.flexBasis !== undefined) {
    layoutStyle.flexBasis = selectStyle.flexBasis;
    delete selectStyle.flexBasis;
  }
  if (selectStyle.flexGrow !== undefined) {
    layoutStyle.flexGrow = selectStyle.flexGrow;
    delete selectStyle.flexGrow;
  }
  if (selectStyle.flexShrink !== undefined) {
    layoutStyle.flexShrink = selectStyle.flexShrink;
    delete selectStyle.flexShrink;
  }
  if (selectStyle.alignSelf !== undefined) {
    layoutStyle.alignSelf = selectStyle.alignSelf;
    delete selectStyle.alignSelf;
  }

  return (
    <span
      className={["form-select", ...inheritedWrapperClasses, wrapperClassName].filter(Boolean).join(" ")}
      style={{ ...layoutStyle, ...(wrapperStyle ?? {}) }}
      data-disabled={disabled ? "true" : undefined}
    >
      <select
        {...props}
        ref={ref}
        disabled={disabled}
        className={className}
        style={selectStyle}
      >
        {children}
      </select>
    </span>
  );
});
