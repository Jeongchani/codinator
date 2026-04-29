import React from 'react';

type HeaderProps = {
  title?: string;
  rightSlot?: React.ReactNode;
};

const Header: React.FC<HeaderProps> = ({ title = 'C:dinator', rightSlot }) => {
  return (
    <header className="flex items-center justify-between px-5 py-4">
      <h1 className="text-lg font-semibold text-neutral-900">{title}</h1>
      <div>{rightSlot}</div>
    </header>
  );
};

export default Header;
