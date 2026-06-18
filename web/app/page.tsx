import Navbar from "../components/landing/Navbar";
import Hero from "../components/landing/Hero";
import Features from "../components/landing/Features";
import FeatureShowcase from "../components/landing/FeatureShowcase";
import HowItWorks from "../components/landing/HowItWorks";
import IdealFor from "../components/landing/IdealFor";
import Benefits from "../components/landing/Benefits";
import CTA from "../components/landing/CTA";
import Footer from "../components/landing/Footer";

const HomePage = () => {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Features />
        <FeatureShowcase />
        <HowItWorks />
        <IdealFor />
        <Benefits />
        <CTA />
      </main>
      <Footer />
    </>
  );
};

export default HomePage;
