import SiteHeader from "./_components/SiteHeader";
import Hero from "./_components/Hero";
import WorkRegister from "./_components/WorkRegister";
import Experience from "./_components/Experience";
import Contact from "./_components/Contact";
import CursorMount from "./_components/CursorMount";

export default function Home() {
  return (
    <>
      <CursorMount />
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
