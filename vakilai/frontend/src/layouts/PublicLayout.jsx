import { Outlet } from "react-router-dom";
import LandingNavbar from "../components/landing/LandingNavbar.jsx";
import Footer from "../components/layout/Footer.jsx";
const PublicLayout = () => (
  <div className="min-h-screen flex flex-col bg-white">
    <LandingNavbar />
    <main className="flex-1"><Outlet /></main>
    <Footer />
  </div>
);
export default PublicLayout;
