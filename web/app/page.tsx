import Navbar from "../components/landing/Navbar";
import Hero from "../components/landing/Hero";
import Features from "../components/landing/Features";
import Benefits from "../components/landing/Benefits";
import HowItWorks from "../components/landing/HowItWorks";
import Testimonials from "../components/landing/Testimonials";
import CTA from "../components/landing/CTA";
import Footer from "../components/landing/Footer";

const HomePage = () => {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <section id="features">
          <Features />
        </section>
        <section id="benefits">
          <Benefits />
        </section>
        <section id="how">
          <HowItWorks />
        </section>
        <Testimonials />
        <CTA />
      </main>
      <Footer />
    </>
  );
};

export default HomePage;
