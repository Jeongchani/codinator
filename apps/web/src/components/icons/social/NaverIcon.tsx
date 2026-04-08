import React from "react";

type Props = {
  className?: string;
};

export default function NaverIcon({ className }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M7 5H10.2L14 11.1V5H17V19H13.9L10 12.8V19H7V5Z" />
    </svg>
  );
}