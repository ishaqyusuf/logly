import type { HTMLAttributes, LabelHTMLAttributes } from "react";
import { cn } from "./cn";

export function FieldGroup({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-4", className)} {...props} />;
}
export function Field({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)} {...props} />
  );
}
export function FieldLabel({
  children,
  htmlFor,
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn("text-sm font-medium", className)}
      {...props}
    >
      {children}
    </label>
  );
}
