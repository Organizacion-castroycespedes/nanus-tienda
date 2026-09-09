"use client";

import { useState } from "react";
import Navbar from "./Navbar";
import Hero from "./Hero";
import Features from "./Features";
import FeatureShowcase from "./FeatureShowcase";
import HowItWorks from "./HowItWorks";
import IdealFor from "./IdealFor";
import Benefits from "./Benefits";
import CTA from "./CTA";
import Footer from "./Footer";
import DemoContactDialog from "./DemoContactDialog";
import FloatingWhatsAppButton from "./FloatingWhatsAppButton";

const LandingPageClient = () => {
  const [demoDialogOpen, setDemoDialogOpen] = useState(false);

  const openDemoDialog = () => setDemoDialogOpen(true);
  const closeDemoDialog = () => setDemoDialogOpen(false);

  return (
    <>
      <Navbar onRequestDemo={openDemoDialog} />
      <main>
        <Hero onRequestDemo={openDemoDialog} />
        <Features />
        <Benefits />
        <FeatureShowcase />
        <HowItWorks />
        <IdealFor />
        <CTA onRequestDemo={openDemoDialog} />
      </main>
      <Footer onRequestDemo={openDemoDialog} />
      <FloatingWhatsAppButton />
      <DemoContactDialog open={demoDialogOpen} onClose={closeDemoDialog} />
    </>
  );
};

export default LandingPageClient;
