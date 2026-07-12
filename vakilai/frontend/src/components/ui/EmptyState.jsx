import Button from "./Button.jsx";
const EmptyState = ({ icon, title, description, action, actionLabel }) => (
  <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
    {icon && (
      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-400">
        {icon}
      </div>
    )}
    <p className="text-sm font-medium text-gray-700 mb-1">{title}</p>
    {description && <p className="text-xs text-gray-400 mb-5 max-w-xs">{description}</p>}
    {action && <Button onClick={action} variant="primary" size="sm">{actionLabel}</Button>}
  </div>
);
export default EmptyState;
