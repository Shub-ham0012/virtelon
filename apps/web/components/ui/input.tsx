import type { InputHTMLAttributes } from "react";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`input w-full rounded-lg px-3 py-2 text-sm ${className}`}
      {...props}
    />
  );
}
