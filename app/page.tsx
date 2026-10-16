import SiteHeader from "./_components/SiteHeader";
import Hero from "./_components/Hero";
import WorkRegister from "./_components/WorkRegister";
import Experience from "./_components/Experience";
import Contact from "./_components/Contact";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <WorkRegister />
        <Experience />
        <Contact />
      </main>
    </>
  );
}
