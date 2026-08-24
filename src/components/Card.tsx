import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export default function Card({ children, className = '', ...rest }: CardProps) {
  return (
    <div className={`rsu-card ${className}`} {...rest}>
      {children}
    </div>
  );
}
