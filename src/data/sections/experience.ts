// Work experience section data
export interface WorkExperience {
  role: string;
  company: string;
  companyUrl: string;
  companyLogo: string;
  companyDesc: string;
  date: string;
  desc?: string;
  location?: string;
  descBullets: string[];
}

export const workExperiences = {
  display: true,
  title: "Selection Pressure",
  subtitle: {
    highlightedText: "From engineering precision to evolving intelligence",
    normalText:
      "—I once thought I had answers; now I realize I only have questions. Each pivot stripping away what I thought I knew, teaching me that growth happens at the edge of understanding. The pattern matches evolution: survival isn't about being right, it's about adapting. Now I let each experience prove that everything is possible when you embrace mutation over optimization.",
  },
  experience: [
    {
      role: "Visiting Researcher",
      company: "University College Dublin",
      companyUrl: "https://ncra.ucd.ie/",
      companyLogo: "/images/ucd_logo.webp",
      companyDesc: "Natural Computing Research & Applications Group",
      date: "Sep. 2023 - Present",
      desc: "Research collaboration on neuroevolution and evolutionary computation under the supervision of Prof. Michael O'Neill.",
      location: "Dublin, Ireland",
      descBullets: [
        "#Neuroevolution #EvolutionaryComputation #Research #Collaboration",
      ],
    },
    {
      role: "Doctoral Assistant",
      company: "University of Neuchâtel",
      companyUrl: "https://www.unine.ch/imi",
      companyLogo: "/images/unine_logo.webp",
      companyDesc:
        "Information Management Institute at the Faculty of Economic Sciences",
      date: "Nov. 2020 - Present",
      desc: "Teaching Assistant for Applied Mathematics (Analysis and Linear Algebra) and Databases (Modelization, SQL, NoSQL, Visualization) for Bachelor students in Economic Science and Data Science.",
      location: "Neuchâtel, Switzerland",
      descBullets: ["#Teaching #TA #Mathematics #Database"],
    },
    {
      role: "Guest Lecturer",
      company: "University of Geneva",
      companyUrl: "https://www.unige.ch/",
      companyLogo: "/images/unige_logo.webp",
      companyDesc: "Faculty of Medicine",
      date: "2020 - 2022",
      desc: "Delivered annual 3-hour lectures on 'Demystifying Artificial Intelligence for Health Professionals' as part of optional courses for second-year physicians.",
      location: "Geneva, Switzerland",
      descBullets: ["#Teaching #AI #Healthcare #Medicine"],
    },
    {
      role: "Founder",
      company: "Artificialkind",
      companyUrl: "https://artificialkind.com/",
      companyLogo: "/images/artificialkind_logo.webp",
      companyDesc: "Supercharging the Humankind with Artificial Entities",
      date: "Jan. 2018 - Present",
      desc: "We build autonomous artificial entities and a hybrid ecosystem for you and them. Reshaping standards and establishing new meaningful foundations for the humanity by closely working with our community. Not only providing cutting-edge technologies, products, and services, we are also training you to use them.",
      location: "Neuchâtel, Switzerland",
      descBullets: [
        "#AGI #AutonomousAI #MachineLearning #Nonprofit #R&D #HighTechDriven",
      ],
    },
    {
      role: "IT Independent",
      company: "Claret.Tech",
      companyUrl: "https://claret.tech/",
      companyLogo: "/images/clarettech_logo.webp",
      companyDesc:
        "Providing consulting for Blockchain, Smart-Contracts and AI",
      date: "July 2017 - Sep. 2018",
      desc: "The tasks were to advise and suggest technologies, define project scopes, document, prototype, and prepare workshops. Active in the domains of Automation, Finance, Art, Video Games, and Non-Profit Organisation.",
      location: "Geneva, Lausanne, and Solothurn, Switzerland",
      descBullets: [
        "#Blockchain #SmartContracts #Python #MachineLearning #Tensorflow #NodeJS #IoT #HelpingStartups #ICO",
      ],
    },
    {
      role: "Co-Founder",
      company: "Versicherix",
      companyUrl: "https://versicherix.com/",
      companyLogo: "/images/versicherix_logo.webp",
      companyDesc: "InsurTech Startup providing blockchain-based services",
      date: "Nov. 2016 - June 2017",
      desc: "In charge of Blockchain & Innovation, the tasks were to make software architectures, do high-level schematics for company products, project management, conduct workshops, prototype & implement software, and write documentation. Also participating in Startup tasks such as administration, fundraising, exhibitions, partnerships, and market studies.",
      location: "Solothurn, Switzerland",
      descBullets: [
        "#Ethereum #SmartContracts #ERC20 #TOGAF #NodeJS #CI/CD #Azure #Python #MicroServices #Agile #PHP",
      ],
    },
    {
      role: "Founder",
      company: "Overclouds",
      companyUrl: "https://github.com/RomainClaret/OverClouds",
      companyLogo: "/images/overclouds_logo.webp",
      companyDesc:
        "Open-Source consensus-based distributed file-hosting service",
      date: "Dec. 2015 - Oct. 2016",
      desc: "Lead developer on an Open-Source project. The tasks were to make software architectures, prototype & implement software, write documentation, and do research.",
      location: "Neuchâtel, Switzerland",
      descBullets: [
        "#WebRTC #P2P #WebTorrents #NodeJS #Serverless #Distributed #Privacy #DistributedConsensus #Blockchain",
      ],
    },
    {
      role: "Founder",
      company: "Libacy",
      companyUrl: "",
      companyLogo: "/images/libacy_logo.webp",
      companyDesc: "Streaming-based service for a multimedia library Startup",
      date: "Oct. 2010 - Oct. 2015",
      desc: "Lead developer and executive at a media-services provider Startup. The tasks were to do prototypes & implement software, make digital rights management & software architectures, write documentation, build the business model, do market studies, do fundraising, create partnerships with Film Studios, and comply with copyright laws. Project name: MovieCircle",
      location: "Neuchâtel, Switzerland",
      descBullets: [
        "#NodeJS #PHP #Python #Cryptography #MachineVision #FilmAuthentication #FamilySharing #WebRTC #AWS",
      ],
    },
    {
      role: "Internship",
      company: "Jenks Vestibular Lab",
      companyUrl:
        "https://www.masseyeandear.org/research/otolaryngology/vestibular",
      companyLogo: "/images/jvpl_logo.webp",
      companyDesc:
        "Development of balance aids for patients suffering imbalance, as well as vestibular implants for patients who have lost inner ear function.",
      date: "May 2010 - Aug. 2010",
      desc: "Design an experiment to identify a link between vision and the vestibular system. The tasks were to build in 3D the setup, construct the setup by adapting a hydraulic flight simulator, run Matlab simulations, experiment on human subjects, and interpret the results.",
      location:
        "Department of Ophthalmology, Harvard Medical School, Boston, USA",
      descBullets: [],
    },
    {
      role: "Internships",
      company: "Manufacture Claret",
      companyUrl: "https://www.christopheclaret.com/",
      companyLogo: "/images/manufactureclaret_logo.webp",
      companyDesc:
        "Respect for watchmaking traditions and time-honoured savoir faire go hand in hand with a quest for innovation and excellence",
      date: "2004, 2005, 2006, 2012",
      desc: "Watchmaking research and development using 3D computer-aided design (CAD). Manufacturing, chamfering, and technical control. Disassembly, reassembly and customization of a mechanical pocket watch. 3D CAD construction and technical drawing of watch movements.",
      location: "Le Locle, Switzerland",
      descBullets: [],
    },
  ] as WorkExperience[],
};
