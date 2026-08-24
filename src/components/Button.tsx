import React from 'react';
import Link from 'next/link';

type Variant = 'primary' | 'secondary';

interface BaseProps {
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
}

interface ButtonAsButton extends BaseProps, Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> {
  href?: undefined;
}

interface ButtonAsLink extends BaseProps, Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'children'> {
  href: string;
}

type ButtonProps = ButtonAsButton | ButtonAsLink;

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'rsu-btn-primary',
  secondary: 'rsu-btn-secondary',
};

export default function Button({ variant = 'primary', className = '', children, href, ...rest }: ButtonProps) {
  const classes = `${VARIANT_CLASS[variant]} ${className}`;

  if (href) {
    return (
      <Link href={href} className={classes} {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children}
    </button>
  );
}
