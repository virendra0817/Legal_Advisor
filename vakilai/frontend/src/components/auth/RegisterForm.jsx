import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuth from "../../hooks/useAuth.js";

const EyeIcon = ({ open }) => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    {open ? (
      <>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
      </>
    ) : (
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"/>
    )}
  </svg>
);

// Password strength meter
const StrengthBar = ({ password }) => {
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  const labels = ["", "Weak", "Fair", "Good", "Strong"];
  const colors = ["bg-gray-200", "bg-red-400", "bg-amber-400", "bg-yellow-400", "bg-emerald-500"];

  if (!password) return null;

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= score ? colors[score] : "bg-gray-200"}`}/>
        ))}
      </div>
      <p className={`text-xs ${score <= 1 ? "text-red-500" : score === 2 ? "text-amber-500" : score === 3 ? "text-yellow-600" : "text-emerald-600"}`}>
        {labels[score]}
      </p>
    </div>
  );
};

const RegisterForm = () => {
  const navigate    = useNavigate();
  const { register } = useAuth();

  const [fullName,  setFullName]  = useState("");
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [showPass,  setShowPass]  = useState(false);
  const [agree,     setAgree]     = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState("");

  const isValid = fullName.trim().length >= 2 && email.trim().includes("@") && password.length >= 8 && agree;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid || isLoading) return;

    setIsLoading(true);
    setError("");

    try {
      await register(fullName.trim(), email.trim(), password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center mb-3">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Create your account</h1>
          <p className="text-sm text-gray-500 mt-1">Free — no credit card needed</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>

          {/* Full name */}
          <div className="mb-4">
            <label htmlFor="reg-name" className="block text-sm font-medium text-gray-700 mb-1.5">
              Full name
            </label>
            <input
              id="reg-name"
              type="text"
              autoComplete="name"
              required
              placeholder="Rahul Sharma"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-2.5 text-sm text-gray-900 bg-white border border-gray-300
                         rounded-xl placeholder-gray-400
                         focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                         transition-colors"
            />
          </div>

          {/* Email */}
          <div className="mb-4">
            <label htmlFor="reg-email" className="block text-sm font-medium text-gray-700 mb-1.5">
              Email address
            </label>
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 text-sm text-gray-900 bg-white border border-gray-300
                         rounded-xl placeholder-gray-400
                         focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                         transition-colors"
            />
          </div>

          {/* Password */}
          <div className="mb-5">
            <label htmlFor="reg-password" className="block text-sm font-medium text-gray-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                id="reg-password"
                type={showPass ? "text" : "password"}
                autoComplete="new-password"
                required
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 pr-11 text-sm text-gray-900 bg-white border border-gray-300
                           rounded-xl placeholder-gray-400
                           focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                           transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
                aria-label={showPass ? "Hide password" : "Show password"}
              >
                <EyeIcon open={showPass} />
              </button>
            </div>
            <StrengthBar password={password} />
          </div>

          {/* Terms checkbox */}
          <div className="flex items-start gap-3 mb-6">
            <input
              id="reg-agree"
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600
                         focus:ring-indigo-500 cursor-pointer"
            />
            <label htmlFor="reg-agree" className="text-xs text-gray-500 cursor-pointer leading-relaxed">
              I understand that VakilAI provides{" "}
              <span className="font-medium text-gray-700">legal information</span>, not legal advice,
              and I agree to the{" "}
              <Link to="/terms" className="text-indigo-600 hover:underline">Terms of Service</Link>
              {" "}and{" "}
              <Link to="/privacy" className="text-indigo-600 hover:underline">Privacy Policy</Link>.
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!isValid || isLoading}
            className="w-full py-2.5 px-4 bg-indigo-600 text-white text-sm font-medium rounded-xl
                       hover:bg-indigo-700 active:bg-indigo-800
                       disabled:opacity-60 disabled:cursor-not-allowed
                       transition-colors flex items-center justify-center gap-2"
          >
            {isLoading && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            )}
            {isLoading ? "Creating account…" : "Create free account"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-indigo-600 hover:text-indigo-700 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterForm;
