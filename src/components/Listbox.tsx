'use client';

import Select from './Select';

// The app's dropdown (Select.tsx) for callers that hold typed values and an
// options array instead of <option> children.
interface ListboxOption<T extends string | number> {
  value: T;
  label: string;
}

interface ListboxProps<T extends string | number> {
  value: T;
  onChange: (value: T) => void;
  options: ListboxOption<T>[];
  className?: string;
  wrapperClassName?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

export default function Listbox<T extends string | number>({ value, onChange, options, ariaLabel, ...rest }: ListboxProps<T>) {
  return (
    <Select
      {...rest}
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => {
        const picked = options.find((o) => String(o.value) === e.target.value);
        if (picked) onChange(picked.value);
      }}
    >
      {options.map((o) => (
        <option key={String(o.value)} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}
