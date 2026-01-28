import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'glass';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  isLoading, 
  className = '', 
  disabled,
  ...props 
}) => {
  // Updated base styles
  const baseStyles = "inline-flex items-center justify-center rounded-xl font-medium transition-all active:scale-95 duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100";
  
  // Updated color variants
  const variants = {
    // Primary: #2d6ad1
    primary: "bg-[#2d6ad1] text-white hover:bg-[#2358b5] shadow-lg shadow-[#2d6ad1]/30",
    secondary: "bg-[#e5efff] text-[#2d6ad1] hover:bg-[#d0e1fd]",
    outline: "border border-[#b4c6e6] bg-white text-[#2d6ad1] hover:bg-[#e5efff]",
    ghost: "text-[#2d6ad1] hover:bg-[#e5efff] hover:text-[#0048d6]",
    glass: "bg-white/70 backdrop-blur-md border border-white/20 text-[#2d6ad1] hover:bg-white/90 shadow-sm"
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-5 py-2.5 text-sm",
    lg: "px-8 py-3.5 text-base",
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {children}
    </button>
  );
};