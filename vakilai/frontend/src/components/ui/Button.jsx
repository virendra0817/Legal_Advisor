import Spinner from "./Spinner.jsx";
const VARIANTS = {
  primary:   "bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800",
  secondary: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50",
  ghost:     "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
  danger:    "bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
};
const SIZES = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2.5 text-sm" };

const Button = ({ variant="primary", size="md", isLoading, disabled, children, className="", ...props }) => (
  <button
    disabled={disabled || isLoading}
    className={`inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-colors
      disabled:opacity-60 disabled:cursor-not-allowed
      ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    {...props}
  >
    {isLoading && <Spinner size="sm"/>}
    {children}
  </button>
);
export default Button;
