import BusinessMarquee from "@/components/home/BusinessMarquee";
import ExampleCarousel from "@/components/home/ExampleCarousel";
import FeatureBento from "@/components/home/FeatureBento";
import FloatingNav from "@/components/home/FloatingNav";
import Hero from "@/components/home/Hero";
import ScrubText from "@/components/home/ScrubText";
import SiteFooter from "@/components/home/SiteFooter";
import StageAccordion from "@/components/home/StageAccordion";
import StartSection from "@/components/home/StartSection";

export default function Home() {
  return (
    <main className="w-full max-w-full overflow-x-hidden">
      <FloatingNav />
      <Hero />
      <BusinessMarquee />
      <FeatureBento />
      <ScrubText text="Most website builders hand you a template and wish you luck. Gagesite asks about your business, writes the plan, designs every page, builds and tests the site, and puts it online where you own it. Nothing moves forward until you approve it." />
      <StageAccordion />
      <ExampleCarousel />
      <StartSection />
      <SiteFooter />
    </main>
  );
}
