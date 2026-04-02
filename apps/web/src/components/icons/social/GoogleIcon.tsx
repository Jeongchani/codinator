import React from "react";

type Props = {
  className?: string;
};

export default function GoogleIcon({ className }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M19.2 12.3C19.2 11.78 19.15 11.36 19.04 10.92H12V13.72H16.03C15.86 14.73 15.27 15.59 14.41 16.17C13.71 16.64 12.89 16.9 12 16.9C9.31 16.9 7.1 14.69 7.1 12C7.1 9.31 9.31 7.1 12 7.1C13.31 7.1 14.39 7.57 15.18 8.34L16.98 6.54C15.88 5.48 14.32 4.8 12 4.8C8.02 4.8 4.8 8.02 4.8 12C4.8 15.98 8.02 19.2 12 19.2C14.15 19.2 15.84 18.5 17 17.36C18.18 16.2 19.2 14.39 19.2 12.3Z"
        fill="currentColor"
      />
      <path
        d="M18.95 10.92H12V13.72H18.35"
        stroke="white"
        strokeWidth="0.9"
        strokeLinecap="round"
      />
    </svg>
  );
}