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
  /**
   * Deep-link hash for this role, e.g. #ucd-teaching-specialist. Same idea as
   * `Paper.anchorId`.
   *
   * Written by hand rather than derived from role and company, because those
   * are free text: "Founder" appears three times and UCD appears twice, so
   * their uniqueness is incidental, and rewording a job title would silently
   * break every link anyone had already shared. Once a value is published,
   * treat it as permanent.
   */
  anchorId?: string;
}

export const workExperiences = {
  display: true,
  title: "Selection Pressure",
  subtitle: {
    highlightedText: "From engineering precision to evolving intelligence",
    normalText:
      "I once thought I had answers; now I realize I only have questions. Each pivot stripping away what I thought I knew, teaching me that growth happens at the edge of understanding. The pattern matches evolution: survival goes to whatever adapts, right or wrong. Now I let each experience prove that everything is possible when you embrace mutation over optimization.",
  },
  experience: [
    {
      role: "University Teaching Specialist",
      company: "University College Dublin",
      anchorId: "ucd-teaching-specialist",
      companyUrl: "https://www.smurfitschool.ie/",
      companyLogo: "/images/ucd_logo.webp",
      companyDesc: "Smurfit School of Business",
      date: "Aug. 2026 - Present",
      desc: "Teaching Programming for Analytics in Trimester 1 at the UCD Smurfit School of Business, a master's class of about 150 students. Alongside the teaching I do research at the Natural Computing Research and Applications Group with Prof. Michael O'Neill.",
      location: "Dublin, Ireland",
      descBullets: ["#Lecturing #Programming #DataAnalytics #Python #Teaching"],
    },
    {
      role: "Doctoral Assistant",
      company: "University of Neuchâtel",
      anchorId: "unine-doctoral-assistant",
      companyUrl: "https://www.unine.ch/imi",
      companyLogo: "/images/unine_logo.webp",
      companyDesc:
        "Information Management Institute at the Faculty of Economic Sciences",
      date: "Nov. 2020 - June 2026",
      desc: "Teaching assistant at the Information Management Institute, under the supervision of Dr. Paul Cotofrei. Applied Mathematics (Analysis and Linear Algebra) ran every semester as a two-hour lecture plus a two-hour question session, for roughly 150 to 200 first-year bachelor students in Economics and Data Science. Databases (modeling, SQL, NoSQL, visualization) ran each spring, two hours of questions a week plus supervising student projects, for about 60 first and third-year students.",
      location: "Neuchâtel, Switzerland",
      descBullets: ["#Teaching #TA #Mathematics #Database"],
    },
    {
      role: "Visiting Researcher",
      company: "University College Dublin",
      anchorId: "ucd-visiting-researcher",
      companyUrl: "https://ncra.ucd.ie/",
      companyLogo: "/images/ucd_logo.webp",
      companyDesc: "Natural Computing Research & Applications Group",
      date: "Sep. 2023 - Feb. 2024 & Sep. 2024 - Dec. 2024",
      desc: "Two research stays with the Natural Computing Research and Applications Group, working on neuroevolution and evolutionary computation under the supervision of Prof. Michael O'Neill. The collaboration outlasted the visits and continues today.",
      location: "Dublin, Ireland",
      descBullets: [
        "#Neuroevolution #EvolutionaryComputation #Research #Collaboration",
      ],
    },
    {
      role: "Guest Lecturer",
      company: "University of Geneva",
      anchorId: "unige-guest-lecturer",
      companyUrl: "https://www.unige.ch/",
      companyLogo: "/images/unige_logo.webp",
      companyDesc: "Faculty of Medicine",
      date: "2020 - 2022",
      desc: "A three-hour lecture given once a year, 'Demystifying Artificial Intelligence for Health Professionals', to about 20 second-year physicians as part of the Faculty of Medicine's optional courses. Explaining what these systems actually do to people who will be asked to trust them.",
      location: "Geneva, Switzerland",
      descBullets: ["#Teaching #AI #Healthcare #Medicine"],
    },
    {
      role: "Founder",
      company: "Artificialkind",
      anchorId: "artificialkind-founder",
      companyUrl: "https://artificialkind.com/",
      companyLogo: "/images/artificialkind_logo.webp",
      companyDesc:
        "A nonprofit building autonomous artificial agents, out in the open",
      date: "Jan. 2018 - Present",
      desc: "A nonprofit I started to build autonomous artificial agents in the open, and to help people actually understand them. Started long before this was fashionable, with more ambition than budget. Part research lab, part community, part stubbornness.",
      location: "Neuchâtel, Switzerland",
      descBullets: ["#AutonomousAI #ArtificialLife #Nonprofit #OpenResearch"],
    },
    {
      role: "IT Independent",
      company: "Claret.Tech",
      anchorId: "claret-tech-it-independent",
      companyUrl: "https://claret.tech/",
      companyLogo: "/images/clarettech_logo.webp",
      companyDesc:
        "Providing consulting for Blockchain, Smart-Contracts and AI",
      date: "July 2017 - Sep. 2018",
      desc: "Independent consulting in software engineering and blockchain. I advised on technology choices, scoped projects, built prototypes, wrote the documentation, and ran workshops. Clients came from automation, finance, art, video games, and the nonprofit sector.",
      location: "Geneva, Lausanne, and Solothurn, Switzerland",
      descBullets: [
        "#Blockchain #SmartContracts #Python #MachineLearning #Tensorflow #NodeJS #IoT #HelpingStartups #ICO",
      ],
    },
    {
      role: "Co-Founder",
      company: "Versicherix",
      anchorId: "versicherix-cofounder",
      companyUrl: "https://versicherix.com/",
      companyLogo: "/images/versicherix_logo.webp",
      companyDesc: "InsurTech Startup providing blockchain-based services",
      date: "Nov. 2016 - June 2017",
      desc: "Lead on blockchain and innovation at a blockchain-based InsurTech startup. I designed the software architecture, drew the high-level product schematics, ran the projects and the workshops, and built and documented the prototypes. Being a co-founder, the rest came with it: administration, fundraising, exhibitions, partnerships, and market studies.",
      location: "Solothurn, Switzerland",
      descBullets: [
        "#Ethereum #SmartContracts #ERC20 #TOGAF #NodeJS #CI/CD #Azure #Python #MicroServices #Agile #PHP",
      ],
    },
    {
      role: "Founder",
      company: "Overclouds",
      anchorId: "overclouds-founder",
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
      anchorId: "libacy-founder",
      companyUrl: "",
      companyLogo: "/images/libacy_logo.webp",
      companyDesc: "Streaming-based service for a multimedia library Startup",
      date: "Oct. 2010 - Oct. 2015",
      desc: "Lead developer and executive at a multimedia streaming startup, working on MovieCircle. I built the prototypes and the software, designed the architecture and the digital rights management, and wrote the documentation. The other half of the job was the business: the model, market studies, fundraising, partnerships with film studios, and staying inside copyright law.",
      location: "Neuchâtel, Switzerland",
      descBullets: [
        "#NodeJS #PHP #Python #Cryptography #MachineVision #FilmAuthentication #FamilySharing #WebRTC #AWS",
      ],
    },
    {
      role: "Internship",
      company: "Jenks Vestibular Lab",
      anchorId: "jenks-vestibular-internship",
      companyUrl:
        "https://www.masseyeandear.org/research/otolaryngology/vestibular",
      companyLogo: "/images/jvpl_logo.webp",
      companyDesc:
        "Development of balance aids for patients suffering imbalance, as well as vestibular implants for patients who have lost inner ear function.",
      date: "May 2010 - Aug. 2010",
      desc: "A summer at the Jenks Vestibular Physiology Lab, Massachusetts Eye and Ear Infirmary, Harvard Medical School, supervised by Asst. Prof. Dr. Faisal Karmali. The task was to design an experiment looking for a link between vision and the vestibular system: model the setup in 3D, build it by adapting a hydraulic flight simulator, run the Matlab simulations, test on human subjects, and interpret what came back. My first real taste of research, and the reason I kept going.",
      location:
        "Department of Ophthalmology, Harvard Medical School, Boston, USA",
      descBullets: [],
    },
    {
      role: "Internships",
      company: "Manufacture Claret",
      anchorId: "manufacture-claret-internships",
      companyUrl: "https://www.christopheclaret.com/",
      companyLogo: "/images/manufactureclaret_logo.webp",
      companyDesc:
        "Respect for watchmaking traditions and time-honored savoir faire go hand in hand with a quest for innovation and excellence",
      date: "Summers 2004, 2005, 2006, 2012",
      desc: "Four summers in the family workshop, each one a different trade. Computer-aided design and technical drawing of watch movements in 2004. Taking a mechanical pocket watch apart, putting it back together and customizing it in 2005. Manufacturing, chamfering, and technical control in 2006. Research and development in 3D CAD in 2012. Where I learned that tolerances are not negotiable.",
      location: "Le Locle, Switzerland",
      descBullets: [],
    },
  ] as WorkExperience[],
};
