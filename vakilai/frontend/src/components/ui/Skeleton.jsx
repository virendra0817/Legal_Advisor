const Skeleton = ({ variant="rect", width, height, className="" }) => {
  const base = "animate-pulse bg-gray-200 rounded";
  if (variant === "circle") return <div className={`${base} rounded-full ${className}`} style={{ width, height }}/>;
  if (variant === "text")   return <div className={`${base} h-3 rounded ${className}`} style={{ width }}/>;
  return <div className={`${base} ${className}`} style={{ width, height }}/>;
};
export default Skeleton;
