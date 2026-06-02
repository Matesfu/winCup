// Stub for next/link — renders a plain <a> in tests without JSX
import React from "react";
import type { AnchorHTMLAttributes } from "react";

const Link = React.forwardRef(
  (props: AnchorHTMLAttributes<HTMLAnchorElement>, ref: React.Ref<HTMLAnchorElement>) =>
    React.createElement("a", { ...props, ref })
);
Link.displayName = "Link";

export default Link;
