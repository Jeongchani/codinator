
type KakaoIconProps = {
  className?: string;
};

export default function KakaoIcon({ className }: KakaoIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M12 4.6C7.77 4.6 4.35 7.3 4.35 10.7C4.35 12.95 5.86 14.92 8.13 16L7.42 18.86C7.34 19.17 7.69 19.41 7.97 19.24L11.42 16.99C11.61 17 11.8 17 12 17C16.23 17 19.65 14.3 19.65 10.7C19.65 7.3 16.23 4.6 12 4.6Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="9.4" cy="10.7" r="0.75" fill="currentColor" />
      <circle cx="12" cy="10.7" r="0.75" fill="currentColor" />
      <circle cx="14.6" cy="10.7" r="0.75" fill="currentColor" />
    </svg>
  );
}