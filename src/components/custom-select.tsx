import React from 'react';
import { ChevronDownIcon } from '@heroicons/react/16/solid';

interface CustomSelectProps {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  className?: string;
  highlighted?: boolean;
}

const CustomSelect: React.FC<CustomSelectProps> = ({
  id,
  name,
  label,
  value,
  onChange,
  options,
  disabled = false,
  className = '',
  highlighted = false,
}) => {
  return (
    <div className={className}>
      <label 
        htmlFor={id} 
        className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1"
      >
        {label}
      </label>
      <div className="mt-2 grid grid-cols-1">
        <select
          id={id}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`col-start-1 row-start-1 w-full appearance-none rounded-md py-1.5 pr-8 pl-3 text-base outline-1 -outline-offset-1 focus:outline-2 focus:-outline-offset-2 sm:text-sm/6 ${
            disabled
              ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 outline-gray-200 dark:outline-zinc-700'
              : highlighted
                ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 outline-blue-500 dark:outline-blue-400 focus:outline-blue-600 dark:focus:outline-blue-500'
                : 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 outline-gray-300 dark:outline-zinc-600 focus:outline-blue-600 dark:focus:outline-blue-500'
          }`}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon
          aria-hidden="true"
          className="pointer-events-none col-start-1 row-start-1 mr-2 size-5 self-center justify-self-end text-gray-500 dark:text-gray-400 sm:size-4"
        />
      </div>
    </div>
  );
};

export default CustomSelect;
