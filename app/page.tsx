import CursorMount from "./_components/CursorMount";
import GalaxyHome from "./_components/GalaxyHome";

// The whole site is the galaxy: projects are planets, and About, Contact
// and the project list open as sheets from the header.
export default function Home() {
  return (
    <main>
      <CursorMount />
      <GalaxyHome />
    </main>
  );
}
