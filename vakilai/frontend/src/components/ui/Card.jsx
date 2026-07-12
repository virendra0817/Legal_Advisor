const Card = ({ children, className="", padding="p-5" }) => (
  <div className={`bg-white rounded-2xl border border-gray-200 ${padding} ${className}`}>
    {children}
  </div>
);
export default Card;
