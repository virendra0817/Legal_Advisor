const COLORS = {
  indigo:  "bg-indigo-50 text-indigo-700",
  emerald: "bg-emerald-50 text-emerald-700",
  amber:   "bg-amber-50 text-amber-700",
  red:     "bg-red-50 text-red-700",
  gray:    "bg-gray-100 text-gray-600",
  purple:  "bg-purple-50 text-purple-700",
};
const SIZES = { sm: "px-2 py-0.5 text-xs", md: "px-2.5 py-1 text-xs" };
const Badge = ({ color="gray", size="sm", children, className="" }) => (
  <span className={`inline-flex items-center font-medium rounded-full ${COLORS[color]} ${SIZES[size]} ${className}`}>
    {children}
  </span>
);
export default Badge;
