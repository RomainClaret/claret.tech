// Education section data
export interface School {
  schoolName: string;
  schoolUrl: string;
  logo: string;
  subHeader: string;
  duration: string;
  desc: string;
  research?: string;
  descBullets: string[];
}

export interface Certification {
  name: string;
  issuer: string;
  year: string;
}

export const educationInfo = {
  display: true,
  title: "Academic Journey",
  subtitle: {
    highlightedText:
      "Every degree was a detour that turned out to be the destination",
    normalText:
      "—spent a decade in universities learning how to engineer. Had to master building before I could discover growing.",
  },
  certificationSection: {
    title: "Professional Certifications & Training",
    subtitle:
      "Side Quests That Mattered—Formal certifications and training programs that taught me a different way to approach problems.",
  },
  schools: [
    {
      schoolName: "University of Neuchâtel, Switzerland",
      schoolUrl: "https://www.unine.ch",
      logo: "/images/unine_logo.webp",
      subHeader: "PhD in Computer Science",
      duration: "November 2020 - Present",
      desc: "Thesis: Evolving Neural Networks toward Humanity-inspired Artificial Collective Intelligence",
      research:
        "Supervisors: Prof. Dr. Kilian Stoffel and Prof. Dr. Paul Cotofrei",
      descBullets: [
        "Research: Evolving Neural Networks, Neuromodulation, Spiking, Sparsity, Meta-Learning, Graph Representation, Consensus-based predictions",
        "Teaching Assistant: Applied Mathematics (Analysis and Linear Algebra) for Bachelor in Economic Science and Data Science",
        "Teaching Assistant: Databases (Modelization, SQL, NoSQL, Visualization) for Bachelor in Economic Science and Data Science",
      ],
    },
    {
      schoolName:
        "HES-SO - University of Applied Sciences and Arts Western Switzerland, Lausanne, Switzerland",
      schoolUrl: "https://master.hes-so.ch/master",
      logo: "/images/hes_so_logo_master.webp",
      subHeader: "MSc in Engineering",
      duration: "September 2018 - April 2020",
      desc: "Thesis: Multi-hop Multi-turns Question-Answering Chatbot using Sub-Knowledge Graphs",
      research: "Supervisor: Prof. Dr. Jean Hennebert",
      descBullets: ["Specialization: Machine Learning"],
    },
    {
      schoolName: "HE-Arc - Haute Ecole Arc, Neuchâtel, Switzerland",
      schoolUrl: "https://www.he-arc.ch/",
      logo: "/images/he_arc_logo.webp",
      subHeader: "BSc in Software Engineering",
      duration: "September 2013 - August 2016",
      desc: "Thesis: Anonymous and Decentralized Browser-based Data Sharing Service",
      research: "Supervisor: ing. info. dipl. EPF Marc Schaefer",
      descBullets: [
        "REH-SO: Head of Communication at the umbrella organization for HES-SO Students",
        "My Arc: Founder of a social media and shortcut platform for HE-ARC Students",
      ],
    },
  ] as School[],
  certifications: [
    {
      name: "Human Subjects Research",
      issuer: "CITI program",
      year: "2008",
    },
    {
      name: "Inventor Training",
      issuer: "Hurni Engineering",
      year: "2012",
    },
    {
      name: "Entrepreneurship",
      issuer: "Venturelab",
      year: "2013",
    },
    {
      name: "Writing to Be Published: English Academic Writing",
      issuer: "Dr. Paul Skandera",
      year: "2022",
    },
    {
      name: "Writing to Be Published: English Academic Writing Conventions and Style",
      issuer: "Venturelab, Switzerland",
      year: "2022",
    },
    {
      name: "Summer/Winter Schools",
      issuer: "GEECO, CUSO, BENEFRI",
      year: "2022,2023,2024,2024,2025",
    },
    {
      name: "Training Students to Think Different",
      issuer: "Former Students",
      year: "2023-present",
    },
    {
      name: "Surviving a Ph.D.",
      issuer: "Sheer Stubbornness",
      year: "2020-present",
    },
  ] as Certification[],
};
