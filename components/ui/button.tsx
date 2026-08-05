import type { ButtonHTMLAttributes } from "react";
export function Button({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) { return <button className={`rounded-md bg-indigo-600 px-4 py-2 font-medium text-white ${className}`} {...props} />; }
