import { Introduction } from "@/components/sections/Introduction";
import { Skills } from "@/components/sections/Skills";
import { Projects } from "@/components/sections/Projects";
import { ExperienceTimeline as Experience } from "@/components/sections/ExperienceTimeline";
import { Research } from "@/components/sections/Research";
import { Papers } from "@/components/sections/Papers";
import { Education } from "@/components/sections/Education";
import { Blog } from "@/components/sections/Blog";
import { Contact } from "@/components/sections/Contact";

export default function Home() {
  return (
    <>
      {/* Introduction Section */}
      <section id="home">
        <Introduction />
      </section>

      {/* Skills Section */}
      <section
        id="skills"
        className="min-h-screen flex items-center justify-center bg-muted/50"
      >
        <Skills />
      </section>

      {/* Experience Section */}
      <section id="experience" className="py-12">
        <Experience />
      </section>

      {/* Projects Section */}
      <section
        id="projects"
        className="min-h-screen flex items-center justify-center bg-muted/50"
      >
        <Projects />
      </section>

      {/* Research Section */}
      <section
        id="research"
        className="min-h-screen flex items-center justify-center"
      >
        <Research />
      </section>

      {/* Papers Section */}
      <section
        id="papers"
        className="min-h-screen flex items-center justify-center bg-muted/50"
      >
        <Papers />
      </section>

      {/* Education Section */}
      <section
        id="education"
        className="min-h-screen flex items-center justify-center relative"
      >
        {/* Solid background to override any grid patterns */}
        <div className="absolute inset-0 bg-background" />
        <div className="relative z-10 w-full">
          <Education />
        </div>
      </section>

      {/* Blog Section */}
      <section
        id="blogs"
        className="min-h-screen flex items-center justify-center bg-muted/50"
      >
        <Blog />
      </section>

      {/* Contact Section */}
      <section
        id="contact"
        className="min-h-screen flex items-center justify-center"
      >
        <Contact />
      </section>
    </>
  );
}
