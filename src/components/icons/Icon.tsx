import { forwardRef } from "react";

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const Icon = forwardRef<SVGSVGElement, IconProps>(
  (
    { size = 24, width, height, "aria-hidden": ariaHidden = true, ...props },
    ref,
  ) => {
    return (
      <svg
        ref={ref}
        width={width ?? size}
        height={height ?? size}
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden={ariaHidden}
        {...props}
      />
    );
  },
);

Icon.displayName = "Icon";
